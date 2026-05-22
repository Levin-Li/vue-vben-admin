<script lang="ts" setup>
import type { VxeGridProps } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';

import { computed, ref, watch } from 'vue';

import { Button, Checkbox, Input, message, Modal, Popconfirm } from 'ant-design-vue';

import { useVbenVxeGrid } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';
import { getEnabledFrontendModules } from '@levin/admin-framework/framework-commons/app/options';

import { getAdminI18nLabelSyncService } from '../../runtime';
import {
  buildModuleSyncI18nLabelsPayload,
  type SyncI18nLabelItem,
} from '../utils/sync-i18n-labels';

type EditableSyncI18nLabelItem = SyncI18nLabelItem & {
  key: string;
};

const props = withDefaults(
  defineProps<{
    open?: boolean;
  }>(),
  {
    open: false,
  },
);

const emit = defineEmits<{
  'update:open': [open: boolean];
}>();

const loading = ref(false);
const labelList = ref<EditableSyncI18nLabelItem[]>([]);
const selectedKeys = ref<Set<string>>(new Set());
const overrideExistingKeys = ref<Set<string>>(new Set());
const enableKeys = ref<Set<string>>(new Set());

const gridOptions: VxeGridProps<EditableSyncI18nLabelItem> = {
  columns: [
    {
      align: 'center',
      fixed: 'left',
      slots: { default: 'select', header: 'selectHeader' },
      title: '是否上传',
      width: 86,
    },
    {
      align: 'center',
      slots: { default: 'overrideExisting', header: 'overrideExistingHeader' },
      title: '是否覆盖',
      width: 86,
    },
    {
      align: 'center',
      slots: { default: 'enable', header: 'enableHeader' },
      title: '是否启用',
      width: 86,
    },
    {
      field: 'moduleTitle',
      minWidth: 140,
      title: '模块',
    },
    {
      field: 'language',
      minWidth: 100,
      title: '语言',
    },
    {
      field: 'resKey',
      minWidth: 260,
      slots: { default: 'resKey' },
      title: '资源键',
    },
    {
      field: 'label',
      minWidth: 320,
      slots: { default: 'label' },
      title: '当前标签值',
    },
    {
      field: 'moduleId',
      minWidth: 180,
      slots: { default: 'moduleId' },
      title: '模块ID',
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 100,
    },
  ],
  data: labelList.value,
  height: 520,
  keepSource: true,
  pagerConfig: {
    enabled: false,
  },
  rowConfig: {
    keyField: 'key',
  },
  showOverflow: false,
  toolbarConfig: {
    enabled: false,
  },
};

const [Grid, gridApi] = useVbenVxeGrid<EditableSyncI18nLabelItem>({
  gridOptions,
  showSearchForm: false,
});

const totalCount = computed(() => labelList.value.length);
const selectedCount = computed(() => selectedKeys.value.size);
const allSelected = computed(
  () => totalCount.value > 0 && selectedCount.value === totalCount.value,
);
const partiallySelected = computed(
  () => selectedCount.value > 0 && !allSelected.value,
);
const allOverrideExistingSelected = computed(
  () =>
    totalCount.value > 0 && overrideExistingKeys.value.size === totalCount.value,
);
const partiallyOverrideExistingSelected = computed(
  () =>
    overrideExistingKeys.value.size > 0 &&
    overrideExistingKeys.value.size < totalCount.value,
);
const allEnableSelected = computed(
  () => totalCount.value > 0 && enableKeys.value.size === totalCount.value,
);
const partiallyEnableSelected = computed(
  () => enableKeys.value.size > 0 && enableKeys.value.size < totalCount.value,
);
const openProxy = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

function resetLabelList() {
  labelList.value = buildModuleSyncI18nLabelsPayload(
    getEnabledFrontendModules(),
  ).labelList.map((item, index) => ({
    ...item,
    key: `label-${index}`,
  }));
  selectedKeys.value = new Set(labelList.value.map((item) => item.key));
  overrideExistingKeys.value = new Set();
  enableKeys.value = new Set();
}

function readCheckboxChecked(event: { target?: { checked?: boolean } }) {
  return Boolean(event.target?.checked);
}

function buildAllKeys(checked: boolean): Set<string> {
  return checked
    ? new Set(labelList.value.map((item) => item.key))
    : new Set<string>();
}

function toggleKey(keys: Set<string>, key: string, checked: boolean) {
  const nextKeys = new Set(keys);
  if (checked) {
    nextKeys.add(key);
  } else {
    nextKeys.delete(key);
  }
  return nextKeys;
}

function setSelectedAll(checked: boolean) {
  selectedKeys.value = buildAllKeys(checked);
}

function toggleSelected(key: string, checked: boolean) {
  selectedKeys.value = toggleKey(selectedKeys.value, key, checked);
}

function setOverrideExistingAll(checked: boolean) {
  overrideExistingKeys.value = buildAllKeys(checked);
}

function toggleOverrideExisting(key: string, checked: boolean) {
  overrideExistingKeys.value = toggleKey(
    overrideExistingKeys.value,
    key,
    checked,
  );
}

function setEnableAll(checked: boolean) {
  enableKeys.value = buildAllKeys(checked);
}

function toggleEnable(key: string, checked: boolean) {
  enableKeys.value = toggleKey(enableKeys.value, key, checked);
}

function handleDelete(record: EditableSyncI18nLabelItem) {
  labelList.value = labelList.value.filter((item) => item.key !== record.key);
  selectedKeys.value.delete(record.key);
  overrideExistingKeys.value.delete(record.key);
  enableKeys.value.delete(record.key);
  selectedKeys.value = new Set(selectedKeys.value);
  overrideExistingKeys.value = new Set(overrideExistingKeys.value);
  enableKeys.value = new Set(enableKeys.value);
}

async function handleSubmit() {
  const labelSyncService = getAdminI18nLabelSyncService();
  if (!labelSyncService) {
    message.warning('当前应用没有配置国际化标签同步服务');
    return;
  }

  const labelListPayload = labelList.value
    .filter((item) => selectedKeys.value.has(item.key))
    .map(({ key, moduleTitle, ...item }) => ({
      ...item,
      enable: enableKeys.value.has(key),
      overrideExisting: overrideExistingKeys.value.has(key),
    }));

  if (labelListPayload.length === 0) {
    message.warning('请先选择要上传的国际化标签');
    return;
  }

  loading.value = true;
  try {
    await labelSyncService.syncLabels({ labelList: labelListPayload });
    message.success('上传国际化标签成功');
    openProxy.value = false;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetLabelList();
    }
  },
  {
    immediate: true,
  },
);

watch(labelList, (data) => {
  gridApi.setGridOptions({ data });
});
</script>

<template>
  <Modal
    v-model:open="openProxy"
    :confirm-loading="loading"
    :body-style="{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }"
    :ok-button-props="{ disabled: selectedCount === 0 }"
    ok-text="上传"
    title="上传国际化标签"
    width="85vw"
    @ok="handleSubmit"
  >
    <div class="text-muted-foreground mb-3 text-sm">
      共
      {{ totalCount }}
      个已启用前端模块的本地国际化标签，已选择
      {{ selectedCount }}
      个。可在上传前修改标签值，或删除不需要同步的标签。
    </div>

    <Grid class="sync-i18n-label-grid">
      <template #selectHeader>
        <div class="sync-i18n-label-option-header">
          <span>是否上传</span>
          <Checkbox
            :checked="allSelected"
            :indeterminate="partiallySelected"
            @change="setSelectedAll(readCheckboxChecked($event))"
          />
        </div>
      </template>
      <template #select="{ row }">
        <Checkbox
          :checked="selectedKeys.has(row.key)"
          @change="toggleSelected(row.key, readCheckboxChecked($event))"
        />
      </template>
      <template #overrideExistingHeader>
        <div class="sync-i18n-label-option-header">
          <span>是否覆盖</span>
          <Checkbox
            :checked="allOverrideExistingSelected"
            :indeterminate="partiallyOverrideExistingSelected"
            @change="
              setOverrideExistingAll(readCheckboxChecked($event))
            "
          />
        </div>
      </template>
      <template #overrideExisting="{ row }">
        <Checkbox
          :checked="overrideExistingKeys.has(row.key)"
          @change="
            toggleOverrideExisting(row.key, readCheckboxChecked($event))
          "
        />
      </template>
      <template #enableHeader>
        <div class="sync-i18n-label-option-header">
          <span>是否启用</span>
          <Checkbox
            :checked="allEnableSelected"
            :indeterminate="partiallyEnableSelected"
            @change="setEnableAll(readCheckboxChecked($event))"
          />
        </div>
      </template>
      <template #enable="{ row }">
        <Checkbox
          :checked="enableKeys.has(row.key)"
          @change="toggleEnable(row.key, readCheckboxChecked($event))"
        />
      </template>
      <template #resKey="{ row }">
        <span class="font-mono text-xs">{{ row.resKey }}</span>
      </template>
      <template #label="{ row }">
        <Input v-model:value="row.label" placeholder="请输入标签值" />
      </template>
      <template #moduleId="{ row }">
        <span class="font-mono text-xs">{{ row.moduleId }}</span>
      </template>
      <template #actions="{ row }">
        <Popconfirm title="确认删除该标签？" @confirm="handleDelete(row)">
          <Button danger size="small" type="link">删除</Button>
        </Popconfirm>
      </template>
    </Grid>
  </Modal>
</template>

<style scoped>
.sync-i18n-label-grid :deep(.vxe-grid) {
  border-radius: 8px;
}

.sync-i18n-label-option-header {
  align-items: center;
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
}
</style>
