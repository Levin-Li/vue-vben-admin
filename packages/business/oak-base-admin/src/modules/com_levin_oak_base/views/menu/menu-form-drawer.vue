<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import type { MenuRecord, SelectOption } from './types';

import { computed, reactive, watch } from 'vue';

import {
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  TreeSelect,
  message,
} from 'ant-design-vue';

import { menuService } from '@levin/oak-base-admin/modules/com_levin_oak_base/api/menu';

import OpButtonEditor from './op-button-editor.vue';

const props = defineProps<{
  actionTypeOptions: SelectOption[];
  menuTree: MenuRecord[];
  open: boolean;
  pageTypeOptions: SelectOption[];
  record?: MenuRecord | null;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  success: [];
}>();

const formState = reactive<MenuRecord>({
  actionType: 'Default',
  alwaysShow: false,
  editable: true,
  enable: true,
  opButtonList: [],
  orderCode: 100,
  pageType: 'LocalPage',
  requireAuthorizations: [],
});
const submitting = reactive({ value: false });

const isEdit = computed(() => Boolean(props.record?.id));
const drawerTitle = computed(() => (isEdit.value ? '编辑菜单' : '新增菜单'));

const actionTypeSelectOptions = computed(() =>
  props.actionTypeOptions.map((item) => ({
    label: item.label,
    value: String(item.value),
  })),
);
const pageTypeSelectOptions = computed(() =>
  props.pageTypeOptions.map((item) => ({
    label: item.label,
    value: String(item.value),
  })),
);

const parentTreeData = computed<DataNode[]>(() =>
  buildParentTreeOptions(props.menuTree, props.record?.id),
);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }

    resetForm(props.record || {});
  },
);

function buildParentTreeOptions(
  rows: MenuRecord[],
  disabledId?: string,
): DataNode[] {
  return rows.map((row) => {
    const disabled = Boolean(disabledId && row.id === disabledId);
    return {
      children: buildParentTreeOptions(row.children || [], disabledId),
      disabled,
      key: row.id || '',
      title: row.name || row.label || row.path || row.id || '未命名菜单',
      value: row.id || '',
    };
  });
}

function normalizeArray(value: any) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function resetForm(record: MenuRecord) {
  Object.assign(formState, {
    actionType: record.actionType || 'Default',
    alwaysShow: Boolean(record.alwaysShow),
    domain: record.domain || '',
    editable: record.editable ?? true,
    enable: record.enable ?? true,
    icon: record.icon || '',
    id: record.id,
    label: record.label || '',
    moduleId: record.moduleId || '',
    name: record.name || '',
    opButtonList: Array.isArray(record.opButtonList)
      ? record.opButtonList.map((item) => ({ ...item }))
      : [],
    optimisticLock: record.optimisticLock,
    orderCode: record.orderCode ?? 100,
    pageType: record.pageType || 'LocalPage',
    params: record.params || '',
    parentId: record.parentId || '',
    path: record.path || '',
    remark: record.remark || '',
    requireAuthorizations: normalizeArray(record.requireAuthorizations),
    target: record.target || '',
    tenantId: record.tenantId,
  });
}

function close() {
  emit('update:open', false);
}

function cleanOpButtonList() {
  return (formState.opButtonList || [])
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

function buildPayload() {
  const payload: Record<string, any> = {
    actionType: formState.actionType || 'Default',
    alwaysShow: Boolean(formState.alwaysShow),
    domain: formState.domain || '',
    editable: formState.editable ?? true,
    enable: formState.enable ?? true,
    icon: formState.icon || '',
    label: formState.label || '',
    moduleId: formState.moduleId || '',
    name: String(formState.name || '').trim(),
    opButtonList: cleanOpButtonList(),
    orderCode: formState.orderCode ?? 100,
    pageType: formState.pageType || 'LocalPage',
    params: formState.params || '',
    parentId: formState.parentId || '',
    path: formState.path || '',
    remark: formState.remark || '',
    requireAuthorizations: normalizeArray(formState.requireAuthorizations),
    target: formState.target || '',
  };

  if (isEdit.value) {
    payload.id = formState.id;
    payload.optimisticLock = formState.optimisticLock;
    payload.forceUpdateFields = [
      'actionType',
      'alwaysShow',
      'domain',
      'editable',
      'enable',
      'icon',
      'label',
      'moduleId',
      'name',
      'opButtonList',
      'orderCode',
      'pageType',
      'params',
      'parentId',
      'path',
      'remark',
      'requireAuthorizations',
      'target',
    ];
  }

  return payload;
}

async function submit() {
  if (!String(formState.name || '').trim()) {
    message.warning('请输入菜单名称');
    return;
  }
  if (!formState.pageType) {
    message.warning('请选择页面类型');
    return;
  }

  submitting.value = true;
  try {
    if (isEdit.value) {
      await menuService.update(buildPayload());
      message.success('菜单更新成功');
    } else {
      await menuService.create(buildPayload());
      message.success('菜单创建成功');
    }
    emit('success');
    close();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Drawer
    :open="open"
    :title="drawerTitle"
    width="min(70vw, 1280px)"
    @close="close"
  >
    <Form layout="vertical">
      <div class="grid grid-cols-1 gap-x-5 md:grid-cols-2 xl:grid-cols-4">
        <Form.Item label="上级菜单">
          <TreeSelect
            v-model:value="formState.parentId"
            allow-clear
            class="w-full"
            placeholder="请选择上级菜单"
            show-search
            tree-default-expand-all
            :tree-data="parentTreeData"
          />
        </Form.Item>
        <Form.Item label="菜单名称" required>
          <Input v-model:value="formState.name" placeholder="请输入菜单名称" />
        </Form.Item>
        <Form.Item label="菜单标签">
          <Input v-model:value="formState.label" placeholder="请输入菜单标签" />
        </Form.Item>
        <Form.Item label="页面类型" required>
          <Select
            v-model:value="formState.pageType"
            :options="pageTypeSelectOptions"
            placeholder="请选择页面类型"
          />
        </Form.Item>

        <Form.Item label="路径">
          <Input v-model:value="formState.path" placeholder="请输入路径" />
        </Form.Item>
        <Form.Item label="打开方式">
          <Select
            v-model:value="formState.actionType"
            :options="actionTypeSelectOptions"
            placeholder="请选择打开方式"
          />
        </Form.Item>
        <Form.Item label="目标">
          <Input v-model:value="formState.target" placeholder="请输入目标" />
        </Form.Item>
        <Form.Item label="模块ID">
          <Input
            v-model:value="formState.moduleId"
            placeholder="请输入模块ID"
          />
        </Form.Item>

        <Form.Item label="域名">
          <Input v-model:value="formState.domain" placeholder="请输入域名" />
        </Form.Item>
        <Form.Item label="图标">
          <Input v-model:value="formState.icon" placeholder="请输入图标" />
        </Form.Item>
        <Form.Item label="排序代码">
          <InputNumber
            v-model:value="formState.orderCode"
            class="w-full"
            :min="0"
            placeholder="请输入排序代码"
          />
        </Form.Item>
        <Form.Item label="显示控制">
          <div class="flex flex-wrap gap-6 py-1">
            <span class="inline-flex items-center gap-2">
              <Switch v-model:checked="formState.enable" />
              是否启用
            </span>
            <span class="inline-flex items-center gap-2">
              <Switch v-model:checked="formState.editable" />
              是否可编辑
            </span>
            <span class="inline-flex items-center gap-2">
              <Switch v-model:checked="formState.alwaysShow" />
              无权限时展示
            </span>
          </div>
        </Form.Item>

        <Form.Item class="md:col-span-2 xl:col-span-4" label="需要的权限">
          <Select
            v-model:value="formState.requireAuthorizations"
            mode="tags"
            placeholder="一行或一个标签表示一个权限/角色"
            :token-separators="[',', '\\n']"
          />
        </Form.Item>

        <Form.Item class="md:col-span-2 xl:col-span-4" label="参数">
          <Input.TextArea
            v-model:value="formState.params"
            placeholder="请输入参数"
            :rows="3"
          />
        </Form.Item>

        <Form.Item class="md:col-span-2 xl:col-span-4" label="备注">
          <Input.TextArea
            v-model:value="formState.remark"
            placeholder="请输入备注"
            :rows="3"
          />
        </Form.Item>
      </div>

      <Divider>操作按钮列表</Divider>
      <OpButtonEditor v-model:value="formState.opButtonList" />
    </Form>

    <template #footer>
      <div class="flex justify-end gap-3">
        <Button @click="close">取消</Button>
        <Button :loading="submitting.value" type="primary" @click="submit">
          确定
        </Button>
      </div>
    </template>
  </Drawer>
</template>
