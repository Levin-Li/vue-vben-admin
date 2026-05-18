<script lang="ts" setup>
import type { VxeGridProps } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';

import type { SyncMenuItem } from '@levin/admin-framework/framework-commons/app/utils/sync-menu-routes';

import { computed, ref, watch } from 'vue';

import {
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Popconfirm,
} from 'ant-design-vue';

import { getAdminMenuSyncService } from '@levin/admin-framework';
import { useVbenVxeGrid } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';
import { getEnabledFrontendModules } from '@levin/admin-framework/framework-commons/app/options';
import { buildModuleSyncMenuPayload } from '@levin/admin-framework/framework-commons/app/utils/sync-menu-routes';

type EditableSyncMenuItem = SyncMenuItem & {
  children?: EditableSyncMenuItem[];
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
const menuList = ref<EditableSyncMenuItem[]>([]);
const selectedKeys = ref<Set<string>>(new Set());

const gridOptions: VxeGridProps<EditableSyncMenuItem> = {
  columns: [
    {
      align: 'center',
      fixed: 'left',
      slots: { default: 'select', header: 'selectHeader' },
      width: 48,
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

const totalCount = computed(() => countItems(menuList.value));
const selectedCount = computed(() => selectedKeys.value.size);
const allSelected = computed(
  () => totalCount.value > 0 && selectedCount.value === totalCount.value,
);
const partiallySelected = computed(
  () => selectedCount.value > 0 && !allSelected.value,
);
const openProxy = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

function countItems(list: EditableSyncMenuItem[]): number {
  return list.reduce(
    (total, item) => total + 1 + countItems(item.children || []),
    0,
  );
}

function flattenItems(list: EditableSyncMenuItem[]): EditableSyncMenuItem[] {
  return list.flatMap((item) => [item, ...flattenItems(item.children || [])]);
}

function toEditableItems(
  list: SyncMenuItem[],
  keyPrefix = 'route',
): EditableSyncMenuItem[] {
  return list.map((item, index) => {
    const key = `${keyPrefix}-${index}`;
    return {
      ...item,
      children: toEditableItems(item.children || [], key),
      key,
    };
  });
}

function toSelectedSyncItems(
  list: EditableSyncMenuItem[],
  selectedKeys: Set<string>,
): SyncMenuItem[] {
  return list.flatMap(({ children, key, ...item }) => {
    const selectedChildren = toSelectedSyncItems(children || [], selectedKeys);

    if (!selectedKeys.has(key) && selectedChildren.length === 0) {
      return [];
    }

    return [
      {
        ...item,
        children: selectedChildren,
      },
    ];
  });
}

function removeItemByKey(
  list: EditableSyncMenuItem[],
  key: string,
): EditableSyncMenuItem[] {
  return list
    .filter((item) => item.key !== key)
    .map((item) => ({
      ...item,
      children: removeItemByKey(item.children || [], key),
    }));
}

function getSelfAndDescendantKeys(item: EditableSyncMenuItem): string[] {
  return [
    item.key,
    ...flattenItems(item.children || []).map((child) => child.key),
  ];
}

function syncAncestorSelectionFromLeaves(keys: Set<string>) {
  function syncNodeFromLeaves(item: EditableSyncMenuItem) {
    const children = item.children || [];

    if (children.length === 0) {
      return keys.has(item.key);
    }

    const allChildrenChecked = children.map(syncNodeFromLeaves).every(Boolean);

    if (allChildrenChecked) {
      keys.add(item.key);
    } else {
      keys.delete(item.key);
    }

    return keys.has(item.key);
  }

  menuList.value.forEach(syncNodeFromLeaves);
  return keys;
}

function resetMenuList() {
  menuList.value = toEditableItems(
    buildModuleSyncMenuPayload(getEnabledFrontendModules()).menuList,
  );
  selectedKeys.value = new Set(
    flattenItems(menuList.value).map((item) => item.key),
  );
}

function readCheckboxChecked(event: { target?: { checked?: boolean } }) {
  return Boolean(event.target?.checked);
}

function handleToggleAll(checked: boolean) {
  selectedKeys.value = checked
    ? new Set(flattenItems(menuList.value).map((item) => item.key))
    : new Set();
}

function handleToggleRow(record: EditableSyncMenuItem, checked: boolean) {
  const nextKeys = new Set(selectedKeys.value);
  const targetKeys = getSelfAndDescendantKeys(record);

  targetKeys.forEach((key) => {
    if (checked) {
      nextKeys.add(key);
    } else {
      nextKeys.delete(key);
    }
  });

  selectedKeys.value = syncAncestorSelectionFromLeaves(nextKeys);
}

function handleDelete(record: EditableSyncMenuItem) {
  menuList.value = removeItemByKey(menuList.value, record.key);
  const availableKeys = new Set(
    flattenItems(menuList.value).map((item) => item.key),
  );

  selectedKeys.value = syncAncestorSelectionFromLeaves(
    new Set([...selectedKeys.value].filter((key) => availableKeys.has(key))),
  );
}

function hasSelectedChild(record: EditableSyncMenuItem): boolean {
  return (record.children || []).some(
    (child) => selectedKeys.value.has(child.key) || hasSelectedChild(child),
  );
}

function isRowIndeterminate(record: EditableSyncMenuItem) {
  return !selectedKeys.value.has(record.key) && hasSelectedChild(record);
}

async function handleSubmit() {
  const payload = {
    menuList: toSelectedSyncItems(menuList.value, selectedKeys.value),
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
    :ok-button-props="{ disabled: selectedCount === 0 }"
    ok-text="上传"
    title="上传页面路由"
    width="min(94vw, 1280px)"
    @ok="handleSubmit"
  >
    <div class="text-muted-foreground mb-3 text-sm">
      共
      {{ totalCount }}
      个已启用前端模块的本地页面路由，已选择
      {{ selectedCount }}
      个。可在上传前修改名称、备注，或删除不需要同步的页面。
    </div>

    <Grid class="sync-menu-route-tree-grid">
      <template #selectHeader>
        <Checkbox
          :checked="allSelected"
          :indeterminate="partiallySelected"
          @change="handleToggleAll(readCheckboxChecked($event))"
        />
      </template>
      <template #select="{ row }">
        <Checkbox
          :checked="selectedKeys.has(row.key)"
          :indeterminate="isRowIndeterminate(row)"
          @change="handleToggleRow(row, readCheckboxChecked($event))"
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
      <template #remark="{ row }">
        <Input v-model:value="row.remark" placeholder="请输入备注" />
      </template>
      <template #viewPath="{ row }">
        <span class="font-mono text-xs">{{ row.viewPath || '-' }}</span>
      </template>
      <template #sourceFilePath="{ row }">
        <span class="font-mono text-xs">{{ row.sourceFilePath || '-' }}</span>
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
  border-radius: 10px;
}
</style>
