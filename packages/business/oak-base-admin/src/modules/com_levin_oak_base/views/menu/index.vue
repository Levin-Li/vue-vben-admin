<script lang="ts" setup>
import type { VxeTableGridOptions } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';

import type { MenuRecord, SelectOption } from './types';

import { computed, h, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, Modal, Space, Tag, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { menuService } from '../../api/menu-service';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { moduleFetchEnumOptions } from '@levin/oak-base-admin/modules/com_levin_oak_base/views/api-module';

import {
  fallbackActionTypeOptions,
  fallbackPageTypeOptions,
  useColumns,
} from './data';
import MenuFormDrawer from './menu-form-drawer.vue';
import {
  buildMenuTree,
  collectMenuSubtreeIds,
  collectMenuSubtreeIdsFromRows,
  normalizeMenuTree,
  toMenuFormRecord,
} from './menu-tree-utils';

const pageTypeOptions = ref<SelectOption[]>(fallbackPageTypeOptions);
const actionTypeOptions = ref<SelectOption[]>(fallbackActionTypeOptions);
const menuTree = ref<MenuRecord[]>([]);
const currentRecord = ref<MenuRecord | null>(null);
const formOpen = ref(false);
const selectedMenuRows = ref<MenuRecord[]>([]);
const route = useRoute();
const { hasPermission } = useRbacAccess();

const batchDeleteMenuPermission = buildApiMethodPermissions(
  menuService,
  'batchDelete',
);
const createMenuPermission = buildApiMethodPermissions(menuService, 'create');
const updateMenuPermission = buildApiMethodPermissions(menuService, 'update');
const canBatchDeleteMenu = computed(() =>
  hasPermission(batchDeleteMenuPermission),
);
const canCreateMenu = computed(() => hasPermission(createMenuPermission));
const canUpdateMenu = computed(() => hasPermission(updateMenuPermission));

const [Grid, gridApi] = useVbenVxeGrid({
  gridEvents: {
    checkboxAll: updateSelectedMenuRows,
    checkboxChange: updateSelectedMenuRows,
  },
  gridOptions: {
    checkboxConfig: {
      checkMethod: ({ row }) => !!row.id,
      highlight: true,
    },
    columns: useColumns(),
    customConfig: {
      storage: {
        fixed: true,
        visible: true,
      },
    },
    height: 'auto',
    id: route.path,
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          const tree = await loadMenuTree();
          menuTree.value = tree;
          return tree;
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    scrollY: {
      enabled: false,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    treeConfig: {
      parentField: 'parentId',
      rowField: 'id',
      transform: false,
    },
  } as VxeTableGridOptions<MenuRecord>,
});

onMounted(() => {
  loadEnumOptions();
});

function normalizeOptions(options: any[], fallback: SelectOption[]) {
  if (!Array.isArray(options) || options.length === 0) {
    return fallback;
  }

  return options.map((item) => ({
    label: item.label || item.name || item.value || String(item),
    value: item.value ?? item.name ?? item.label,
  }));
}

async function loadEnumOptions() {
  const [pageTypes, actionTypes] = await Promise.allSettled([
    moduleFetchEnumOptions('com.levin.oak.base.entities.Menu$PageType'),
    moduleFetchEnumOptions('com.levin.commons.rbac.MenuItem$ActionType'),
  ]);

  if (pageTypes.status === 'fulfilled') {
    pageTypeOptions.value = normalizeOptions(
      pageTypes.value,
      fallbackPageTypeOptions,
    );
  }
  if (actionTypes.status === 'fulfilled') {
    actionTypeOptions.value = normalizeOptions(
      actionTypes.value,
      fallbackActionTypeOptions,
    );
  }
}

function normalizeAuthorizedMenuList(data: any): MenuRecord[] {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.items || data?.records || data?.list || [];
}

async function loadMenuTree() {
  const data = await rbacService.getAuthorizedMenuList();
  const items = normalizeAuthorizedMenuList(data);

  if (
    items.some((item) => Array.isArray(item.children) && item.children.length)
  ) {
    return normalizeMenuTree(items);
  }

  return buildMenuTree(items);
}

function refresh() {
  gridApi.grid?.clearCheckboxRow?.();
  selectedMenuRows.value = [];
  gridApi.query();
}

function openCreate(parentId = '') {
  if (!canCreateMenu.value) {
    message.warning('当前账号没有新增菜单权限');
    return;
  }

  currentRecord.value = {
    actionType: 'Default',
    alwaysShow: false,
    editable: true,
    enable: true,
    opButtonList: [],
    orderCode: 100,
    pageType: 'LocalPage',
    parentId,
    requireAuthorizations: [],
  };
  formOpen.value = true;
}

function openEdit(row: MenuRecord) {
  if (!canUpdateMenu.value) {
    message.warning('当前账号没有编辑菜单权限');
    return;
  }

  currentRecord.value = toMenuFormRecord(row);
  formOpen.value = true;
}

function deleteRow(row: MenuRecord) {
  if (!canBatchDeleteMenu.value) {
    message.warning('当前账号没有批量删除菜单权限');
    return;
  }

  const idList = collectMenuSubtreeIds(row);
  const childCount = Math.max(idList.length - 1, 0);

  if (idList.length === 0) {
    message.warning('未找到可删除的菜单 ID');
    return;
  }

  Modal.confirm({
    content: childCount
      ? `确定删除菜单「${row.name || row.id}」及其 ${childCount} 个子菜单吗？`
      : `确定删除菜单「${row.name || row.id}」吗？`,
    okButtonProps: { danger: true },
    okText: '删除',
    title: '删除菜单',
    async onOk() {
      await menuService.batchDelete({ idList });
      message.success('菜单删除成功');
      refresh();
    },
  });
}

function getSelectedMenuRows() {
  const records = gridApi.grid?.getCheckboxRecords?.();
  if (Array.isArray(records)) {
    return records as MenuRecord[];
  }

  return selectedMenuRows.value;
}

function updateSelectedMenuRows(event?: { records?: MenuRecord[] }) {
  selectedMenuRows.value = Array.isArray(event?.records)
    ? event.records
    : getSelectedMenuRows();
}

function deleteSelectedRows() {
  if (!canBatchDeleteMenu.value) {
    message.warning('当前账号没有批量删除菜单权限');
    return;
  }

  const selectedRows = getSelectedMenuRows();
  const idList = collectMenuSubtreeIdsFromRows(selectedRows);

  if (selectedRows.length === 0 || idList.length === 0) {
    message.warning('请先选择要删除的菜单');
    return;
  }

  Modal.confirm({
    content:
      `确定删除选中的 ${selectedRows.length} 个菜单吗？` +
      `包含子菜单后共 ${idList.length} 个菜单将被删除。`,
    okButtonProps: { danger: true },
    okText: '删除',
    title: '批量删除菜单',
    async onOk() {
      await menuService.batchDelete({ idList });
      message.success(`已删除 ${idList.length} 个菜单`);
      refresh();
    },
  });
}

function renderIcon(row: MenuRecord) {
  const icon = row.icon || 'lucide:menu';
  return h(IconifyIcon, { class: 'size-4', icon });
}
</script>

<template>
  <Page
    auto-content-height
    content-class="!bg-transparent !p-0 min-w-0 !overflow-hidden"
  >
    <MenuFormDrawer
      v-model:open="formOpen"
      :action-type-options="actionTypeOptions"
      :menu-tree="menuTree"
      :page-type-options="pageTypeOptions"
      :record="currentRecord"
      @success="refresh"
    />

    <div class="vben-menu-page h-full min-w-0">
      <div class="vben-menu-section flex h-full min-h-0 flex-col">
        <Grid>
          <template #toolbar-tools>
            <Space>
              <Button
                v-if="canBatchDeleteMenu"
                danger
                @click="deleteSelectedRows"
              >
                <IconifyIcon class="size-4" icon="lucide:trash-2" />
                批量删除
                <span v-if="selectedMenuRows.length">
                  ({{ selectedMenuRows.length }})
                </span>
              </Button>
              <Button
                v-if="canCreateMenu"
                type="primary"
                @click="openCreate('')"
              >
                <Plus class="size-5" />
                新增菜单
              </Button>
            </Space>
          </template>

          <template #title="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <component :is="renderIcon(row)" />
              <span class="truncate font-medium">
                {{ row.name || row.label || row.path || row.id || '-' }}
              </span>
              <span
                v-if="row.label && row.label !== row.name"
                class="text-muted-foreground"
              >
                {{ row.label }}
              </span>
            </div>
          </template>

          <template #opButtons="{ row }">
            <div
              v-if="row.opButtonList?.length"
              class="flex max-w-[360px] flex-wrap gap-1"
            >
              <Tag
                v-for="button in row.opButtonList"
                :key="`${button.label}-${button.apiUrl}`"
              >
                {{ button.label || button.apiUrl || '未命名按钮' }}
              </Tag>
            </div>
            <span v-else class="text-muted-foreground">-</span>
          </template>

          <template #operation="{ row }">
            <div class="flex justify-end gap-2">
              <Button
                v-if="canCreateMenu"
                size="small"
                type="link"
                @click="openCreate(row.id || '')"
              >
                新增下级
              </Button>
              <Button
                v-if="canUpdateMenu"
                size="small"
                type="link"
                @click="openEdit(row)"
              >
                编辑
              </Button>
              <Button
                v-if="canBatchDeleteMenu"
                danger
                size="small"
                type="link"
                @click="deleteRow(row)"
              >
                删除
              </Button>
            </div>
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.vben-menu-section {
  min-width: 0;
  padding: 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.vben-menu-section :deep(.vxe-grid) {
  height: 100% !important;
  min-height: 0;
  padding: 0;
}

.vben-menu-section :deep(.vxe-body--y-space) {
  display: none !important;
  height: 0 !important;
}

.vben-menu-section :deep(.vxe-table--body) {
  margin-top: 0 !important;
  transform: translate(0, 0) !important;
}
</style>
