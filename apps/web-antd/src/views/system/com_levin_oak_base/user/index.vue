<script lang="ts" setup>
import type { SelectOption } from '#/api';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Switch,
  Tree,
  TreeSelect,
  Tooltip,
} from 'ant-design-vue';

import { fetchTreeOptions } from '#/api';
import { orgService } from '#/api/com_levin_oak_base/org';

import CrudPage from '../crud-page.vue';
import {
  DEFAULT_CRUD_MODAL_WIDTH,
  OAK_BASE_API_MODULE,
  orgTypeOptionsLoader,
} from '../api-module';
import { buildCrudOperationPermissions } from '../../shared/crud-permissions';
import DataPermissionDialog from '../../shared/data-permission-dialog.vue';
import { userPageCrudConfig } from './config';

interface OrgTreeNode {
  children?: OrgTreeNode[];
  disabled?: boolean;
  key: string;
  label: string;
  title: string;
  value: string;
}

const dialogOpen = ref(false);
const pageKey = ref(0);
const selectedRecord = ref<null | Record<string, any>>(null);

const orgTreeLoading = ref(false);
const orgSubmitting = ref(false);
const orgKeyword = ref('');
const selectedOrgId = ref('');
const hoveredOrgId = ref('');
const expandedOrgKeys = ref<string[]>([]);
const orgTreeData = ref<OrgTreeNode[]>([]);
const orgTypeOptions = ref<Array<{ label: string; value: string }>>([]);

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
        value: id,
      };
    });
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

async function loadOrgTree() {
  orgTreeLoading.value = true;

  try {
    const options = await fetchTreeOptions(
      '/rbac/authorizedOrgList',
      'name',
      'id',
      {
        assembleTree: true,
      },
      OAK_BASE_API_MODULE,
    );
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
    const payload = {
      code: orgFormState.code || undefined,
      editable: orgFormState.editable,
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
  <div class="user-org-page flex h-full min-h-0 gap-4">
    <aside
      class="user-org-sidebar flex w-[320px] shrink-0 flex-col rounded-lg border border-border bg-card p-4"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-base font-semibold">组织机构</div>
          <div class="truncate text-xs text-muted-foreground">
            {{ selectedOrgName || '请选择组织节点' }}
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Tooltip title="刷新">
            <Button
              :loading="orgTreeLoading"
              aria-label="刷新组织"
              shape="circle"
              size="small"
              @click="loadOrgTree"
            >
              <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
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
              class="user-org-tree-node"
              @mouseenter="hoveredOrgId = String(node.key)"
              @mouseleave="hoveredOrgId = ''"
            >
              <span class="min-w-0 flex-1 truncate">{{ node.title }}</span>
              <span
                v-if="hoveredOrgId === String(node.key)"
                class="user-org-tree-actions"
              >
                <Button
                  size="small"
                  title="新增下级组织"
                  type="text"
                  @click.stop="openCreateOrgModal(String(node.key))"
                >
                  +
                </Button>
                <Button
                  size="small"
                  title="编辑组织"
                  type="text"
                  @click.stop="openEditOrgModal(String(node.key))"
                >
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除当前组织节点吗？"
                  @confirm="deleteOrg(String(node.key))"
                >
                  <Button
                    danger
                    size="small"
                    title="删除组织"
                    type="text"
                    @click.stop
                  >
                    -
                  </Button>
                </Popconfirm>
              </span>
            </div>
          </template>
        </Tree>
        <Empty v-else description="暂无组织" />
      </Spin>
    </aside>

    <main class="min-w-0 flex-1">
      <CrudPage v-if="selectedOrgId" :key="crudPageKey" :config="userConfig" />
      <div
        v-else
        class="flex h-full items-center justify-center rounded-lg border border-border bg-card"
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
      v-model:open="orgModalOpen"
      :confirm-loading="orgSubmitting"
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
              :options="orgTypeOptions"
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
          <Form.Item label="是否可编辑">
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
  --user-org-sidebar-height: calc(100vh - 132px);
}

.user-org-sidebar {
  max-height: var(--user-org-sidebar-height);
  min-height: 520px;
}

.user-org-tree {
  max-height: calc(var(--user-org-sidebar-height) - 156px);
  overflow: auto;
}

.user-org-tree-node {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.user-org-tree-actions {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}

.user-org-tree-actions :deep(.ant-btn) {
  min-width: 24px;
  padding-inline: 4px;
}
</style>
