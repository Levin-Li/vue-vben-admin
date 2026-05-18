<script lang="ts" setup>
import type { MenuOpButton } from './types';
import type { RbacModuleNode } from '@levin/admin-framework/framework-commons/shared/data-permission-types';

import { computed, ref } from 'vue';

import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Spin,
  Table,
} from 'ant-design-vue';

import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import ResourcePermissionTreeEditor from '@levin/admin-framework/framework-commons/shared/resource-permission-tree-editor.vue';

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
const modules = ref<RbacModuleNode[]>([]);
const permissionLoading = ref(false);
const permissionModalOpen = ref(false);
const permissionSelection = ref<string[]>([]);
const MENU_MODULE_ID = '__menus__';

const columns = [
  { dataIndex: 'label', title: '显示Label', width: 180 },
  { dataIndex: 'apiUrl', title: 'API地址', width: 240 },
  { dataIndex: 'requireAuthorization', title: '需要权限', width: 320 },
  { dataIndex: 'remark', title: '备注', width: 220 },
  { dataIndex: 'operation', title: '操作', width: 90 },
];

function updateRow(index: number, patch: Partial<MenuOpButton>) {
  rows.value = rows.value.map((item, currentIndex) =>
    currentIndex === index ? { ...item, ...patch } : item,
  );
}

function addRow() {
  rows.value = [
    ...rows.value,
    {
      apiUrl: '',
      disabled: false,
      label: '',
      remark: '',
      requireAuthorization: '',
    },
  ];
}

function removeRow(index: number) {
  rows.value = rows.value.filter(
    (_item, currentIndex) => currentIndex !== index,
  );
}

function getRowKey(record: MenuOpButton, index: number) {
  return record.requireAuthorization || record.label || record.apiUrl || index;
}

async function ensurePermissionOptionsLoaded() {
  if (modules.value.length > 0) {
    return;
  }

  permissionLoading.value = true;

  try {
    const modulesResp = await rbacService.fetchAuthorizedResourceModules();
    modules.value = ((modulesResp || []) as RbacModuleNode[]).filter(
      (item) => item.id !== MENU_MODULE_ID,
    );
  } catch (error) {
    console.error(error);
    message.error('加载资源权限列表失败');
  } finally {
    permissionLoading.value = false;
  }
}

async function openPermissionSelector(index: number, record: MenuOpButton) {
  currentPermissionRowIndex.value = index;
  permissionSelection.value = record.requireAuthorization
    ? [record.requireAuthorization]
    : [];
  permissionModalOpen.value = true;
  await ensurePermissionOptionsLoaded();
}

function handlePermissionSelectorOk() {
  if (permissionSelection.value.length > 1) {
    message.warning('页面操作只能选择一个资源权限');
    return;
  }

  const permissionExpr = permissionSelection.value[0];

  if (!permissionExpr) {
    message.warning('请选择一个资源权限');
    return;
  }

  updateRow(currentPermissionRowIndex.value, {
    requireAuthorization: permissionExpr,
  });
  permissionModalOpen.value = false;
}

function clearPermission(index: number) {
  updateRow(index, { requireAuthorization: '' });
}
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
          v-if="column.dataIndex === 'label'"
          :value="record.label"
          placeholder="请输入显示Label"
          @update:value="(value) => updateRow(index, { label: value })"
        />
        <Input
          v-else-if="column.dataIndex === 'apiUrl'"
          :value="record.apiUrl"
          placeholder="请输入API地址"
          @update:value="(value) => updateRow(index, { apiUrl: value })"
        />
        <Input
          v-else-if="column.dataIndex === 'requireAuthorization'"
          readonly
          :value="record.requireAuthorization"
          placeholder="请选择需要权限"
        >
          <template #addonAfter>
            <Button
              size="small"
              type="link"
              @click="openPermissionSelector(index, record)"
            >
              选择权限
            </Button>
            <Button
              v-if="record.requireAuthorization"
              danger
              size="small"
              type="link"
              @click="clearPermission(index)"
            >
              清空
            </Button>
          </template>
        </Input>
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
      :ok-button-props="{ disabled: permissionLoading }"
      title="选择资源权限"
      :width="1080"
      destroy-on-close
      @ok="handlePermissionSelectorOk"
    >
      <div class="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
        <Spin :spinning="permissionLoading">
          <ResourcePermissionTreeEditor
            v-model:value="permissionSelection"
            :modules="modules"
            selection-mode="single"
          />
        </Spin>
      </div>
    </Modal>
  </div>
</template>
