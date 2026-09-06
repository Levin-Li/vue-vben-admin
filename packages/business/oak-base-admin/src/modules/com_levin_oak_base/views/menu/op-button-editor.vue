<script lang="ts" setup>
import type { PermissionTreeNode } from '@levin/admin-framework/framework-commons/shared/data-permission-types';

import type { MenuOpButton } from './types';

import { computed, onMounted, ref } from 'vue';

import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { PermissionTreeNodeType } from '@levin/admin-framework/framework-commons/shared/data-permission-types';
import ResourcePermissionTreeEditor from '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue';
import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

const props = defineProps<{
  value?: MenuOpButton[];
}>();

const emit = defineEmits<{
  'update:value': [value: MenuOpButton[]];
}>();

const rows = computed({
  get: () => props.value || [],
  set: (value) => emit('update:value', value),
});

const currentPermissionRowIndex = ref(-1);
const permissionTree = ref<PermissionTreeNode[]>([]);
const permissionLoading = ref(false);
const permissionModalOpen = ref(false);
const permissionSelection = ref<string[]>([]);
const temporaryRowKeys = new WeakMap<MenuOpButton, string>();
let temporaryRowKeySequence = 0;

const columns = [
  { dataIndex: 'opName', title: '操作名称', width: 180 },
  { dataIndex: 'label', title: '显示名称', width: 180 },
  { dataIndex: 'requireAuthorizations', title: '资源权限', width: 360 },
  { dataIndex: 'remark', title: '备注', width: 220 },
  { dataIndex: 'operation', title: '操作', width: 90 },
];

const permissionDisplayNames = computed(() => {
  const names = new Map<string, string>();

  function visit(nodes: PermissionTreeNode[], parents: string[]) {
    for (const node of nodes) {
      const title = String(node.label || node.name || node.id || '').trim();
      const path = [...parents, title].filter(Boolean);
      const permissionExpr = String(node.permissionExpr || '').trim();

      if (permissionExpr && path.length > 0) {
        names.set(permissionExpr, path.join(' / '));
      }

      visit(node.children || [], path);
    }
  }

  visit(permissionTree.value, []);
  return names;
});

function updateRow(index: number, patch: Partial<MenuOpButton>) {
  rows.value = rows.value.map((item, currentIndex) =>
    currentIndex === index ? { ...item, ...patch } : item,
  );
}

function addRow() {
  rows.value = [
    ...rows.value,
    {
      opName: '',
      disabled: false,
      label: '',
      remark: '',
      requireAuthorizations: [],
    },
  ];
}

function removeRow(index: number) {
  rows.value = rows.value.filter(
    (_item, currentIndex) => currentIndex !== index,
  );
}

function getRowKey(record: MenuOpButton) {
  if (record.opName?.trim()) {
    return record.opName.trim();
  }

  let key = temporaryRowKeys.get(record);
  if (!key) {
    temporaryRowKeySequence += 1;
    key = `new-operation-${temporaryRowKeySequence}`;
    temporaryRowKeys.set(record, key);
  }

  return key;
}

async function ensurePermissionOptionsLoaded(silent = false) {
  if (permissionTree.value.length > 0) {
    return;
  }

  permissionLoading.value = true;

  try {
    permissionTree.value = ((await rbacService.fetchAuthorizedPermissionTree({
      excludeRootNodeTypes: [PermissionTreeNodeType.Menu],
    })) || []) as PermissionTreeNode[];
  } catch (error) {
    if (!silent) {
      console.error(error);
      message.error('加载资源权限列表失败');
    }
  } finally {
    permissionLoading.value = false;
  }
}

async function openPermissionSelector(index: number, record: MenuOpButton) {
  currentPermissionRowIndex.value = index;
  permissionSelection.value = [...(record.requireAuthorizations || [])];
  permissionModalOpen.value = true;
  await ensurePermissionOptionsLoaded();
}

function handlePermissionSelectorOk() {
  updateRow(currentPermissionRowIndex.value, {
    requireAuthorizations: [
      ...new Set(
        permissionSelection.value.map((value) => value.trim()).filter(Boolean),
      ),
    ],
  });
  permissionModalOpen.value = false;
}

function clearPermission(index: number) {
  updateRow(index, { requireAuthorizations: [] });
}

function removePermission(index: number, permissionExpr: string) {
  updateRow(index, {
    requireAuthorizations: (
      rows.value[index]?.requireAuthorizations || []
    ).filter((item) => item !== permissionExpr),
  });
}

function getPermissionDisplayName(permissionExpr: string) {
  return permissionDisplayNames.value.get(permissionExpr) || permissionExpr;
}

onMounted(() => {
  void ensurePermissionOptionsLoaded(true);
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <Button type="primary" @click="addRow">新增页面操作</Button>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :locale="{ emptyText: undefined }"
      :pagination="false"
      bordered
      :row-key="getRowKey"
      size="small"
    >
      <template #emptyText>
        <Empty description="暂无页面操作" />
      </template>
      <template #bodyCell="{ column, index, record }">
        <Input
          v-if="column.dataIndex === 'opName'"
          :value="record.opName"
          placeholder="请输入页面内唯一的操作名称"
          @update:value="(value) => updateRow(index, { opName: value })"
        />
        <Input
          v-else-if="column.dataIndex === 'label'"
          :value="record.label"
          placeholder="请输入显示名称"
          @update:value="(value) => updateRow(index, { label: value })"
        />
        <div
          v-else-if="column.dataIndex === 'requireAuthorizations'"
          class="border-border bg-background flex min-h-10 flex-wrap items-center gap-1 rounded-lg border px-2 py-1"
        >
          <Tag
            v-for="permissionExpr in record.requireAuthorizations || []"
            :key="permissionExpr"
            closable
            :data-test="`operation-resource-permission-${index}-${permissionExpr}`"
            :title="permissionExpr"
            @close="removePermission(index, permissionExpr)"
          >
            {{ getPermissionDisplayName(permissionExpr) }}
          </Tag>
          <span
            v-if="(record.requireAuthorizations || []).length === 0"
            class="text-muted-foreground text-sm"
          >
            暂未选择资源权限
          </span>
          <div class="ml-auto flex items-center gap-1">
            <span class="text-muted-foreground text-xs">可多选</span>
            <Button
              size="small"
              type="link"
              @click="openPermissionSelector(index, record)"
            >
              选择权限
            </Button>
            <Button
              v-if="record.requireAuthorizations?.length"
              danger
              size="small"
              type="link"
              @click="clearPermission(index)"
            >
              清空
            </Button>
          </div>
        </div>
        <Input
          v-else-if="column.dataIndex === 'remark'"
          :value="record.remark"
          placeholder="请输入备注"
          @update:value="(value) => updateRow(index, { remark: value })"
        />
        <Popconfirm
          v-else-if="column.dataIndex === 'operation'"
          title="确定删除这个页面操作吗？"
          @confirm="removeRow(index)"
        >
          <Button danger type="link">删除</Button>
        </Popconfirm>
      </template>
    </Table>

    <Modal
      v-model:open="permissionModalOpen"
      :confirm-loading="permissionLoading"
      :mask-closable="false"
      :ok-button-props="{ disabled: permissionLoading }"
      title="选择资源权限（可多选）"
      :width="1080"
      destroy-on-close
      @ok="handlePermissionSelectorOk"
    >
      <div class="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
        <Spin :spinning="permissionLoading">
          <ResourcePermissionTreeEditor
            v-model:value="permissionSelection"
            :permission-tree="permissionTree"
            selection-mode="multiple"
          />
        </Spin>
      </div>
    </Modal>
  </div>
</template>
