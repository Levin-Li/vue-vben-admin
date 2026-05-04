<script lang="ts" setup>
import { computed, reactive, ref, watch } from 'vue';

import type {
  TenantSiteDnsRecord,
  TenantSiteRecord,
} from '@levin/oak-base-admin/modules/com_levin_oak_base/api/tenant-site';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import { tenantSiteService } from '@levin/oak-base-admin/modules/com_levin_oak_base/api/tenant-site';

const props = defineProps<{
  open: boolean;
  site: null | TenantSiteRecord;
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

const records = ref<TenantSiteDnsRecord[]>([]);
const loading = ref(false);
const editorOpen = ref(false);
const editorMode = ref<'create' | 'edit'>('create');
const submitting = ref(false);
const deletingRecordId = ref('');
const publicIpLoading = ref(false);
let publicIpRequestSeq = 0;

const draft = reactive<TenantSiteDnsRecord>({
  host: '@',
  id: '',
  priority: undefined,
  recordType: 'A',
  ttl: 600,
  value: '',
});

const currentSiteId = computed(() => String(props.site?.id || '').trim());
const drawerTitle = computed(() => {
  const name = props.site?.domain || props.site?.name || currentSiteId.value;
  return name ? `域名解析 · ${name}` : '域名解析';
});

function createDefaultDraft(): TenantSiteDnsRecord {
  return {
    host: '@',
    id: '',
    priority: undefined,
    recordType: 'A',
    ttl: 600,
    value: '',
  };
}

function resetDraft(record?: TenantSiteDnsRecord) {
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
    const publicIp = String(await tenantSiteService.publicIp()).trim();
    if (requestSeq === publicIpRequestSeq && draft.recordType === 'A' && publicIp) {
      draft.value = publicIp;
    }
  } catch {
    message.warning('获取服务器公网IP失败，请手动填写解析值');
  } finally {
    if (requestSeq === publicIpRequestSeq) {
      publicIpLoading.value = false;
    }
  }
}

function normalizeDnsRecordPayload(record: TenantSiteDnsRecord) {
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

async function loadRecords() {
  if (!props.open || !currentSiteId.value) {
    records.value = [];
    return;
  }

  loading.value = true;

  try {
    records.value = await tenantSiteService.listDnsRecords(currentSiteId.value);
  } catch {
    records.value = [];
  } finally {
    loading.value = false;
  }
}

function closeDrawer() {
  emit('update:open', false);
}

function openCreateEditor() {
  editorMode.value = 'create';
  resetDraft();
  editorOpen.value = true;
}

function openEditEditor(record: TenantSiteDnsRecord) {
  editorMode.value = 'edit';
  resetDraft(record);
  editorOpen.value = true;
}

function openCopyEditor(record: TenantSiteDnsRecord) {
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
  if (!currentSiteId.value) {
    message.warning('站点信息缺失，无法保存解析记录');
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

  if (payload.ttl !== undefined && (!Number.isInteger(payload.ttl) || payload.ttl <= 0)) {
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
      await tenantSiteService.updateDnsRecordById(
        currentSiteId.value,
        String(payload.id || ''),
        payload,
      );
      message.success('解析记录已更新');
    } else {
      await tenantSiteService.createDnsRecord(currentSiteId.value, payload);
      message.success('解析记录已新增');
    }

    closeEditor();
    await loadRecords();
    emit('saved');
  } finally {
    submitting.value = false;
  }
}

async function deleteRecord(record: TenantSiteDnsRecord) {
  if (!currentSiteId.value || !record.id) {
    message.warning('解析记录缺少标识，无法删除');
    return;
  }

  deletingRecordId.value = record.id;

  try {
    await tenantSiteService.deleteDnsRecordById(currentSiteId.value, record.id);
    message.success('解析记录已删除');
    await loadRecords();
    emit('saved');
  } finally {
    deletingRecordId.value = '';
  }
}

watch(
  () => [props.open, currentSiteId.value] as const,
  ([open, siteId]) => {
    if (!open) {
      editorOpen.value = false;
      deletingRecordId.value = '';
      records.value = [];
      resetDraft();
      return;
    }

    if (siteId) {
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
        <Button type="primary" @click="openCreateEditor">
          <IconifyIcon class="mr-1 size-4" icon="lucide:plus" />
          新增记录
        </Button>
      </Space>
    </template>

    <div class="mb-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <div class="text-sm font-medium">
        {{ props.site?.domain || props.site?.name || currentSiteId || '未命名站点' }}
      </div>
    </div>

    <Spin :spinning="loading">
      <Table
        v-if="records.length > 0"
        :columns="[
          { dataIndex: 'recordType', key: 'recordType', title: '类型', width: 110 },
          { dataIndex: 'host', key: 'host', title: '主机', width: 150 },
          { dataIndex: 'value', key: 'value', title: '解析值' },
          { dataIndex: 'ttl', key: 'ttl', title: 'TTL', width: 110 },
          { dataIndex: 'priority', key: 'priority', title: '优先级', width: 120 },
          { key: 'actions', title: '操作', width: 210 },
        ]"
        :data-source="records"
        :pagination="false"
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

    <Modal
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
            <Input v-model:value="draft.host" placeholder="例如 @、www、_acme-challenge" />
          </Form.Item>
          <Form.Item class="col-span-2" label="解析值" required>
            <div class="flex gap-2">
              <Input v-model:value="draft.value" class="min-w-0" placeholder="请输入解析值" />
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
    </Modal>
  </Drawer>
</template>
