<script lang="ts" setup>
import type { RbacModuleNode } from '@levin/admin-framework/framework-commons/shared/data-permission-types';
import type { VxeTableGridOptions } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';

import type { MenuOpButton, MenuRecord, SelectOption } from './types';

import { computed, h, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  Modal,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '@levin/admin-framework/framework-commons/app/adapter/vxe-table';
import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { useRbacAccess } from '@levin/admin-framework/framework-commons/rbac-access';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import ResourcePermissionTreeEditor from '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue';
import { menuService } from '../../api/menu-service';
import { moduleFetchEnumOptions } from '@levin/oak-base-admin/modules/com_levin_oak_base/views/api-module';

import {
  fallbackActionTypeOptions,
  fallbackPageTypeOptions,
  useColumns,
} from './data';
import {
  getOpButtonCount,
  getRequireAuthorizationCount,
} from './action-counts';
import MenuFormDrawer from './menu-form-drawer.vue';
import OpButtonEditor from './op-button-editor.vue';
import {
  buildMenuTree,
  collectMenuSubtreeIds,
  collectMenuSubtreeIdsFromRows,
  getMenuParentId,
  normalizeMenuTree,
  sortMenuRows,
  toMenuFormRecord,
} from './menu-tree-utils';

type MenuMoveDirection = 'down' | 'up';

const pageTypeOptions = ref<SelectOption[]>(fallbackPageTypeOptions);
const actionTypeOptions = ref<SelectOption[]>(fallbackActionTypeOptions);
const menuTree = ref<MenuRecord[]>([]);
const currentRecord = ref<MenuRecord | null>(null);
const formOpen = ref(false);
const opButtonOpen = ref(false);
const opButtonRecord = ref<MenuRecord | null>(null);
const opButtonRows = ref<MenuOpButton[]>([]);
const opButtonSubmitting = ref(false);
const permissionModules = ref<RbacModuleNode[]>([]);
const permissionLoading = ref(false);
const permissionOpen = ref(false);
const permissionRecord = ref<MenuRecord | null>(null);
const permissionSelection = ref<string[]>([]);
const permissionSubmitting = ref(false);
const selectedMenuRows = ref<MenuRecord[]>([]);
const enableSwitchLoadingId = ref('');
const menuOrderLoadingKey = ref('');
const publicAccessSwitchLoadingId = ref('');
const route = useRoute();
const { hasPermission } = useRbacAccess();
const MENU_PERMISSION_MODULE_ID = '__menus__';
const MENU_ORDER_MAX = 2_147_483_647;
const MENU_ORDER_MIN = -2_147_483_648;
const MENU_ORDER_STEP = 100;

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
const opButtonModalTitle = computed(() =>
  opButtonRecord.value?.name
    ? `页面操作 - ${opButtonRecord.value.name}`
    : '页面操作',
);
const permissionModalTitle = computed(() =>
  permissionRecord.value?.name
    ? `所需权限 - ${permissionRecord.value.name}`
    : '所需权限',
);

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
  const data = await rbacService.getAuthorizedMenuList({ loadAll: true });
  const items = normalizeAuthorizedMenuList(data);

  if (
    items.some((item) => Array.isArray(item.children) && item.children.length)
  ) {
    return normalizeMenuTree(items);
  }

  return buildMenuTree(items);
}

async function clearMenuCacheSilently() {
  try {
    await menuService.clearCache();
  } catch (error) {
    console.warn('清除菜单缓存失败，列表将继续从维护接口刷新', error);
  }
}

function refresh() {
  gridApi.grid?.clearCheckboxRow?.();
  selectedMenuRows.value = [];
  gridApi.query();
}

function findMenuById(rows: MenuRecord[], id?: string): MenuRecord | undefined {
  if (!id) {
    return undefined;
  }

  for (const row of rows) {
    if (row.id === id) {
      return row;
    }

    const child = findMenuById(row.children || [], id);
    if (child) {
      return child;
    }
  }

  return undefined;
}

function getMenuSiblings(row: MenuRecord) {
  const parentId = getMenuParentId(row);

  if (!parentId) {
    return menuTree.value;
  }

  return findMenuById(menuTree.value, parentId)?.children || [];
}

function getOrderedMenuSiblings(row: MenuRecord) {
  return sortMenuRows(getMenuSiblings(row)).filter((item) => item.id);
}

function getMoveTargetIndex(row: MenuRecord, direction: MenuMoveDirection) {
  const siblings = getOrderedMenuSiblings(row);
  const currentIndex = siblings.findIndex((item) => item.id === row.id);

  if (currentIndex < 0) {
    return { currentIndex, siblings, targetIndex: -1 };
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  return { currentIndex, siblings, targetIndex };
}

function canMoveMenu(row: MenuRecord, direction: MenuMoveDirection) {
  if (!canUpdateMenu.value || !row.id || menuOrderLoadingKey.value) {
    return false;
  }

  const { siblings, targetIndex } = getMoveTargetIndex(row, direction);

  return targetIndex >= 0 && targetIndex < siblings.length;
}

function getMoveLoadingKey(row: MenuRecord, direction: MenuMoveDirection) {
  return `${row.id || ''}:${direction}`;
}

function getMenuOrderCode(row?: MenuRecord) {
  return row?.orderCode ?? 0;
}

function getMenuOrderBetween(
  previousOrderCode: number | undefined,
  nextOrderCode: number | undefined,
) {
  if (previousOrderCode === undefined && nextOrderCode === undefined) {
    return MENU_ORDER_STEP;
  }

  if (previousOrderCode === undefined) {
    const candidate = (nextOrderCode || 0) - MENU_ORDER_STEP;
    return candidate >= MENU_ORDER_MIN ? candidate : undefined;
  }

  if (nextOrderCode === undefined) {
    const candidate = previousOrderCode + MENU_ORDER_STEP;
    return candidate <= MENU_ORDER_MAX ? candidate : undefined;
  }

  const gap = nextOrderCode - previousOrderCode;
  if (gap > 1) {
    return previousOrderCode + Math.floor(gap / 2);
  }

  return undefined;
}

function buildSingleMenuOrderUpdate(
  row: MenuRecord,
  direction: MenuMoveDirection,
) {
  const { currentIndex, siblings, targetIndex } = getMoveTargetIndex(
    row,
    direction,
  );

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    return undefined;
  }

  const previousBoundIndex =
    direction === 'up' ? targetIndex - 1 : targetIndex;
  const nextBoundIndex = direction === 'up' ? targetIndex : targetIndex + 1;
  const nextOrderCode = getMenuOrderBetween(
    previousBoundIndex >= 0
      ? getMenuOrderCode(siblings[previousBoundIndex])
      : undefined,
    nextBoundIndex < siblings.length
      ? getMenuOrderCode(siblings[nextBoundIndex])
      : undefined,
  );

  if (nextOrderCode === undefined || nextOrderCode === getMenuOrderCode(row)) {
    return undefined;
  }

  return {
    id: row.id,
    nextOrderCode,
    optimisticLock: row.optimisticLock,
    row,
  };
}

function buildMenuOrderUpdates(
  row: MenuRecord,
  direction: MenuMoveDirection,
) {
  const singleUpdate = buildSingleMenuOrderUpdate(row, direction);
  if (singleUpdate) {
    return [singleUpdate];
  }

  const { currentIndex, siblings, targetIndex } = getMoveTargetIndex(
    row,
    direction,
  );

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    return [];
  }

  const nextSiblings = [...siblings];
  [nextSiblings[currentIndex], nextSiblings[targetIndex]] = [
    nextSiblings[targetIndex],
    nextSiblings[currentIndex],
  ];

  const startIndex = Math.min(currentIndex, targetIndex);
  const previousOrderCode = Math.max(
    0,
    getMenuOrderCode(nextSiblings[startIndex - 1]),
  );

  return nextSiblings
    .slice(startIndex)
    .map((item, index) => ({
      id: item.id,
      nextOrderCode: previousOrderCode + (index + 1) * MENU_ORDER_STEP,
      optimisticLock: item.optimisticLock,
      row: item,
    }))
    .filter((item) => item.id && item.row.orderCode !== item.nextOrderCode);
}

async function moveMenu(row: MenuRecord, direction: MenuMoveDirection) {
  if (!canUpdateMenu.value) {
    message.warning('当前账号没有编辑菜单权限');
    return;
  }

  const updates = buildMenuOrderUpdates(row, direction);

  if (updates.length === 0) {
    message.info(direction === 'up' ? '已经是第一个菜单' : '已经是最后一个菜单');
    return;
  }

  const loadingKey = getMoveLoadingKey(row, direction);
  menuOrderLoadingKey.value = loadingKey;

  try {
    for (const item of updates) {
      await menuService.update({
        forceUpdateFields: ['orderCode'],
        id: item.id,
        optimisticLock: item.optimisticLock,
        orderCode: item.nextOrderCode,
      });
    }
    await clearMenuCacheSilently();
    message.success(direction === 'up' ? '菜单已上移' : '菜单已下移');
    refresh();
  } catch (error) {
    console.error(error);
    message.error('菜单排序更新失败，请刷新后重试');
  } finally {
    menuOrderLoadingKey.value = '';
  }
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

function openOpButtonEditor(row: MenuRecord) {
  if (!canUpdateMenu.value) {
    message.warning('当前账号没有编辑菜单权限');
    return;
  }

  opButtonRecord.value = row;
  opButtonRows.value = Array.isArray(row.opButtonList)
    ? row.opButtonList.map((item) => ({ ...item }))
    : [];
  opButtonOpen.value = true;
}

async function ensurePermissionModulesLoaded() {
  if (permissionModules.value.length > 0) {
    return;
  }

  permissionLoading.value = true;
  try {
    permissionModules.value = (
      ((await rbacService.fetchAuthorizedResourceModules()) ||
        []) as RbacModuleNode[]
    ).filter((item) => item.id !== MENU_PERMISSION_MODULE_ID);
  } catch (error) {
    console.error(error);
    message.error('加载资源权限列表失败');
  } finally {
    permissionLoading.value = false;
  }
}

async function openPermissionEditor(row: MenuRecord) {
  if (!canUpdateMenu.value) {
    message.warning('当前账号没有编辑菜单权限');
    return;
  }

  if (row.publicAccess) {
    message.info('公开访问菜单不需要配置所需权限');
    return;
  }

  permissionRecord.value = row;
  permissionSelection.value = [...(row.requireAuthorizations || [])];
  permissionOpen.value = true;
  await ensurePermissionModulesLoaded();
}

function closePermissionEditor() {
  permissionOpen.value = false;
  permissionRecord.value = null;
  permissionSelection.value = [];
}

function closeOpButtonEditor() {
  opButtonOpen.value = false;
  opButtonRecord.value = null;
  opButtonRows.value = [];
}

function cleanOpButtonList(value: MenuOpButton[]) {
  return (value || [])
    .map((item) => ({
      apiUrl: item.apiUrl?.trim() || undefined,
      disabled: Boolean(item.disabled),
      label: item.label?.trim() || undefined,
      remark: item.remark?.trim() || undefined,
      requireAuthorization: item.requireAuthorization?.trim() || undefined,
    }))
    .filter(
      (item) =>
        item.label ||
        item.apiUrl ||
        item.requireAuthorization ||
        item.remark ||
        item.disabled,
    );
}

function findInvalidOpButtonIndex(value: MenuOpButton[]) {
  return (value || []).findIndex(
    (item) => !String(item.requireAuthorization || '').trim(),
  );
}

function getPermissionActionName(permissionExpr?: null | string) {
  if (!permissionExpr) {
    return '';
  }

  const parts = String(permissionExpr).split(':');

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const value = parts[index]?.trim();
    if (value) {
      return value;
    }
  }

  return String(permissionExpr).trim();
}

function getOpButtonLabel(button: MenuOpButton) {
  return (
    button.label?.trim() ||
    button.name?.trim() ||
    getPermissionActionName(button.requireAuthorization) ||
    button.apiUrl?.trim() ||
    '未命名操作'
  );
}

async function submitOpButtonList() {
  const record = opButtonRecord.value;

  if (!record?.id) {
    message.warning('未找到可更新的菜单 ID');
    return;
  }

  const invalidIndex = findInvalidOpButtonIndex(opButtonRows.value);
  if (invalidIndex >= 0) {
    message.warning(`第 ${invalidIndex + 1} 行页面操作的需要权限不能为空`);
    return;
  }

  opButtonSubmitting.value = true;

  try {
    await menuService.update({
      forceUpdateFields: ['opButtonList'],
      id: record.id,
      opButtonList: cleanOpButtonList(opButtonRows.value),
      optimisticLock: record.optimisticLock,
    });
    await clearMenuCacheSilently();
    message.success('页面操作已更新');
    closeOpButtonEditor();
    refresh();
  } finally {
    opButtonSubmitting.value = false;
  }
}

async function submitRequireAuthorizations() {
  const record = permissionRecord.value;

  if (!record?.id) {
    message.warning('未找到可更新的菜单 ID');
    return;
  }

  permissionSubmitting.value = true;

  try {
    await menuService.update({
      forceUpdateFields: ['requireAuthorizations'],
      id: record.id,
      optimisticLock: record.optimisticLock,
      requireAuthorizations: [
        ...new Set(
          permissionSelection.value.map((item) => item.trim()).filter(Boolean),
        ),
      ],
    });
    await clearMenuCacheSilently();
    message.success('所需权限已更新');
    closePermissionEditor();
    refresh();
  } finally {
    permissionSubmitting.value = false;
  }
}

async function updateMenuPublicAccess(row: MenuRecord, checked: boolean) {
  if (!canUpdateMenu.value) {
    message.warning('当前账号没有编辑菜单权限');
    return;
  }

  const id = row.id;
  if (!id) {
    message.warning('未找到可更新的菜单 ID');
    return;
  }

  const previousValue = Boolean(row.publicAccess);
  publicAccessSwitchLoadingId.value = id;
  row.publicAccess = checked;

  try {
    await menuService.update({
      forceUpdateFields: ['publicAccess'],
      id,
      optimisticLock: row.optimisticLock,
      publicAccess: checked,
    });
    await clearMenuCacheSilently();
    message.success('公开访问状态已更新');
    refresh();
  } catch (error) {
    row.publicAccess = previousValue;
    console.error(error);
    message.error('公开访问状态更新失败');
  } finally {
    publicAccessSwitchLoadingId.value = '';
  }
}

async function updateMenuEnable(row: MenuRecord, checked: boolean) {
  if (!canUpdateMenu.value) {
    message.warning('当前账号没有编辑菜单权限');
    return;
  }

  const id = row.id;
  if (!id) {
    message.warning('未找到可更新的菜单 ID');
    return;
  }

  const previousValue = row.enable ?? true;
  enableSwitchLoadingId.value = id;
  row.enable = checked;

  try {
    await menuService.update({
      enable: checked,
      forceUpdateFields: ['enable'],
      id,
      optimisticLock: row.optimisticLock,
    });
    await clearMenuCacheSilently();
    message.success('菜单状态已更新');
    refresh();
  } catch (error) {
    row.enable = previousValue;
    console.error(error);
    message.error('菜单状态更新失败');
  } finally {
    enableSwitchLoadingId.value = '';
  }
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
      await clearMenuCacheSilently();
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
      await clearMenuCacheSilently();
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

    <Modal
      :confirm-loading="opButtonSubmitting"
      :open="opButtonOpen"
      :title="opButtonModalTitle"
      width="min(76vw, 1180px)"
      @cancel="closeOpButtonEditor"
      @ok="submitOpButtonList"
    >
      <OpButtonEditor v-model:value="opButtonRows" />
    </Modal>

    <Modal
      :confirm-loading="permissionSubmitting"
      :open="permissionOpen"
      :title="permissionModalTitle"
      :width="1080"
      destroy-on-close
      @cancel="closePermissionEditor"
      @ok="submitRequireAuthorizations"
    >
      <div class="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
        <Spin :spinning="permissionLoading">
          <ResourcePermissionTreeEditor
            v-model:value="permissionSelection"
            :modules="permissionModules"
          />
        </Spin>
      </div>
    </Modal>

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
            <div class="menu-title-cell">
              <div class="menu-title-content">
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
              <div v-if="canUpdateMenu" class="menu-title-order-actions">
                <Tooltip title="上移">
                  <Button
                    :disabled="!canMoveMenu(row, 'up')"
                    :loading="
                      menuOrderLoadingKey === getMoveLoadingKey(row, 'up')
                    "
                    class="menu-order-icon-button"
                    size="small"
                    type="text"
                    @click.stop="moveMenu(row, 'up')"
                  >
                    <IconifyIcon class="size-4" icon="lucide:arrow-up" />
                  </Button>
                </Tooltip>
                <Tooltip title="下移">
                  <Button
                    :disabled="!canMoveMenu(row, 'down')"
                    :loading="
                      menuOrderLoadingKey === getMoveLoadingKey(row, 'down')
                    "
                    class="menu-order-icon-button"
                    size="small"
                    type="text"
                    @click.stop="moveMenu(row, 'down')"
                  >
                    <IconifyIcon class="size-4" icon="lucide:arrow-down" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </template>

          <template #opButtons="{ row }">
            <div
              v-if="row.opButtonList?.length"
              class="flex max-w-[360px] flex-wrap gap-1"
            >
              <Tag
                v-for="button in row.opButtonList"
                :key="`${button.label}-${button.apiUrl}-${button.requireAuthorization}`"
              >
                {{ getOpButtonLabel(button) }}
              </Tag>
            </div>
            <span v-else class="text-muted-foreground">-</span>
          </template>

          <template #delayedPath="{ row, column }">
            <Tooltip
              v-if="row[column.field]"
              :mouse-enter-delay="1.5"
              :title="row[column.field]"
            >
              <span class="menu-path-cell">
                {{ row[column.field] }}
              </span>
            </Tooltip>
            <span v-else class="text-muted-foreground">-</span>
          </template>

          <template #enableSwitch="{ row }">
            <Switch
              :checked="row.enable ?? true"
              :disabled="!canUpdateMenu"
              :loading="enableSwitchLoadingId === row.id"
              checked-children="启用"
              un-checked-children="禁用"
              @change="(checked) => updateMenuEnable(row, Boolean(checked))"
            />
          </template>

          <template #publicAccessSwitch="{ row }">
            <Switch
              :checked="Boolean(row.publicAccess)"
              :disabled="!canUpdateMenu"
              :loading="publicAccessSwitchLoadingId === row.id"
              checked-children="公开"
              un-checked-children="授权"
              @change="
                (checked) => updateMenuPublicAccess(row, Boolean(checked))
              "
            />
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
                v-if="canUpdateMenu && !row.publicAccess"
                class="menu-action-count-button"
                :data-count="getRequireAuthorizationCount(row)"
                size="small"
                type="link"
                @click="openPermissionEditor(row)"
              >
                所需权限
                <span
                  v-if="getRequireAuthorizationCount(row) > 0"
                  class="menu-action-count-badge"
                >
                  {{ getRequireAuthorizationCount(row) }}
                </span>
              </Button>
              <Button
                v-if="canUpdateMenu"
                class="menu-action-count-button"
                :data-count="getOpButtonCount(row)"
                size="small"
                type="link"
                @click="openOpButtonEditor(row)"
              >
                页面操作
                <span
                  v-if="getOpButtonCount(row) > 0"
                  class="menu-action-count-badge"
                >
                  {{ getOpButtonCount(row) }}
                </span>
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

.menu-title-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.menu-title-content {
  display: flex;
  flex: 0 1 auto;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.menu-path-cell {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-title-order-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: hsl(var(--card) / 96%);
  box-shadow:
    0 4px 14px hsl(var(--foreground) / 8%),
    0 0 0 1px hsl(var(--border) / 80%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease;
}

.menu-title-cell:hover .menu-title-order-actions,
.menu-title-cell:focus-within .menu-title-order-actions {
  opacity: 1;
  pointer-events: auto;
}

.menu-order-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  color: hsl(var(--foreground));
  padding-inline: 0;
}

.menu-order-icon-button:hover,
.menu-order-icon-button:focus-visible {
  color: hsl(var(--primary));
}

.menu-order-icon-button :deep(svg) {
  color: currentColor;
}

.menu-action-count-button {
  position: relative;
  overflow: visible;
}

.menu-action-count-badge {
  position: absolute;
  top: -5px;
  right: -3px;
  display: inline-flex;
  min-width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  color: hsl(var(--primary-foreground));
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  background: hsl(var(--primary));
  border: 1px solid hsl(var(--background));
  border-radius: 999px;
  box-shadow: 0 2px 6px hsl(var(--primary) / 28%);
}
</style>
