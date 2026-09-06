<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { Button, message, Modal, Popconfirm, Table } from 'ant-design-vue';

import { isSuperAdminUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

import {
  moduleCreateCrudRecord,
  moduleDeleteCrudRecord,
  moduleFetchCrudList,
} from './api-module';
import SettingValueContentField from './setting-value-content-field.vue';

const props = defineProps<{
  bizDataId?: string;
  bizType?: string;
  open: boolean;
  restoring?: boolean;
  tenantId?: string;
  title?: string;
}>();

const emit = defineEmits<{
  restored: [];
  'update:open': [value: boolean];
}>();

const loading = ref(false);
const deletingId = ref<string>();
const restoringId = ref<string>();
const records = ref<Record<string, any>[]>([]);
const detailOpen = ref(false);
const detailRecord = ref<null | Record<string, any>>(null);

const userStore = useUserStore();
const canDeleteHistory = computed(() => isSuperAdminUser(userStore.userInfo));
const dialogTitle = computed(() => props.title || '恢复数据');

function getListItems(result: any): Record<string, any>[] {
  let source = result;
  for (
    let depth = 0;
    depth < 3 && source && !Array.isArray(source);
    depth += 1
  ) {
    if (Array.isArray(source.items)) return source.items;
    if (Array.isArray(source.records)) return source.records;
    if (Array.isArray(source.list)) return source.list;
    source = source.data;
  }
  return Array.isArray(source) ? source : [];
}

function getHistoryEditor(history: Record<string, any>) {
  const editor = String(history.editor ?? '').trim();
  return editor || `class:${history.bizType || props.bizType}`;
}

async function loadHistory() {
  if (!props.bizType || !props.bizDataId) return;
  loading.value = true;
  try {
    const result = await moduleFetchCrudList('/SettingHistoryData/list', {
      bizDataId: props.bizDataId,
      bizType: props.bizType,
      pageIndex: 1,
      pageSize: 200,
      tenantId: props.tenantId,
    });
    records.value = getListItems(result);
  } catch (error) {
    console.error(error);
    message.error('历史数据加载失败');
  } finally {
    loading.value = false;
  }
}

function openDetail(history: Record<string, any>) {
  detailRecord.value = history;
  detailOpen.value = true;
}

async function restoreHistory(history: Record<string, any>) {
  if (props.restoring || restoringId.value) return;
  restoringId.value = history.id;
  try {
    await moduleCreateCrudRecord('/SettingHistoryData/restore', {
      id: history.id,
      tenantId: history.tenantId,
    });
    message.success('历史数据已恢复');
    emit('update:open', false);
    emit('restored');
  } catch (error) {
    console.error(error);
    message.error('恢复历史数据失败');
  } finally {
    restoringId.value = undefined;
  }
}

async function deleteHistory(history: Record<string, any>) {
  deletingId.value = history.id;
  try {
    await moduleDeleteCrudRecord('/SettingHistoryData/delete', history.id);
    records.value = records.value.filter((item) => item.id !== history.id);
    message.success('历史数据已删除');
  } catch (error) {
    console.error(error);
    message.error('删除历史数据失败');
  } finally {
    deletingId.value = undefined;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    records.value = [];
    void loadHistory();
  },
  { immediate: true },
);
</script>

<template>
  <Modal
    :open="open"
    :footer="null"
    :mask-closable="false"
    :title="dialogTitle"
    width="min(86vw, 1120px)"
    @cancel="emit('update:open', false)"
  >
    <Table
      :columns="[
        {
          title: '版本时间',
          dataIndex: 'createTime',
          key: 'createTime',
          width: 190,
        },
        { title: '标题', dataIndex: 'title', key: 'title' },
        { title: '备注', dataIndex: 'remark', key: 'remark' },
        { title: '操作', key: 'action', width: 220 },
      ]"
      :data-source="records"
      :loading="loading"
      :pagination="false"
      :scroll="{ y: '55vh' }"
      row-key="id"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <Button size="small" type="link" @click="openDetail(record)">
            查看数据
          </Button>
          <Popconfirm
            title="确认恢复这条历史数据吗？"
            @confirm="restoreHistory(record)"
          >
            <template #description>
              <div>恢复会以该历史版本覆盖当前数据。</div>
              <div>恢复动作不会生成新的历史版本。</div>
            </template>
            <Button
              :loading="restoring || restoringId === record.id"
              size="small"
              type="link"
            >
              恢复数据
            </Button>
          </Popconfirm>
          <Popconfirm
            v-if="canDeleteHistory"
            title="确认删除这条历史数据吗？"
            @confirm="deleteHistory(record)"
          >
            <Button
              danger
              :loading="deletingId === record.id"
              size="small"
              type="link"
            >
              删除
            </Button>
          </Popconfirm>
        </template>
      </template>
    </Table>
  </Modal>

  <Modal
    v-model:open="detailOpen"
    :footer="null"
    :mask-closable="false"
    title="历史数据详情"
    width="min(82vw, 1200px)"
  >
    <SettingValueContentField
      v-if="detailRecord"
      disabled
      :form-state="{
        editor: getHistoryEditor(detailRecord),
        name: detailRecord.title || '历史数据',
        valueContent: detailRecord.content,
        valueType: 'Json',
      }"
      inline
    />
  </Modal>
</template>
