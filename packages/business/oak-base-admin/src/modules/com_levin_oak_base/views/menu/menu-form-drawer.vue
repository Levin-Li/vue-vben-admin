<script lang="ts" setup>
import type { MenuRecord, SelectOption } from './types';

import { computed, reactive, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { getEnabledFrontendModules } from '@levin/admin-framework/framework-commons/app/options';
import { parseMenuFixedQuery } from '@levin/admin-framework/framework-commons/menu-fixed-query';
import { isSuperAdminUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  TreeSelect,
} from 'ant-design-vue';

import { menuService } from '../../api/menu-service';
import FixedQueryEditor from './fixed-query-editor.vue';
import MenuIconPicker from './menu-icon-picker.vue';
import { buildParentTreeOptions } from './menu-tree-utils';

const props = defineProps<{
  actionTypeOptions: SelectOption[];
  menuTree: MenuRecord[];
  open: boolean;
  pageTypeOptions: SelectOption[];
  record?: MenuRecord | null;
}>();

const emit = defineEmits<{
  success: [];
  'update:open': [open: boolean];
}>();

const formState = reactive<MenuRecord>({
  actionType: 'Default',
  alwaysShow: false,
  editable: true,
  enable: true,
  orderCode: 100,
  pageType: 'LocalPage',
  publicAccess: false,
  requireAuthorizations: [],
});
const submitting = reactive({ value: false });
let savedFormSnapshot = '';
const userStore = useUserStore();

const isEdit = computed(() => Boolean(props.record?.id));
const drawerTitle = computed(() => (isEdit.value ? '编辑菜单' : '新增菜单'));
const isSuperAdmin = computed(() => isSuperAdminUser(userStore.userInfo));
const shouldShowEditableControl = computed(
  () => !isEdit.value || isSuperAdmin.value,
);

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

const parentTreeData = computed(() =>
  buildParentTreeOptions(props.menuTree, props.record?.id),
);

const pageChoices = computed(() =>
  getEnabledFrontendModules().flatMap((module) =>
    (module.backendRouteMappings || []).map((mapping) => ({
      ...mapping,
      moduleId: module.name,
      label: `${mapping.title} · ${module.title || module.name}`,
      value: mapping.viewPath,
      loadConfig: module.queryConfigLoaders?.[mapping.viewPath],
    })),
  ),
);
const selectedPage = computed(() =>
  pageChoices.value.find((page) =>
    formState.viewPath
      ? page.viewPath === formState.viewPath
      : page.path === formState.path,
  ),
);
function selectTargetPage(value: string) {
  const page = pageChoices.value.find((entry) => entry.value === value);
  if (!page) return;
  formState.viewPath = page.viewPath;
  formState.sourceFilePath = page.sourceFilePath;
  formState.moduleId = page.moduleId;
  formState.pageType = 'LocalPage';
  if (!formState.path) formState.path = `/menu-entry/${crypto.randomUUID()}`;
  if (!formState.name) formState.name = page.title;
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }

    resetForm(props.record || {});
  },
);

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
    optimisticLock: record.optimisticLock,
    opButtonList: (record.opButtonList || []).map((op) => ({
      ...op,
      requireAuthorizations: [...(op.requireAuthorizations || [])],
    })),
    orderCode: record.orderCode ?? 100,
    pageType: record.pageType || 'LocalPage',
    params: parseMenuFixedQuery(record.params),
    paramsEditor: record.paramsEditor || '',
    parentId: record.parentId || '',
    path: record.path || '',
    viewPath: record.viewPath || '',
    sourceFilePath: record.sourceFilePath || '',
    publicAccess: Boolean(record.publicAccess),
    remark: record.remark || '',
    requireAuthorizations: normalizeArray(record.requireAuthorizations),
    target: record.target || '',
    tenantId: record.tenantId,
  });
  savedFormSnapshot = JSON.stringify(formState);
}

function close() {
  if (submitting.value) return;
  const done = () => emit('update:open', false);
  if (JSON.stringify(formState) === savedFormSnapshot) {
    done();
  } else {
    Modal.confirm({ title: '放弃本次菜单修改？', onOk: done });
  }
}

function normalizeParentIdForPayload(value?: string) {
  return value || null;
}

function buildPayload() {
  const payload: Record<string, any> = {
    actionType: formState.actionType || 'Default',
    alwaysShow: Boolean(formState.alwaysShow),
    domain: formState.domain || '',
    enable: formState.enable ?? true,
    icon: formState.icon || '',
    label: formState.label || '',
    moduleId: formState.moduleId || '',
    name: String(formState.name || '').trim(),
    orderCode: formState.orderCode ?? 100,
    pageType: formState.pageType || 'LocalPage',
    params: parseMenuFixedQuery(formState.params),
    paramsEditor: formState.paramsEditor || '',
    parentId: normalizeParentIdForPayload(formState.parentId),
    path: formState.path || '',
    viewPath: formState.viewPath || selectedPage.value?.viewPath || '',
    sourceFilePath:
      formState.sourceFilePath || selectedPage.value?.sourceFilePath || '',
    publicAccess: Boolean(formState.publicAccess),
    remark: formState.remark || '',
    target: formState.target || '',
  };

  if (!isEdit.value) {
    payload.requireAuthorizations = [
      ...(formState.requireAuthorizations || []),
    ];
    payload.opButtonList = formState.opButtonList || [];
  }

  if (shouldShowEditableControl.value) {
    payload.editable = formState.editable ?? true;
  }

  if (isEdit.value) {
    payload.id = formState.id;
    payload.optimisticLock = formState.optimisticLock;
    payload.autoForceUpdateField = false;
    payload.forceUpdateFields = [
      'actionType',
      'alwaysShow',
      'domain',
      'enable',
      'icon',
      'label',
      'moduleId',
      'name',
      'orderCode',
      'pageType',
      'params',
      'paramsEditor',
      'parentId',
      'path',
      'viewPath',
      'sourceFilePath',
      'publicAccess',
      'remark',
      'target',
    ];

    if (shouldShowEditableControl.value) {
      payload.forceUpdateFields.push('editable');
    }
  }

  return payload;
}

async function clearMenuCacheSilently() {
  try {
    await menuService.clearCache();
  } catch (error) {
    console.warn('清除菜单缓存失败，列表将继续从维护接口刷新', error);
  }
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
    const fixed = parseMenuFixedQuery(formState.params);
    if (
      Object.keys(fixed).length > 0 &&
      (formState.pageType !== 'LocalPage' ||
        !['Default', 'TabPanel'].includes(formState.actionType || 'Default'))
    ) {
      throw new Error('固定查询条件仅支持本地页面的默认或 Tab 栏打开方式');
    }
    if (isEdit.value) {
      await menuService.update(buildPayload());
      await clearMenuCacheSilently();
      message.success('菜单更新成功');
    } else {
      await menuService.create(buildPayload());
      await clearMenuCacheSilently();
      message.success('菜单创建成功');
    }
    savedFormSnapshot = JSON.stringify(formState);
    emit('success');
    emit('update:open', false);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Drawer
    :mask-closable="false"
    :open="open"
    :title="drawerTitle"
    width="min(80vw, 1120px)"
    @close="close"
  >
    <Form layout="vertical">
      <div
        class="grid grid-cols-1 gap-x-5 gap-y-1 md:grid-cols-2 xl:grid-cols-3"
      >
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

        <Form.Item
          v-if="formState.pageType === 'LocalPage'"
          class="md:col-span-2 xl:col-span-3"
          label="目标页面"
        >
          <Select
            :value="selectedPage?.value"
            :options="pageChoices"
            show-search
            option-filter-prop="label"
            placeholder="选择要复用的已有页面"
            @change="(value) => selectTargetPage(String(value))"
          />
        </Form.Item>
        <Form.Item label="菜单入口路径">
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
          <MenuIconPicker v-model="formState.icon" />
        </Form.Item>
        <Form.Item label="排序代码">
          <InputNumber
            v-model:value="formState.orderCode"
            class="w-full"
            :min="0"
            placeholder="请输入排序代码"
          />
        </Form.Item>
        <Form.Item class="md:col-span-2 xl:col-span-3" label="显示控制">
          <div class="flex flex-wrap items-center gap-x-8 gap-y-3 py-1">
            <span class="inline-flex items-center gap-2">
              <Switch v-model:checked="formState.enable" />
              是否启用
            </span>
            <span
              v-if="shouldShowEditableControl"
              class="inline-flex items-center gap-2"
            >
              <Switch v-model:checked="formState.editable" />
              是否可编辑
            </span>
            <span class="inline-flex items-center gap-2">
              <Switch v-model:checked="formState.alwaysShow" />
              无权限时展示
            </span>
            <span class="inline-flex items-center gap-2">
              <Switch v-model:checked="formState.publicAccess" />
              公开访问
            </span>
          </div>
        </Form.Item>

        <Form.Item class="md:col-span-2 xl:col-span-3" label="固定查询条件">
          <FixedQueryEditor
            v-model="formState.params"
            :load-config="selectedPage?.loadConfig"
            :params-editor="formState.paramsEditor"
          />
        </Form.Item>

        <details class="mb-4 md:col-span-2 xl:col-span-3">
          <summary class="cursor-pointer">高级：固定条件编辑器配置</summary>
          <Form.Item
            label="JSON Schema"
            class="mt-3"
            extra="支持 class:类名、url:地址或内联 JSON Schema；留空时使用目标页面查询表单。"
          >
            <Input.TextArea v-model:value="formState.paramsEditor" :rows="3" />
          </Form.Item>
        </details>

        <Form.Item class="md:col-span-2 xl:col-span-3" label="备注">
          <Input.TextArea
            v-model:value="formState.remark"
            placeholder="请输入备注"
            :rows="3"
          />
        </Form.Item>
      </div>
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
