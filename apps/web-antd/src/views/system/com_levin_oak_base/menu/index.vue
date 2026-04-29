<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import type { MenuRecord, SelectOption } from './types';

import { h, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, Modal, Tag, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { menuService } from '#/api/com_levin_oak_base/menu';
import { getAuthorizedMenuListApi } from '#/api/core/menu';
import { moduleFetchEnumOptions } from '#/views/system/com_levin_oak_base/api-module';

import {
  fallbackActionTypeOptions,
  fallbackPageTypeOptions,
  useColumns,
} from './data';
import MenuFormDrawer from './menu-form-drawer.vue';

const pageTypeOptions = ref<SelectOption[]>(fallbackPageTypeOptions);
const actionTypeOptions = ref<SelectOption[]>(fallbackActionTypeOptions);
const menuTree = ref<MenuRecord[]>([]);
const currentRecord = ref<MenuRecord | null>(null);
const formOpen = ref(false);
const route = useRoute();

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
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

function sortRows(rows: MenuRecord[]) {
  return rows.sort((a, b) => {
    const orderA = a.orderCode ?? 0;
    const orderB = b.orderCode ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a.name || '').localeCompare(
      String(b.name || ''),
      'zh-Hans-CN',
    );
  });
}

function normalizeChildren(row: MenuRecord): MenuRecord {
  const rawChildren = Array.isArray(row.children) ? row.children : [];
  return {
    ...row,
    children: sortRows(rawChildren.map(normalizeChildren)),
  };
}

function buildTree(rows: MenuRecord[]) {
  const normalizedRows = rows.map((row) => ({ ...row, children: [] }));
  const rowMap = new Map<string, MenuRecord>();
  const roots: MenuRecord[] = [];

  normalizedRows.forEach((row) => {
    if (row.id) {
      rowMap.set(row.id, row);
    }
  });

  normalizedRows.forEach((row) => {
    const parentId = row.parentId || row.parent?.id || '';
    const parent = parentId ? rowMap.get(parentId) : undefined;
    if (parent && parent.id !== row.id) {
      parent.children = [...(parent.children || []), row];
    } else {
      roots.push(row);
    }
  });

  return sortRows(roots).map(normalizeChildren);
}

async function loadMenuTree() {
  const data = await getAuthorizedMenuListApi();
  const items = normalizeAuthorizedMenuList(data);

  if (
    items.some((item) => Array.isArray(item.children) && item.children.length)
  ) {
    return sortRows(items.map(normalizeChildren));
  }

  return buildTree(items);
}

function refresh() {
  gridApi.query();
}

function openCreate(parentId = '') {
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
  currentRecord.value = { ...row };
  formOpen.value = true;
}

function deleteRow(row: MenuRecord) {
  Modal.confirm({
    content: `确定删除菜单「${row.name || row.id}」吗？`,
    okButtonProps: { danger: true },
    okText: '删除',
    title: '删除菜单',
    async onOk() {
      await menuService.delete({ idList: [row.id] });
      message.success('菜单删除成功');
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
            <Button type="primary" @click="openCreate('')">
              <Plus class="size-5" />
              新增菜单
            </Button>
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
              <Button size="small" type="link" @click="openCreate(row.id || '')">
                新增下级
              </Button>
              <Button size="small" type="link" @click="openEdit(row)">
                编辑
              </Button>
              <Button danger size="small" type="link" @click="deleteRow(row)">
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
  min-height: 0;
  padding: 0;
}
</style>
