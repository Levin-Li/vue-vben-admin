<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import type {
  DomainDnsRecord,
  DomainRecord,
} from '@levin/oak-base-admin/modules/com_levin_oak_base/api/domain';

import { IconifyIcon } from '@vben/icons';
import { useRouter } from 'vue-router';

import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal as AModal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import { domainService } from '@levin/oak-base-admin/modules/com_levin_oak_base/api/domain';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const data = (error as any)?.response?.data;
  return data?.msg || data?.detailMsg || data?.message || fallback;
}

const props = defineProps<{
  domain: DomainRecord | null;
  open: boolean;
}>();

const emit = defineEmits<{
  saved: [];
  'update:open': [value: boolean];
}>();

const DNS_RECORD_TYPE_OPTIONS = [
  'A',
  'AAAA',
  'CAA',
  'CDNSKEY',
  'CDS',
  'CNAME',
  'CSYNC',
  'DNSKEY',
  'DS',
  'EUI48',
  'HIP',
  'HTTPS',
  'LOC',
  'MX',
  'NAPTR',
  'NS',
  'NSEC',
  'NSEC3',
  'NSEC3PARAM',
  'PTR',
  'SOA',
  'SPF',
  'SRV',
  'TLSA',
  'TXT',
].map((value) => ({
  label: value,
  value,
}));

const records = ref<DomainDnsRecord[]>([]);
const loading = ref(false);
const editorOpen = ref(false);
const editorMode = ref<'create' | 'edit'>('create');
const submitting = ref(false);
const deletingRecordId = ref('');
const batchDeleting = ref(false);
const selectedRecordIds = ref<string[]>([]);
const publicIpLoading = ref(false);
const router = useRouter();
let publicIpRequestSeq = 0;

const draft = reactive<DomainDnsRecord>({
  host: '@',
  id: '',
  priority: undefined,
  recordType: 'A',
  ttl: 600,
  value: '',
});

const currentDomainId = computed(() => String(props.domain?.id || '').trim());
const drawerTitle = computed(() => {
  const name = props.domain?.name || currentDomainId.value;
  return name ? `域名解析 · ${name}` : '域名解析';
});
const selectedRecordCount = computed(() => selectedRecordIds.value.length);
const rowSelection = computed(() => ({
  getCheckboxProps: (record: DomainDnsRecord) => ({
    disabled: !record.id,
  }),
  onChange: (keys: Array<number | string>) => {
    selectedRecordIds.value = keys.map(String).filter(Boolean);
  },
  selectedRowKeys: selectedRecordIds.value,
}));

function createDefaultDraft(): DomainDnsRecord {
  return {
    host: '@',
    id: '',
    priority: undefined,
    recordType: 'A',
    ttl: 600,
    value: '',
  };
}

function resetDraft(record?: DomainDnsRecord) {
  Object.assign(draft, createDefaultDraft(), {
    ...record,
    host: record?.host ?? '@',
    id: record?.id ?? '',
    priority: record?.priority ?? undefined,
    recordType: record?.recordType ?? 'A',
    ttl: record?.ttl ?? 600,
    value: record?.value ?? '',
  });
}

async function fillPublicIpValue() {
  if (draft.recordType !== 'A') {
    return;
  }

  const requestSeq = ++publicIpRequestSeq;
  publicIpLoading.value = true;

  try {
    const publicIp = String(await domainService.publicIp()).trim();
    if (
      requestSeq === publicIpRequestSeq &&
      draft.recordType === 'A' &&
      publicIp
    ) {
      draft.value = publicIp;
    }
  } catch (error) {
    message.warning('获取服务器公网IP失败，请手动填写解析值');
    console.warn(error);
  } finally {
    if (requestSeq === publicIpRequestSeq) {
      publicIpLoading.value = false;
    }
  }
}

function normalizeDnsRecordPayload(record: DomainDnsRecord) {
  return {
    host: String(record.host || '').trim(),
    id: String(record.id || '').trim() || undefined,
    priority:
      record.priority === null || record.priority === undefined
        ? undefined
        : Number(record.priority),
    recordType: String(record.recordType || '').trim(),
    ttl:
      record.ttl === null || record.ttl === undefined
        ? undefined
        : Number(record.ttl),
    value: String(record.value || '').trim(),
  };
}

function getRecordDomain(record: DomainDnsRecord) {
  const zone = String(props.domain?.name || '')
    .trim()
    .replace(/\.$/, '');
  const host = String(record.host || '')
    .trim()
    .replace(/\.$/, '');
  if (!zone) {
    return host;
  }
  if (!host || host === '@') {
    return zone;
  }
  if (host === zone || host.endsWith(`.${zone}`)) {
    return host;
  }
  return `${host}.${zone}`;
}

function isSslCertificateRecord(record: DomainDnsRecord) {
  const recordType = String(record.recordType || '')
    .trim()
    .toUpperCase();
  return recordType === 'A' || recordType === 'CNAME';
}

async function loadRecords() {
  if (!props.open || !currentDomainId.value) {
    records.value = [];
    return;
  }

  loading.value = true;

  try {
    records.value = await domainService.listDnsRecords(currentDomainId.value);
    const ids = new Set(
      records.value.map((record) => record.id).filter(Boolean),
    );
    selectedRecordIds.value = selectedRecordIds.value.filter((id) =>
      ids.has(id),
    );
  } catch (error) {
    records.value = [];
    selectedRecordIds.value = [];
    message.warning(getErrorMessage(error, '解析记录加载失败，请稍后重试'));
  } finally {
    loading.value = false;
  }
}

function closeDrawer() {
  selectedRecordIds.value = [];
  emit('update:open', false);
}

function openCreateEditor() {
  editorMode.value = 'create';
  resetDraft();
  editorOpen.value = true;
}

function openEditEditor(record: DomainDnsRecord) {
  editorMode.value = 'edit';
  resetDraft(record);
  editorOpen.value = true;
}

function openCopyEditor(record: DomainDnsRecord) {
  editorMode.value = 'create';
  resetDraft({
    ...record,
    id: '',
  });
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
  resetDraft();
  publicIpRequestSeq++;
  publicIpLoading.value = false;
}

async function submitDraft() {
  if (!currentDomainId.value) {
    message.warning('域名信息缺失，无法保存解析记录');
    return;
  }

  const payload = normalizeDnsRecordPayload(draft);

  if (!payload.recordType) {
    message.warning('请选择解析类型');
    return;
  }

  if (!payload.host) {
    message.warning('请输入主机记录');
    return;
  }

  if (!payload.value) {
    message.warning('请输入解析值');
    return;
  }

  if (
    payload.ttl !== undefined &&
    (!Number.isInteger(payload.ttl) || payload.ttl <= 0)
  ) {
    message.warning('TTL 必须是正整数');
    return;
  }

  if (
    payload.priority !== undefined &&
    (!Number.isInteger(payload.priority) || payload.priority < 0)
  ) {
    message.warning('优先级必须是非负整数');
    return;
  }

  submitting.value = true;

  try {
    if (editorMode.value === 'edit') {
      await domainService.updateDnsRecordById(
        currentDomainId.value,
        String(payload.id || ''),
        payload,
      );
      message.success('解析记录已更新');
    } else {
      await domainService.createDnsRecord(currentDomainId.value, payload);
      message.success('解析记录已新增');
    }

    closeEditor();
    await loadRecords();
    emit('saved');
  } finally {
    submitting.value = false;
  }
}

async function deleteRecord(record: DomainDnsRecord) {
  if (!currentDomainId.value || !record.id) {
    message.warning('解析记录缺少标识，无法删除');
    return;
  }

  deletingRecordId.value = record.id;

  try {
    await domainService.deleteDnsRecordById(currentDomainId.value, record.id);
    message.success('解析记录已删除');
    selectedRecordIds.value = selectedRecordIds.value.filter(
      (id) => id !== record.id,
    );
    await loadRecords();
    emit('saved');
  } finally {
    deletingRecordId.value = '';
  }
}

async function deleteSelectedRecords() {
  if (!currentDomainId.value) {
    message.warning('域名信息缺失，无法批量删除解析记录');
    return;
  }
  if (selectedRecordIds.value.length === 0) {
    message.warning('请先选择要删除的解析记录');
    return;
  }

  batchDeleting.value = true;

  try {
    await domainService.batchDeleteDnsRecords(currentDomainId.value, {
      recordIds: selectedRecordIds.value,
    });
    message.success(`已删除 ${selectedRecordIds.value.length} 条解析记录`);
    selectedRecordIds.value = [];
    await loadRecords();
    emit('saved');
  } finally {
    batchDeleting.value = false;
  }
}

async function openSslCertApply(record: DomainDnsRecord) {
  const domain = getRecordDomain(record);
  await router.push({
    path: '/clob/V1/DomainSslCert',
    query: {
      action: 'apply',
      domain,
      domainId: currentDomainId.value || undefined,
      recordId: record.id || undefined,
      rootDomain: props.domain?.name || undefined,
    },
  });
}

watch(
  () => [props.open, currentDomainId.value] as const,
  ([open, domainId]) => {
    if (!open) {
      editorOpen.value = false;
      deletingRecordId.value = '';
      batchDeleting.value = false;
      selectedRecordIds.value = [];
      records.value = [];
      resetDraft();
      return;
    }

    if (domainId) {
      void loadRecords();
    }
  },
  { immediate: true },
);
</script>

<template>
  <Drawer
    :destroy-on-close="true"
    :open="open"
    :title="drawerTitle"
    :width="960"
    @close="closeDrawer"
  >
    <template #extra>
      <Space>
        <Button :loading="loading" @click="loadRecords">
          <IconifyIcon class="mr-1 size-4" icon="lucide:refresh-cw" />
          刷新
        </Button>
        <Popconfirm
          v-if="selectedRecordCount > 0"
          :title="`确认删除选中的 ${selectedRecordCount} 条解析记录吗？`"
          @confirm="deleteSelectedRecords"
        >
          <Button danger :loading="batchDeleting">
            <IconifyIcon class="mr-1 size-4" icon="lucide:trash-2" />
            批量删除
          </Button>
        </Popconfirm>
        <Button type="primary" @click="openCreateEditor">
          <IconifyIcon class="mr-1 size-4" icon="lucide:plus" />
          新增记录
        </Button>
      </Space>
    </template>

    <div
      class="mb-4 rounded-lg border border-dashed border-border bg-muted/30 p-3"
    >
      <div class="text-sm font-medium">
        {{ props.domain?.name || currentDomainId || '未命名域名' }}
      </div>
    </div>

    <Spin :spinning="loading">
      <Table
        v-if="records.length > 0"
        :columns="[
          {
            dataIndex: 'recordType',
            key: 'recordType',
            title: '类型',
            width: 110,
          },
          { dataIndex: 'host', key: 'host', title: '主机', width: 150 },
          { dataIndex: 'value', key: 'value', title: '解析值' },
          { dataIndex: 'ttl', key: 'ttl', title: 'TTL', width: 110 },
          {
            dataIndex: 'priority',
            key: 'priority',
            title: '优先级',
            width: 120,
          },
          { key: 'actions', title: '操作', width: 260 },
        ]"
        :data-source="records"
        :pagination="false"
        :row-selection="rowSelection"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'recordType'">
            <Tag color="blue">{{ record.recordType || '-' }}</Tag>
          </template>
          <template v-else-if="column.key === 'value'">
            <div class="break-all">{{ record.value || '-' }}</div>
          </template>
          <template v-else-if="column.key === 'actions'">
            <Space :size="4">
              <Button size="small" type="link" @click="openEditEditor(record)">
                编辑
              </Button>
              <Button size="small" type="link" @click="openCopyEditor(record)">
                复制
              </Button>
              <Button
                v-if="isSslCertificateRecord(record)"
                size="small"
                type="link"
                @click="openSslCertApply(record)"
              >
                去申请域名证书
              </Button>
              <Popconfirm
                title="确认删除当前解析记录吗？"
                @confirm="deleteRecord(record)"
              >
                <Button
                  danger
                  :loading="deletingRecordId === record.id"
                  size="small"
                  type="link"
                >
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
      <Empty v-else description="暂无解析记录" />
    </Spin>

    <AModal
      :confirm-loading="submitting"
      :destroy-on-close="true"
      :open="editorOpen"
      :title="editorMode === 'edit' ? '编辑解析记录' : '新增解析记录'"
      @cancel="closeEditor"
      @ok="submitDraft"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
          <Form.Item label="解析类型" required>
            <Select
              v-model:value="draft.recordType"
              :options="DNS_RECORD_TYPE_OPTIONS"
              placeholder="请选择解析类型"
              show-search
            />
          </Form.Item>
          <Form.Item label="主机记录" required>
            <Input
              v-model:value="draft.host"
              placeholder="例如 @、www、_acme-challenge"
            />
          </Form.Item>
          <Form.Item class="col-span-2" label="解析值" required>
            <div class="flex gap-2">
              <Input
                v-model:value="draft.value"
                class="min-w-0"
                placeholder="请输入解析值"
              />
              <Button
                v-if="draft.recordType === 'A'"
                :loading="publicIpLoading"
                @click="fillPublicIpValue"
              >
                填入公网IP
              </Button>
            </div>
          </Form.Item>
          <Form.Item label="TTL">
            <InputNumber
              v-model:value="draft.ttl"
              class="w-full"
              :min="1"
              placeholder="请输入 TTL"
            />
          </Form.Item>
          <Form.Item label="优先级">
            <InputNumber
              v-model:value="draft.priority"
              class="w-full"
              :min="0"
              placeholder="请输入优先级"
            />
          </Form.Item>
        </div>
      </Form>
    </AModal>
  </Drawer>
</template>
