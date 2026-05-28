<script lang="ts" setup>
import type { VxeGridProps } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';

import { computed, reactive, ref, watch } from 'vue';

import { Checkbox, Input, message, Modal, Select, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';

import { getAdminI18nLabelSyncService } from '../../runtime';
import { adminFrameworkLocales } from '../locales';
import { getApplicationI18nModules } from '../utils/application-i18n-modules';
import {
  buildModuleUploadI18nLabelsPayload,
  buildSyncI18nModuleTree,
  flattenSyncI18nTreeNodes,
  type SyncI18nTreeNode,
} from '../utils/sync-i18n-labels';

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
const treeRows = ref<SyncI18nTreeNode[]>([]);
const selectedKeys = ref<Set<string>>(new Set());
const overrideExisting = ref(false);
const enable = ref(true);
const tenantShared = ref(true);
const viteEnv = (import.meta as unknown as { env: Record<string, string> }).env;
const uploadContext = reactive<{
  appCode: string;
  appVersion: string;
  domain: string;
  tenantId: string;
  terminalType?: string;
}>({
  appCode: '',
  appVersion: '',
  domain: '',
  tenantId: '',
  terminalType: 'Admin',
});

const terminalTypeOptions = [
  { label: '管理后台', value: 'Admin' },
  { label: 'PC网站', value: 'Web' },
  { label: 'H5', value: 'H5' },
  { label: '小程序', value: 'MiniProgram' },
  { label: 'App', value: 'App' },
  { label: '开放API', value: 'OpenApi' },
];

const gridOptions: VxeGridProps<SyncI18nTreeNode> = {
  columns: [
    {
      align: 'center',
      fixed: 'left',
      slots: { default: 'select', header: 'selectHeader' },
      title: '是否上传',
      width: 86,
    },
    {
      field: 'moduleTitle',
      minWidth: 240,
      slots: { default: 'name' },
      title: '模块 / 语言包',
      treeNode: true,
    },
    {
      field: 'language',
      minWidth: 100,
      title: '语言',
    },
    {
      align: 'right',
      field: 'keyCount',
      headerAlign: 'right',
      minWidth: 120,
      slots: { default: 'keyCount' },
      title: '可上传 Key 数',
    },
    {
      field: 'moduleId',
      minWidth: 220,
      slots: { default: 'moduleId' },
      title: '模块ID',
    },
    {
      field: 'labels',
      minWidth: 360,
      slots: { default: 'labels' },
      title: 'Key 预览',
    },
  ],
  data: treeRows.value,
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
  treeConfig: {
    childrenField: 'children',
    rowField: 'key',
    transform: false,
  },
};

const [Grid, gridApi] = useVbenVxeGrid<SyncI18nTreeNode>({
  gridOptions,
  showSearchForm: false,
});

const flatRows = computed(() => flattenSyncI18nTreeNodes(treeRows.value));
const languageRows = computed(() =>
  flatRows.value.filter((item) => item.nodeType === 'language'),
);
const selectedLanguageRows = computed(() =>
  languageRows.value.filter((item) => selectedKeys.value.has(item.key)),
);
const totalModuleCount = computed(() => treeRows.value.length);
const totalRowCount = computed(() => flatRows.value.length);
const selectedRowCount = computed(() => selectedKeys.value.size);
const selectedModuleCount = computed(
  () => new Set(selectedLanguageRows.value.map((item) => item.moduleId)).size,
);
const totalKeyCount = computed(() =>
  languageRows.value.reduce((total, item) => total + item.keyCount, 0),
);
const selectedKeyCount = computed(() =>
  selectedLanguageRows.value.reduce((total, item) => total + item.keyCount, 0),
);
const allSelected = computed(
  () =>
    totalRowCount.value > 0 && selectedRowCount.value === totalRowCount.value,
);
const partiallySelected = computed(
  () => selectedRowCount.value > 0 && !allSelected.value,
);
const openProxy = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

function resetModuleRows() {
  treeRows.value = buildSyncI18nModuleTree(
    getApplicationI18nModules(adminFrameworkLocales),
  );
  selectedKeys.value = new Set(
    flattenSyncI18nTreeNodes(treeRows.value).map((item) => item.key),
  );
  overrideExisting.value = false;
  enable.value = true;
  tenantShared.value = true;
  uploadContext.appCode = viteEnv.VITE_APP_NAMESPACE || '';
  uploadContext.appVersion = viteEnv.VITE_APP_VERSION || '';
  uploadContext.domain = globalThis.location?.hostname || '';
  uploadContext.tenantId = '';
  uploadContext.terminalType = 'Admin';
}

function readCheckboxChecked(event: { target?: { checked?: boolean } }) {
  return Boolean(event.target?.checked);
}

function syncAncestorKeys(keys: Set<string>) {
  function syncNode(item: SyncI18nTreeNode) {
    const children = item.children || [];
    if (children.length === 0) {
      return keys.has(item.key);
    }

    const allChildrenChecked = children.map(syncNode).every(Boolean);
    if (allChildrenChecked) {
      keys.add(item.key);
    } else {
      keys.delete(item.key);
    }

    return keys.has(item.key);
  }

  treeRows.value.forEach(syncNode);
  return keys;
}

function getSelfAndDescendantKeys(row: SyncI18nTreeNode) {
  return [
    row.key,
    ...flattenSyncI18nTreeNodes(row.children || []).map((item) => item.key),
  ];
}

function setSelectedAll(checked: boolean) {
  selectedKeys.value = checked
    ? new Set(flattenSyncI18nTreeNodes(treeRows.value).map((item) => item.key))
    : new Set();
}

function toggleSelected(row: SyncI18nTreeNode, checked: boolean) {
  const nextKeys = new Set(selectedKeys.value);
  getSelfAndDescendantKeys(row).forEach((key) => {
    if (checked) {
      nextKeys.add(key);
    } else {
      nextKeys.delete(key);
    }
  });
  selectedKeys.value = syncAncestorKeys(nextKeys);
}

function hasCheckedDescendant(row: SyncI18nTreeNode): boolean {
  return (row.children || []).some(
    (child) => selectedKeys.value.has(child.key) || hasCheckedDescendant(child),
  );
}

function isRowIndeterminate(row: SyncI18nTreeNode) {
  return !selectedKeys.value.has(row.key) && hasCheckedDescendant(row);
}

function getPreviewKeys(row: SyncI18nTreeNode) {
  return Object.keys(row.labels || {}).slice(0, 6);
}

function getRowName(row: SyncI18nTreeNode) {
  return row.nodeType === 'language'
    ? `${row.language} 语言包`
    : row.moduleTitle || row.moduleId;
}

async function handleSubmit() {
  const labelSyncService = getAdminI18nLabelSyncService();
  if (!labelSyncService?.uploadModuleLabels) {
    message.warning('当前应用没有配置国际化资源上传服务');
    return;
  }

  if (selectedLanguageRows.value.length === 0) {
    message.warning('请先选择要上传的国际化资源模块');
    return;
  }

  loading.value = true;
  try {
    await labelSyncService.uploadModuleLabels(
      buildModuleUploadI18nLabelsPayload(selectedLanguageRows.value, {
        appCode: uploadContext.appCode,
        appVersion: uploadContext.appVersion,
        domain: uploadContext.domain,
        enable: enable.value,
        overrideExisting: overrideExisting.value,
        tenantId: uploadContext.tenantId,
        tenantShared: tenantShared.value,
        terminalType: uploadContext.terminalType,
      }),
    );
    message.success('上传国际化资源成功');
    openProxy.value = false;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetModuleRows();
    }
  },
  {
    immediate: true,
  },
);

watch(treeRows, (data) => {
  gridApi.setGridOptions({ data });
});
</script>

<template>
  <Modal
    v-model:open="openProxy"
    :body-style="{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }"
    :confirm-loading="loading"
    :mask-closable="false"
    :ok-button-props="{ disabled: selectedLanguageRows.length === 0 }"
    ok-text="上传"
    title="上传国际化资源"
    width="85vw"
    @ok="handleSubmit"
  >
    <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label class="sync-i18n-label-context-field">
        <span>应用编码</span>
        <Input
          v-model:value="uploadContext.appCode"
          allow-clear
          placeholder="全部应用"
        />
      </label>
      <label class="sync-i18n-label-context-field">
        <span>应用版本号</span>
        <Input
          v-model:value="uploadContext.appVersion"
          allow-clear
          placeholder="全部版本"
        />
      </label>
      <label class="sync-i18n-label-context-field">
        <span>终端类型</span>
        <Select
          v-model:value="uploadContext.terminalType"
          allow-clear
          :options="terminalTypeOptions"
          placeholder="全部终端"
        />
      </label>
      <label class="sync-i18n-label-context-field">
        <span>租户ID</span>
        <Input
          v-model:value="uploadContext.tenantId"
          allow-clear
          placeholder="全部租户"
        />
      </label>
      <label class="sync-i18n-label-context-field">
        <span>域名</span>
        <Input
          v-model:value="uploadContext.domain"
          allow-clear
          placeholder="全部域名"
        />
      </label>
    </div>

    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div class="text-muted-foreground text-sm">
        当前应用共有
        {{ totalModuleCount }}
        个模块、
        {{ languageRows.length }}
        个语言包、
        {{ totalKeyCount }}
        个 key 可上传，已选择
        {{ selectedModuleCount }}
        个模块、
        {{ selectedLanguageRows.length }}
        个语言包、
        {{ selectedKeyCount }}
        个 key。
      </div>
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <Checkbox v-model:checked="overrideExisting">覆盖已有</Checkbox>
        <Checkbox v-model:checked="enable">上传后启用</Checkbox>
        <Checkbox v-model:checked="tenantShared">租户共享</Checkbox>
      </div>
    </div>

    <Grid class="sync-i18n-label-tree-grid">
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
          :indeterminate="isRowIndeterminate(row)"
          @change="toggleSelected(row, readCheckboxChecked($event))"
        />
      </template>
      <template #name="{ row }">
        <span>{{ getRowName(row) }}</span>
      </template>
      <template #keyCount="{ row }">
        <Tag color="blue">{{ row.keyCount }}</Tag>
      </template>
      <template #moduleId="{ row }">
        <span class="font-mono text-xs">{{ row.moduleId }}</span>
      </template>
      <template #labels="{ row }">
        <div class="flex max-w-full flex-wrap gap-1">
          <span
            v-if="row.nodeType === 'module'"
            class="text-muted-foreground text-xs"
          >
            展开查看语言包
          </span>
          <Tag v-for="key in getPreviewKeys(row)" :key="key">
            {{ key }}
          </Tag>
          <Tag v-if="row.nodeType === 'language' && row.keyCount > 6">
            +{{ row.keyCount - 6 }}
          </Tag>
        </div>
      </template>
    </Grid>
  </Modal>
</template>

<style scoped>
.sync-i18n-label-tree-grid :deep(.vxe-grid) {
  border-radius: 8px;
}

.sync-i18n-label-option-header {
  align-items: center;
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
}

.sync-i18n-label-context-field {
  display: grid;
  gap: 6px;
}

.sync-i18n-label-context-field > span {
  font-size: 13px;
  line-height: 1.3;
}
</style>
