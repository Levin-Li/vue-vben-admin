<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import type { SyncMenuItem } from '#/api/com_levin_oak_base/menu';

import { computed, ref, watch } from 'vue';

import { Button, Input, message, Modal, Popconfirm } from 'ant-design-vue';

import { menuService } from '#/api/com_levin_oak_base/menu';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { accessRoutes } from '#/router/routes';
import { buildSyncMenuPayload } from '#/utils/sync-menu-routes';

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

const gridOptions: VxeGridProps<EditableSyncMenuItem> = {
  columns: [
    {
      field: 'label',
      minWidth: 300,
      slots: { default: 'label' },
      title: '名称',
      treeNode: true,
    },
    {
      field: 'path',
      minWidth: 320,
      slots: { default: 'path' },
      title: '路由',
    },
    {
      field: 'remark',
      minWidth: 260,
      slots: { default: 'remark' },
      title: '备注',
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
  height: 'min(56vh, 520px)',
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

function toSyncItems(list: EditableSyncMenuItem[]): SyncMenuItem[] {
  return list.map(({ children, key: _key, ...item }) => ({
    ...item,
    children: toSyncItems(children || []),
  }));
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

function resetMenuList() {
  menuList.value = toEditableItems(buildSyncMenuPayload(accessRoutes).menuList);
}

function handleDelete(record: EditableSyncMenuItem) {
  menuList.value = removeItemByKey(menuList.value, record.key);
}

async function handleSubmit() {
  const payload = {
    menuList: toSyncItems(menuList.value),
  };

  if (payload.menuList.length === 0) {
    message.warning('没有可上传的本地页面路由');
    return;
  }

  loading.value = true;
  try {
    await menuService.syncMenu(payload);
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
);

watch(menuList, (data) => {
  gridApi.setGridOptions({ data });
});
</script>

<template>
  <Modal
    v-model:open="openProxy"
    :confirm-loading="loading"
    :ok-button-props="{ disabled: totalCount === 0 }"
    ok-text="上传"
    title="上传页面路由"
    width="min(92vw, 1080px)"
    @ok="handleSubmit"
  >
    <div class="mb-3 text-sm text-muted-foreground">
      共 {{ totalCount }} 个本地页面路由。可在上传前修改名称、备注，或删除不需要同步的页面。
    </div>

    <Grid class="sync-menu-route-tree-grid">
      <template #label="{ row }">
        <Input v-model:value="row.label" placeholder="请输入名称" />
      </template>
      <template #path="{ row }">
        <span class="font-mono text-xs">{{ row.path }}</span>
      </template>
      <template #remark="{ row }">
        <Input v-model:value="row.remark" placeholder="请输入备注" />
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
