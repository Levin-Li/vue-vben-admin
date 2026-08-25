<script lang="ts" setup>
import type { SelectOption } from '@levin/admin-framework';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Spin,
  Switch,
  Tree,
  TreeSelect,
  Tooltip,
} from 'ant-design-vue';

import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { isSuperAdminUser } from '@levin/admin-framework/framework-commons/shared/user-identity';
import { orgService } from '../../api/org-service';
import { userService } from '../../api/user-service';

import CrudPage from '../crud-page.vue';
import {
  DEFAULT_CRUD_MODAL_WIDTH,
  orgTypeOptionsLoader,
} from '../api-module';
import {
  buildApiMethodPermissions,
  buildCrudOperationPermissions,
} from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import DataPermissionDialog from '@levin/admin-framework/framework-commons/shared/data-permission-dialog.vue';
import { getDataPermissionCount } from '../permission-action-counts';
import { roleOptionsLoader, userPageCrudConfig } from '../user/config';

interface OrgTreeNode {
  children?: OrgTreeNode[];
  disabled?: boolean;
  key: string;
  label: string;
  title: string;
  type?: string;
  value: string;
}

interface StringSelectOption {
  children?: StringSelectOption[];
  disabled?: boolean;
  label: string;
  value: string;
}

const ORG_TYPE_ICON_MAP: Record<string, string> = {
  Agent: 'lucide:handshake',
  Branch: 'lucide:git-branch',
  Channel: 'lucide:route',
  Company: 'lucide:building-2',
  Customer: 'lucide:user-round-check',
  Department: 'lucide:network',
  DirectStore: 'lucide:store',
  Distributor: 'lucide:warehouse',
  ExternalOrg: 'lucide:building',
  FranchiseStore: 'lucide:handshake',
  Group: 'lucide:users-round',
  Individual: 'lucide:user-round',
  MainStore: 'lucide:landmark',
  Merchant: 'lucide:store',
  OnlineFlagshipStore: 'lucide:badge-check',
  OnlineStore: 'lucide:monitor-smartphone',
  Store: 'lucide:store',
  TempOrg: 'lucide:clock-3',
  Vendor: 'lucide:truck',
};

const ORG_TYPE_LABEL_MAP: Record<string, string> = {
  Agent: '代理商',
  Branch: '分公司',
  Channel: '渠道商',
  Company: '公司',
  Customer: '客户',
  Department: '部门',
  DirectStore: '直营店',
  Distributor: '经销商',
  ExternalOrg: '外部机构',
  FranchiseStore: '加盟店',
  Group: '小组',
  Individual: '个体户',
  MainStore: '总店',
  Merchant: '商户',
  OnlineFlagshipStore: '线上旗舰店',
  OnlineStore: '线上门店',
  Store: '门店',
  TempOrg: '临时组织',
  Vendor: '供应商',
};

const dialogOpen = ref(false);
const pageKey = ref(0);
const selectedRecord = ref<null | Record<string, any>>(null);
const roleModalOpen = ref(false);
const roleSubmitting = ref(false);
const roleOptionsLoading = ref(false);
const roleOptions = ref<StringSelectOption[]>([]);
const roleFormState = reactive({
  id: '',
  roleList: [] as string[],
});

const orgTreeLoading = ref(false);
const orgSubmitting = ref(false);
const orgKeyword = ref('');
const selectedOrgId = ref('');
const hoveredOrgId = ref('');
const expandedOrgKeys = ref<string[]>([]);
const orgTreeData = ref<OrgTreeNode[]>([]);
const orgTypeOptions = ref<Array<{ label: string; value: string }>>([]);
const userStore = useUserStore();

const orgModalOpen = ref(false);
const orgModalMode = ref<'create' | 'edit'>('create');
const orgFormState = reactive<Record<string, any>>({
  code: '',
  editable: true,
  enable: true,
  id: '',
  name: '',
  orderCode: 100,
  parentId: '',
  remark: '',
  shortName: '',
  type: 'Department',
});

const selectedOrgName = computed(
  () => findOrgNode(orgTreeData.value, selectedOrgId.value)?.title || '',
);
const isSuperAdmin = computed(() => isSuperAdminUser(userStore.userInfo));
const shouldShowOrgEditableControl = computed(
  () => orgModalMode.value === 'create' || isSuperAdmin.value,
);

const filteredOrgTreeData = computed(() => {
  const keyword = orgKeyword.value.trim().toLowerCase();

  if (!keyword) {
    return orgTreeData.value;
  }

  return filterOrgTreeNodes(orgTreeData.value, keyword);
});

const orgParentTreeData = computed(() =>
  disableOrgTreeNode(orgTreeData.value, orgFormState.id),
);

const orgTypeSelectOptions = computed(() => {
  const options = orgTypeOptions.value.filter(
    (option) => option.value !== 'Store',
  );
  const legacyStoreOption = orgTypeOptions.value.find(
    (option) => option.value === 'Store',
  );

  if (orgFormState.type === 'Store' && legacyStoreOption) {
    return [...options, legacyStoreOption];
  }

  return options;
});

const orgTypeLegendItems = computed(() => {
  const source =
    orgTypeOptions.value.length > 0
      ? orgTypeOptions.value
      : Object.entries(ORG_TYPE_LABEL_MAP).map(([value, label]) => ({
          label,
          value,
        }));
  const usedValues = new Set<string>();

  return source
    .map((option) => ({
      icon: getOrgTypeIcon(option.value),
      label: option.label || getOrgTypeLabel(option.value),
      value: option.value,
    }))
    .filter((item) => {
      if (usedValues.has(item.value)) {
        return false;
      }

      usedValues.add(item.value);
      return true;
    });
});

const userConfig = computed(() => ({
  ...userPageCrudConfig,
  defaultFormValues: {
    ...userPageCrudConfig.defaultFormValues,
    orgId: selectedOrgId.value || undefined,
  },
  defaultQuery: {
    ...userPageCrudConfig.defaultQuery,
    orgId: selectedOrgId.value,
  },
  fields: userPageCrudConfig.fields.map((field) =>
    field.key === 'orgId'
      ? {
          ...field,
          search: false,
        }
      : field,
  ),
  rowActions: [
    ...(userPageCrudConfig.rowActions || []),
    {
      handler: async (record: Record<string, any>) => {
        await openRoleModal(record);
      },
      label: '分配角色',
      permission: buildApiMethodPermissions(userService, 'assignRoles'),
      reloadAfterAction: false,
      successMessage: false as const,
    },
    {
      badgeCount: getDataPermissionCount,
      handler: async (record: Record<string, any>) => {
        selectedRecord.value = record;
        dialogOpen.value = true;
      },
      label: '数据权限分配',
      permission:
        userPageCrudConfig.editPermission ||
        buildCrudOperationPermissions(userPageCrudConfig, 'update'),
      reloadAfterAction: false,
      successMessage: false as const,
    },
  ],
}));

const crudPageKey = computed(
  () => `${pageKey.value}-${selectedOrgId.value || 'none'}`,
);

function toOrgTreeNodes(options: SelectOption[]): OrgTreeNode[] {
  return options
    .filter((option) => option?.value !== undefined && option?.value !== null)
    .map((option) => {
      const id = String(option.value);
      const label = String(option.label || option.value);

      return {
        children: option.children ? toOrgTreeNodes(option.children) : undefined,
        key: id,
        label,
        title: label,
        type: option.type ? String(option.type) : undefined,
        value: id,
      };
    });
}

function getOrgTypeIcon(type?: string) {
  return type ? ORG_TYPE_ICON_MAP[type] || 'lucide:building' : 'lucide:building';
}

function getOrgTypeLabel(type?: string) {
  if (!type) {
    return '组织';
  }

  const option = orgTypeOptions.value.find((item) => item.value === type);

  return option?.label || ORG_TYPE_LABEL_MAP[type] || type;
}

function toStringSelectOptions(options: SelectOption[]): StringSelectOption[] {
  return options.map((option) => ({
    children: option.children ? toStringSelectOptions(option.children) : undefined,
    disabled: option.disabled,
    label: option.label,
    value: String(option.value),
  }));
}

function collectOrgKeys(nodes: OrgTreeNode[]): string[] {
  return nodes.flatMap((node) => [
    node.key,
    ...(node.children ? collectOrgKeys(node.children) : []),
  ]);
}

function findFirstOrgId(nodes: OrgTreeNode[]): string {
  const first = nodes[0];

  if (!first) {
    return '';
  }

  return first.key;
}

function findOrgNode(
  nodes: OrgTreeNode[],
  id: string,
): OrgTreeNode | undefined {
  for (const node of nodes) {
    if (node.key === id) {
      return node;
    }

    const child = node.children ? findOrgNode(node.children, id) : undefined;

    if (child) {
      return child;
    }
  }

  return undefined;
}

function filterOrgTreeNodes(nodes: OrgTreeNode[], keyword: string) {
  return nodes.reduce<OrgTreeNode[]>((result, node) => {
    const children = node.children
      ? filterOrgTreeNodes(node.children, keyword)
      : [];
    const matched = node.title.toLowerCase().includes(keyword);

    if (matched || children.length > 0) {
      result.push({
        ...node,
        children,
      });
    }

    return result;
  }, []);
}

function disableOrgTreeNode(
  nodes: OrgTreeNode[],
  disabledId?: string,
): OrgTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children
      ? disableOrgTreeNode(node.children, disabledId)
      : undefined,
    disabled: Boolean(disabledId && node.key === disabledId),
  }));
}

function resetOrgForm(values: Record<string, any> = {}) {
  Object.assign(orgFormState, {
    code: '',
    editable: true,
    enable: true,
    id: '',
    name: '',
    optimisticLock: undefined,
    orderCode: 100,
    parentId: '',
    remark: '',
    shortName: '',
    state: 'Normal',
    type: 'Department',
    ...values,
  });
}

async function loadRoleOptions(keyword = '') {
  roleOptionsLoading.value = true;

  try {
    roleOptions.value = toStringSelectOptions(await roleOptionsLoader(keyword));
  } finally {
    roleOptionsLoading.value = false;
  }
}

async function openRoleModal(record: Record<string, any>) {
  roleFormState.id = String(record.id || '');
  roleFormState.roleList = Array.isArray(record.roleList)
    ? record.roleList.map((role) => String(role))
    : [];
  roleModalOpen.value = true;
  await loadRoleOptions();
}

async function submitRoleForm() {
  if (!roleFormState.id) {
    message.warning('用户ID不能为空');
    return;
  }

  roleSubmitting.value = true;

  try {
    await userService.assignRoles({
      id: roleFormState.id,
      roleList: roleFormState.roleList,
    });
    message.success('角色已分配');
    roleModalOpen.value = false;
    pageKey.value += 1;
  } finally {
    roleSubmitting.value = false;
  }
}

async function loadOrgTree() {
  orgTreeLoading.value = true;

  try {
    const options = await rbacService.fetchAuthorizedOrgOptions({
      assembleTree: true,
    });
    const nextTreeData = toOrgTreeNodes(options);
    const nextKeys = collectOrgKeys(nextTreeData);

    orgTreeData.value = nextTreeData;

    if (!selectedOrgId.value || !nextKeys.includes(selectedOrgId.value)) {
      selectedOrgId.value = findFirstOrgId(nextTreeData);
    }

    if (!orgKeyword.value) {
      expandedOrgKeys.value = nextTreeData.map((node) => node.key);
    }
  } catch {
    orgTreeData.value = [];
    selectedOrgId.value = '';
    expandedOrgKeys.value = [];
  } finally {
    orgTreeLoading.value = false;
  }
}

async function loadOrgOptions() {
  try {
    orgTypeOptions.value = (await orgTypeOptionsLoader()).map((option) => ({
      ...option,
      value: String(option.value),
    }));
  } catch {
    orgTypeOptions.value = [];
  }
}

function handleOrgSelect(keys: Array<number | string>) {
  const [key] = keys;

  if (key !== undefined && key !== null) {
    selectedOrgId.value = String(key);
  }
}

function handleOrgNodeFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget as HTMLElement;
  const nextTarget = event.relatedTarget;

  if (!(nextTarget instanceof Node) || !currentTarget.contains(nextTarget)) {
    hoveredOrgId.value = '';
  }
}

function openCreateOrgModal(parentId = '') {
  orgModalMode.value = 'create';
  resetOrgForm({
    parentId,
  });
  orgModalOpen.value = true;
}

async function openEditOrgModal(id = selectedOrgId.value) {
  if (!id) {
    message.warning('请先选择组织节点');
    return;
  }

  selectedOrgId.value = id;
  orgModalMode.value = 'edit';
  orgTreeLoading.value = true;

  try {
    const org = (await orgService.retrieve({
      id,
    })) as Record<string, any>;

    resetOrgForm({
      ...org,
      enable: org?.enable ?? true,
      editable: org?.editable ?? true,
      parentId: org?.parentId || '',
      type: org?.type || 'Department',
    });
    orgModalOpen.value = true;
  } finally {
    orgTreeLoading.value = false;
  }
}

async function deleteOrg(id = selectedOrgId.value) {
  if (!id) {
    message.warning('请先选择组织节点');
    return;
  }

  await orgService.delete({
    id,
  });

  message.success('组织已删除');
  if (selectedOrgId.value === id) {
    selectedOrgId.value = '';
  }
  await loadOrgTree();
  pageKey.value += 1;
}

async function submitOrgForm() {
  if (!String(orgFormState.name || '').trim()) {
    message.warning('请输入组织名称');
    return;
  }

  orgSubmitting.value = true;

  try {
    const payload: Record<string, any> = {
      code: orgFormState.code || undefined,
      enable: orgFormState.enable,
      id: orgFormState.id || undefined,
      name: orgFormState.name,
      optimisticLock: orgFormState.optimisticLock,
      orderCode: orgFormState.orderCode,
      parentId: orgFormState.parentId || undefined,
      remark: orgFormState.remark || undefined,
      shortName: orgFormState.shortName || undefined,
      state: orgFormState.state || 'Normal',
      type: orgFormState.type || 'Department',
    };

    if (shouldShowOrgEditableControl.value) {
      payload.editable = orgFormState.editable;
    }

    if (orgModalMode.value === 'edit') {
      await orgService.update(payload);
      message.success('组织已更新');
    } else {
      const createdId = await orgService.create(payload);

      if (createdId) {
        selectedOrgId.value = String(createdId);
      }

      message.success('组织已创建');
    }

    orgModalOpen.value = false;
    await loadOrgTree();
    pageKey.value += 1;
  } finally {
    orgSubmitting.value = false;
  }
}

function handleSaved() {
  pageKey.value += 1;
}

watch(dialogOpen, (open) => {
  if (!open) {
    selectedRecord.value = null;
  }
});

watch(orgKeyword, (keyword) => {
  if (keyword.trim()) {
    expandedOrgKeys.value = collectOrgKeys(filteredOrgTreeData.value);
  }
});

onMounted(async () => {
  await Promise.all([loadOrgTree(), loadOrgOptions()]);
});
</script>

<template>
  <div class="user-org-page flex min-h-0 gap-[8px]">
    <aside
      class="user-org-sidebar border-border bg-card flex w-[320px] shrink-0 flex-col rounded-lg border p-4"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-base font-semibold">组织机构</div>
          <div class="text-muted-foreground truncate text-xs">
            {{ selectedOrgName || '请选择组织节点' }}
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Popover placement="bottomRight" trigger="click">
            <template #title>类型图标</template>
            <template #content>
              <div class="user-org-type-legend">
                <div
                  v-for="item in orgTypeLegendItems"
                  :key="item.value"
                  class="user-org-type-legend-item"
                >
                  <IconifyIcon
                    aria-hidden="true"
                    class="size-4 shrink-0"
                    :icon="item.icon"
                  />
                  <span class="min-w-0 truncate">{{ item.label }}</span>
                </div>
              </div>
            </template>
            <Button
              aria-label="查看组织类型图标"
              class="inline-flex items-center justify-center"
              shape="circle"
              size="small"
              title="类型图标"
            >
              <IconifyIcon
                class="block size-4 leading-none"
                icon="lucide:badge-help"
              />
            </Button>
          </Popover>
          <Tooltip title="刷新">
            <Button
              :loading="orgTreeLoading"
              aria-label="刷新组织"
              class="inline-flex items-center justify-center"
              shape="circle"
              size="small"
              @click="loadOrgTree"
            >
              <template #icon>
                <IconifyIcon
                  class="block size-4 leading-none"
                  icon="lucide:refresh-cw"
                />
              </template>
            </Button>
          </Tooltip>
          <Button size="small" type="primary" @click="openCreateOrgModal('')">
            新增
          </Button>
        </div>
      </div>

      <Input.Search
        v-model:value="orgKeyword"
        allow-clear
        class="mb-3"
        placeholder="搜索组织"
      />

      <Spin :spinning="orgTreeLoading" class="min-h-0 flex-1">
        <Tree
          v-if="filteredOrgTreeData.length > 0"
          v-model:expandedKeys="expandedOrgKeys"
          :selected-keys="selectedOrgId ? [selectedOrgId] : []"
          :tree-data="filteredOrgTreeData"
          block-node
          class="user-org-tree"
          @select="handleOrgSelect"
        >
          <template #title="node">
            <div
              :class="{
                'user-org-tree-node--actions-visible':
                  hoveredOrgId === String(node.key),
              }"
              class="user-org-tree-node"
              tabindex="0"
              @focusin="hoveredOrgId = String(node.key)"
              @focusout="handleOrgNodeFocusOut"
              @mouseenter="hoveredOrgId = String(node.key)"
              @mouseleave="hoveredOrgId = ''"
            >
              <span
                class="user-org-tree-node-title min-w-0 flex flex-1 items-center gap-2 truncate"
              >
                <Tooltip :title="getOrgTypeLabel(node.type)">
                  <IconifyIcon
                    aria-hidden="true"
                    class="user-org-tree-node-icon size-4"
                    :icon="getOrgTypeIcon(node.type)"
                  />
                </Tooltip>
                <span class="min-w-0 truncate">{{ node.title }}</span>
              </span>
              <span
                v-if="hoveredOrgId === String(node.key)"
                class="user-org-tree-actions"
              >
                <Tooltip title="新增下级组织">
                  <Button
                    aria-label="新增下级组织"
                    size="small"
                    type="text"
                    @click.stop="openCreateOrgModal(String(node.key))"
                  >
                    <IconifyIcon aria-hidden="true" icon="lucide:plus" />
                  </Button>
                </Tooltip>
                <Tooltip title="编辑组织">
                  <Button
                    aria-label="编辑组织"
                    size="small"
                    type="text"
                    @click.stop="openEditOrgModal(String(node.key))"
                  >
                    <IconifyIcon aria-hidden="true" icon="lucide:pencil" />
                  </Button>
                </Tooltip>
                <Popconfirm
                  title="确认删除当前组织节点吗？"
                  @confirm="deleteOrg(String(node.key))"
                >
                  <Tooltip title="删除组织">
                    <Button
                      aria-label="删除组织"
                      danger
                      size="small"
                      type="text"
                      @click.stop
                    >
                      <IconifyIcon aria-hidden="true" icon="lucide:trash-2" />
                    </Button>
                  </Tooltip>
                </Popconfirm>
              </span>
            </div>
          </template>
        </Tree>
        <Empty v-else description="暂无组织" />
      </Spin>
    </aside>

    <main class="user-org-main min-h-0 min-w-0 flex-1">
      <CrudPage v-if="selectedOrgId" :key="crudPageKey" :config="userConfig" />
      <div
        v-else
        class="border-border bg-card flex h-full items-center justify-center rounded-lg border"
      >
        <Empty description="请选择左侧组织后查看用户" />
      </div>
    </main>

    <DataPermissionDialog
      v-if="selectedRecord"
      v-model:open="dialogOpen"
      :record="selectedRecord"
      subject-type="user"
      @saved="handleSaved"
    />

    <Modal
      v-model:open="roleModalOpen"
      :confirm-loading="roleSubmitting"
      :mask-closable="false"
      title="分配角色"
      :width="720"
      @ok="submitRoleForm"
    >
      <Form layout="vertical">
        <Form.Item label="角色">
          <Select
            v-model:value="roleFormState.roleList"
            allow-clear
            class="w-full"
            :filter-option="false"
            mode="multiple"
            :not-found-content="roleOptionsLoading ? '加载中...' : undefined"
            :options="roleOptions"
            placeholder="请选择角色"
            show-search
            @search="loadRoleOptions"
          />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="orgModalOpen"
      :confirm-loading="orgSubmitting"
      :mask-closable="false"
      :title="orgModalMode === 'edit' ? '编辑组织' : '新增组织'"
      :width="DEFAULT_CRUD_MODAL_WIDTH"
      @ok="submitOrgForm"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-6 gap-y-4">
          <Form.Item label="上级组织">
            <TreeSelect
              v-model:value="orgFormState.parentId"
              allow-clear
              class="w-full"
              placeholder="请选择上级组织"
              show-search
              :tree-data="orgParentTreeData"
              tree-default-expand-all
              tree-node-filter-prop="label"
            />
          </Form.Item>
          <Form.Item label="组织类型">
            <Select
              v-model:value="orgFormState.type"
              :options="orgTypeSelectOptions"
              placeholder="请选择组织类型"
            />
          </Form.Item>
          <Form.Item label="组织名称" required>
            <Input
              v-model:value="orgFormState.name"
              placeholder="请输入组织名称"
            />
          </Form.Item>
          <Form.Item label="组织编码">
            <Input
              v-model:value="orgFormState.code"
              placeholder="请输入组织编码"
            />
          </Form.Item>
          <Form.Item label="组织简称">
            <Input
              v-model:value="orgFormState.shortName"
              placeholder="请输入组织简称"
            />
          </Form.Item>
          <Form.Item label="排序代码">
            <InputNumber
              v-model:value="orgFormState.orderCode"
              class="w-full"
              placeholder="请输入排序代码"
            />
          </Form.Item>
          <Form.Item label="是否启用">
            <Switch v-model:checked="orgFormState.enable" />
          </Form.Item>
          <Form.Item v-if="shouldShowOrgEditableControl" label="是否可编辑">
            <Switch v-model:checked="orgFormState.editable" />
          </Form.Item>
          <Form.Item class="col-span-2" label="备注">
            <Input.TextArea
              v-model:value="orgFormState.remark"
              :rows="3"
              placeholder="请输入备注"
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>
.user-org-page {
  height: 100%;
  min-height: 520px;
}

.user-org-sidebar {
  min-height: 0;
  position: relative;
  z-index: 3;
  overflow: visible;
}

.user-org-main {
  position: relative;
  z-index: 1;
}

.user-org-sidebar :deep(.ant-spin-nested-loading) {
  min-height: 0;
  flex: 1;
  overflow: visible;
}

.user-org-sidebar :deep(.ant-spin-container) {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  overflow: visible;
}

.user-org-tree {
  min-height: 0;
  flex: 1;
  position: relative;
  z-index: 1;
  overflow-y: auto;
  overflow-x: visible;
}

.user-org-tree :deep(.ant-tree-node-content-wrapper) {
  min-width: 0;
  overflow: visible;
}

.user-org-tree-node {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 28px;
  align-items: center;
  position: relative;
}

.user-org-tree-node--actions-visible .user-org-tree-node-title {
  padding-right: 88px;
}

.user-org-tree-node--actions-visible {
  z-index: 2;
}

.user-org-tree-node-icon {
  flex-shrink: 0;
  color: currentColor;
}

.user-org-type-legend {
  display: grid;
  width: min(320px, 72vw);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.user-org-type-legend-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: hsl(var(--foreground));
  line-height: 22px;
}

.user-org-tree-actions {
  position: absolute;
  top: 50%;
  right: 2px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--popover));
  box-shadow: 0 4px 10px hsl(var(--foreground) / 12%);
  transform: translateY(-50%);
}

.user-org-tree-actions :deep(.ant-btn) {
  min-width: 22px;
  padding-inline: 3px;
}
</style>
