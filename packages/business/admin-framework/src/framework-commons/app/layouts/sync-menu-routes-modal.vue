<script lang="ts" setup>
import type { VxeGridProps } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';

import type {
  EditableSyncMenuItem,
  SyncMenuBooleanField,
} from './sync-menu-routes-state';

import { computed, ref, watch } from 'vue';

import { getAdminMenuSyncService } from '@levin/admin-framework';
import { useVbenVxeGrid } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';
import { getEnabledFrontendModules } from '@levin/admin-framework/framework-commons/app/options';
import { buildModuleSyncMenuPayload } from '@levin/admin-framework/framework-commons/app/utils/sync-menu-routes';
import {
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Popconfirm,
  Tooltip,
} from 'ant-design-vue';

import {
  countSyncMenuItems,
  flattenSyncMenuItems,
  isSyncMenuRowIndeterminate,
  removeSyncMenuItemByKey,
  syncAncestorKeysFromLeaves,
  toEditableSyncMenuItems,
  toggleSyncMenuTreeKeys,
  toSelectedSyncMenuItems,
} from './sync-menu-routes-state';

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
const menuList = ref<EditableSyncMenuItem[]>([]);
const selectedKeys = ref<Set<string>>(new Set());
const optionKeys = ref<Record<SyncMenuBooleanField, Set<string>>>({
  enable: new Set(),
  overrideExisting: new Set(),
});

const gridOptions: VxeGridProps<EditableSyncMenuItem> = {
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
      fixed: 'left',
      field: 'label',
      minWidth: 300,
      slots: { default: 'label' },
      title: '名称',
      treeNode: true,
    },
    {
      align: 'left',
      field: 'path',
      headerAlign: 'left',
      minWidth: 320,
      slots: { default: 'path' },
      title: '路由',
    },
    {
      field: 'moduleId',
      minWidth: 180,
      slots: { default: 'moduleId' },
      title: '模块ID',
    },
    {
      field: 'opButtonList',
      minWidth: 132,
      slots: { default: 'pageOperations' },
      title: '页面操作权限',
    },
    {
      field: 'remark',
      minWidth: 260,
      slots: { default: 'remark' },
      title: '备注',
    },
    {
      field: 'viewPath',
      minWidth: 360,
      slots: { default: 'viewPath' },
      title: '页面注册路径',
    },
    {
      field: 'sourceFilePath',
      minWidth: 360,
      slots: { default: 'sourceFilePath' },
      title: '源码位置',
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 100,
    },
  ],
  data: menuList.value,
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

const [Grid, gridApi] = useVbenVxeGrid<EditableSyncMenuItem>({
  gridOptions,
  showSearchForm: false,
});

const totalCount = computed(() => countSyncMenuItems(menuList.value));
const selectedCount = computed(() => selectedKeys.value.size);
const allSelected = computed(
  () => totalCount.value > 0 && selectedCount.value === totalCount.value,
);
const partiallySelected = computed(
  () => selectedCount.value > 0 && !allSelected.value,
);
const allOverrideExistingSelected = computed(
  () =>
    totalCount.value > 0 &&
    optionKeys.value.overrideExisting.size === totalCount.value,
);
const partiallyOverrideExistingSelected = computed(
  () =>
    optionKeys.value.overrideExisting.size > 0 &&
    optionKeys.value.overrideExisting.size < totalCount.value,
);
const allEnableSelected = computed(
  () =>
    totalCount.value > 0 && optionKeys.value.enable.size === totalCount.value,
);
const partiallyEnableSelected = computed(
  () =>
    optionKeys.value.enable.size > 0 &&
    optionKeys.value.enable.size < totalCount.value,
);
const openProxy = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

function resetMenuList() {
  menuList.value = toEditableSyncMenuItems(
    buildModuleSyncMenuPayload(getEnabledFrontendModules()).menuList,
  );
  selectedKeys.value = new Set(
    flattenSyncMenuItems(menuList.value).map((item) => item.key),
  );
  optionKeys.value = {
    enable: new Set(),
    overrideExisting: new Set(),
  };
}

function readCheckboxChecked(event: { target?: { checked?: boolean } }) {
  return Boolean(event.target?.checked);
}

function handleToggleAll(checked: boolean) {
  selectedKeys.value = checked
    ? new Set(flattenSyncMenuItems(menuList.value).map((item) => item.key))
    : new Set();
}

function handleToggleRow(record: EditableSyncMenuItem, checked: boolean) {
  selectedKeys.value = toggleSyncMenuTreeKeys(
    menuList.value,
    selectedKeys.value,
    record,
    checked,
  );
}

function handleToggleOptionAll(field: SyncMenuBooleanField, checked: boolean) {
  optionKeys.value = {
    ...optionKeys.value,
    [field]: checked
      ? new Set(flattenSyncMenuItems(menuList.value).map((item) => item.key))
      : new Set(),
  };
}

function handleToggleOptionRow(
  field: SyncMenuBooleanField,
  record: EditableSyncMenuItem,
  checked: boolean,
) {
  optionKeys.value = {
    ...optionKeys.value,
    [field]: toggleSyncMenuTreeKeys(
      menuList.value,
      optionKeys.value[field],
      record,
      checked,
    ),
  };
}

function handleDelete(record: EditableSyncMenuItem) {
  menuList.value = removeSyncMenuItemByKey(menuList.value, record.key);
  const availableKeys = new Set(
    flattenSyncMenuItems(menuList.value).map((item) => item.key),
  );

  selectedKeys.value = syncAncestorKeysFromLeaves(
    menuList.value,
    new Set([...selectedKeys.value].filter((key) => availableKeys.has(key))),
  );
  optionKeys.value = {
    enable: syncAncestorKeysFromLeaves(
      menuList.value,
      new Set(
        [...optionKeys.value.enable].filter((key) => availableKeys.has(key)),
      ),
    ),
    overrideExisting: syncAncestorKeysFromLeaves(
      menuList.value,
      new Set(
        [...optionKeys.value.overrideExisting].filter((key) =>
          availableKeys.has(key),
        ),
      ),
    ),
  };
}

async function handleSubmit() {
  const payload = {
    menuList: toSelectedSyncMenuItems(
      menuList.value,
      selectedKeys.value,
      optionKeys.value,
    ),
  };

  if (payload.menuList.length === 0) {
    message.warning('请先选择要上传的页面路由');
    return;
  }

  loading.value = true;
  try {
    const menuSyncService = getAdminMenuSyncService();
    if (!menuSyncService) {
      message.warning('当前应用没有配置菜单同步服务');
      return;
    }

    await menuSyncService.syncMenu(payload);
    message.success('上传页面路由成功');
    openProxy.value = false;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetMenuList();
    }
  },
  {
    immediate: true,
  },
);

watch(menuList, (data) => {
  gridApi.setGridOptions({ data });
});
</script>

<template>
  <Modal
    v-model:open="openProxy"
    :confirm-loading="loading"
    :body-style="{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }"
    :mask-closable="false"
    :ok-button-props="{ disabled: selectedCount === 0 }"
    ok-text="上传"
    title="上传页面路由"
    width="85vw"
    @ok="handleSubmit"
  >
    <div class="text-muted-foreground mb-3 text-sm">
      共
      {{ totalCount }}
      个已启用前端模块的本地页面路由，已选择
      {{ selectedCount }}
      个。可在上传前修改名称、备注，或删除不需要同步的路由菜单。
    </div>

    <Grid class="sync-menu-route-tree-grid">
      <template #selectHeader>
        <div class="sync-menu-route-option-header">
          <span>是否上传</span>
          <Checkbox
            :checked="allSelected"
            :indeterminate="partiallySelected"
            @change="handleToggleAll(readCheckboxChecked($event))"
          />
        </div>
      </template>
      <template #select="{ row }">
        <Checkbox
          :checked="selectedKeys.has(row.key)"
          :indeterminate="isSyncMenuRowIndeterminate(row, selectedKeys)"
          @change="handleToggleRow(row, readCheckboxChecked($event))"
        />
      </template>
      <template #overrideExistingHeader>
        <div class="sync-menu-route-option-header">
          <span>是否覆盖</span>
          <Checkbox
            :checked="allOverrideExistingSelected"
            :indeterminate="partiallyOverrideExistingSelected"
            @change="
              handleToggleOptionAll(
                'overrideExisting',
                readCheckboxChecked($event),
              )
            "
          />
        </div>
      </template>
      <template #overrideExisting="{ row }">
        <Checkbox
          :checked="optionKeys.overrideExisting.has(row.key)"
          :indeterminate="
            isSyncMenuRowIndeterminate(row, optionKeys.overrideExisting)
          "
          @change="
            handleToggleOptionRow(
              'overrideExisting',
              row,
              readCheckboxChecked($event),
            )
          "
        />
      </template>
      <template #enableHeader>
        <div class="sync-menu-route-option-header">
          <span>是否启用</span>
          <Checkbox
            :checked="allEnableSelected"
            :indeterminate="partiallyEnableSelected"
            @change="
              handleToggleOptionAll('enable', readCheckboxChecked($event))
            "
          />
        </div>
      </template>
      <template #enable="{ row }">
        <Checkbox
          :checked="optionKeys.enable.has(row.key)"
          :indeterminate="isSyncMenuRowIndeterminate(row, optionKeys.enable)"
          @change="
            handleToggleOptionRow('enable', row, readCheckboxChecked($event))
          "
        />
      </template>
      <template #label="{ row }">
        <Input v-model:value="row.label" placeholder="请输入名称" />
      </template>
      <template #path="{ row }">
        <span class="font-mono text-xs">{{ row.path }}</span>
      </template>
      <template #moduleId="{ row }">
        <span class="font-mono text-xs">{{ row.moduleId }}</span>
      </template>
      <template #pageOperations="{ row }">
        <Tooltip
          v-if="row.opButtonList?.length"
          overlay-class-name="sync-menu-operation-tooltip"
          placement="right"
        >
          <template #title>
            <div class="sync-menu-operation-tooltip-content">
              <div
                v-for="operation in row.opButtonList"
                :key="operation.opName"
                class="sync-menu-operation-tooltip-item"
              >
                <div class="sync-menu-operation-tooltip-label">
                  {{ operation.label || operation.opName }}
                </div>
                <div class="sync-menu-operation-tooltip-name">
                  {{ operation.opName }}
                </div>
                <div
                  v-if="operation.requireAuthorizations?.length"
                  class="sync-menu-operation-tooltip-permissions"
                >
                  <span
                    v-for="permission in operation.requireAuthorizations"
                    :key="permission"
                  >
                    {{ permission }}
                  </span>
                </div>
                <div v-else class="sync-menu-operation-tooltip-empty">
                  无额外资源权限
                </div>
              </div>
            </div>
          </template>
          <Button size="small" type="link">
            {{ row.opButtonList.length }} 项操作
          </Button>
        </Tooltip>
        <span v-else class="text-muted-foreground">—</span>
      </template>
      <template #remark="{ row }">
        <Input v-model:value="row.remark" placeholder="请输入备注" />
      </template>
      <template #viewPath="{ row }">
        <span class="font-mono text-xs">
          {{ row.viewPath || '目录节点（无页面）' }}
        </span>
      </template>
      <template #sourceFilePath="{ row }">
        <span class="font-mono text-xs">
          {{ row.sourceFilePath || '目录节点（无页面）' }}
        </span>
      </template>
      <template #actions="{ row }">
        <Popconfirm
          title="确认删除该页面及其子页面？"
          @confirm="handleDelete(row)"
        >
          <Button danger size="small" type="link">删除</Button>
        </Popconfirm>
      </template>
    </Grid>
  </Modal>
</template>

<style scoped>
.sync-menu-route-tree-grid :deep(.vxe-grid) {
  border-radius: 8px;
}

.sync-menu-route-option-header {
  align-items: center;
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
}

:global(.sync-menu-operation-tooltip) {
  max-width: min(560px, 70vw);
}

.sync-menu-operation-tooltip-content {
  display: grid;
  gap: 8px;
  padding: 2px;
}

.sync-menu-operation-tooltip-item {
  border-bottom: 1px solid rgb(255 255 255 / 20%);
  display: grid;
  gap: 2px;
  padding-bottom: 8px;
}

.sync-menu-operation-tooltip-item:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.sync-menu-operation-tooltip-label {
  font-weight: 600;
}

.sync-menu-operation-tooltip-name,
.sync-menu-operation-tooltip-permissions {
  color: rgb(255 255 255 / 72%);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.sync-menu-operation-tooltip-permissions {
  display: grid;
  gap: 2px;
  overflow-wrap: anywhere;
}

.sync-menu-operation-tooltip-empty {
  color: rgb(255 255 255 / 60%);
  font-size: 12px;
}
</style>
