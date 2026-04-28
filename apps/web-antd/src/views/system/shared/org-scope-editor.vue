<script lang="ts" setup>
import type { OrgScopeDraft, OrgTreeNode } from './data-permission-types';

import { computed, reactive, ref, watch } from 'vue';

import {
  Button,
  Empty,
  message,
  Modal,
  Radio,
  Select,
  TreeSelect,
} from 'ant-design-vue';

import {
  ALL_ROOT_ORG_ID,
  DEFAULT_ORG_SCOPE_EXPRESSION_TYPE,
  DEFAULT_TENANT_MATCHING_EXPRESSION,
  flattenOrgTree,
  getScopeKeyByExpression,
  getTenantMatchingExpressionLabel,
  normalizeOrgScopeExpressionType,
  normalizeOrgScopeId,
  normalizeScopeKey,
  TENANT_GROOVY_EXPRESSION_PREFIX,
  USER_DEFAULT_ORG_ID,
} from './data-permission-transform';

const props = defineProps<{
  expressionTypes?: string[];
  loadTenantOptions?: (
    keyword?: string,
  ) => Promise<Array<{ label: string; value: boolean | number | string }>>;
  orgTree: OrgTreeNode[];
  showTenantMatchingExpression?: boolean;
  value: OrgScopeDraft[];
}>();

const emit = defineEmits<{
  'update:value': [OrgScopeDraft[]];
}>();

interface OrgSelectOption {
  children?: OrgSelectOption[];
  disabled?: boolean;
  orgId?: string;
  orgName?: string;
  title: string;
  value: string;
}

type TenantMatchingMode =
  | 'all'
  | 'default'
  | 'groovy'
  | 'none'
  | 'path'
  | 'tenant';

const ALL_ORG_VALUE = 'scope:all';
const USER_DEFAULT_ORG_VALUE = 'scope:user-default';
const API_ORG_PREFIX = 'scope:api:';

const scopeOptions = [
  { expression: '/', label: '仅本节点', value: 'OnlySelf' },
  { expression: '/*/', label: '仅直接子节点', value: 'OnlyDirectChild' },
  {
    expression: '/*',
    label: '本节点及直接子节点',
    value: 'SelfAndDirectChild',
  },
  { expression: '/**', label: '本节点及所有子节点', value: 'All' },
  { expression: '', label: '自定义表达式', value: 'Custom' },
];

const allowOptions = [
  { label: '允许', value: true },
  { label: '拒绝', value: false },
];

const tenantMatchingModeOptions = [
  { label: '默认租户', value: 'default' },
  { label: '所有租户', value: 'all' },
  { label: '无租户', value: 'none' },
  { label: '指定租户', value: 'tenant' },
  { label: '路径表达式', value: 'path' },
  { label: 'Groovy 脚本', value: 'groovy' },
];

const tenantMatchingExpressionPlaceholder = `普通文本按租户ID精确匹配；路径表达式使用 Spring PathPattern；Groovy 脚本会自动添加 ${TENANT_GROOVY_EXPRESSION_PREFIX} 前缀`;
const tenantGroovyVariablesTip =
  'Groovy 可用变量：_tenant 当前租户；_user 当前登录用户；_scope 当前组织范围规则。';
const orgScopeGroovyVariablesTip =
  'Groovy 可用变量：_org 当前被匹配组织节点；_user 当前登录用户。';

const editingIndex = ref<null | number>(null);
const formOpen = ref(false);
const tenantOptions = ref<Array<{ label: string; value: string }>>([]);
const tenantOptionsLoading = ref(false);
const tenantMatchingMode = ref<TenantMatchingMode>('default');
const tenantMatchingValue = ref('');

const formState = reactive<
  OrgScopeDraft & {
    orgSelectValue: string;
  }
>({
  isAllow: true,
  mode: 'template',
  orgId: '',
  orgName: '',
  orgScopeExpression: '',
  orgScopeExpressionType: DEFAULT_ORG_SCOPE_EXPRESSION_TYPE,
  orgSelectValue: '',
  templateKey: 'All',
  tenantMatchingExpression: DEFAULT_TENANT_MATCHING_EXPRESSION,
});

const flatOrgTree = computed(() => flattenOrgTree(props.orgTree));

const expressionTypeOptions = computed(() =>
  (props.expressionTypes || ['IdPath', 'NamePath', 'Groovy', 'SpringEL']).map(
    (value) => {
      const normalizedValue = normalizeOrgScopeExpressionType(value);
      return {
        label: normalizedValue,
        value: normalizedValue,
      };
    },
  ),
);

const orgSelectTreeData = computed<OrgSelectOption[]>(() => [
  {
    orgId: USER_DEFAULT_ORG_ID,
    orgName: '用户默认组织',
    title: '用户默认组织',
    value: USER_DEFAULT_ORG_VALUE,
  },
  {
    orgId: ALL_ROOT_ORG_ID,
    orgName: '所有根组织',
    title: '所有根组织',
    value: ALL_ORG_VALUE,
  },
  ...normalizeOrgOptions(props.orgTree),
]);

const showTenantMatchingValueControl = computed(() =>
  ['groovy', 'path', 'tenant'].includes(tenantMatchingMode.value),
);

const tenantMatchingValuePlaceholder = computed(() => {
  if (tenantMatchingMode.value === 'tenant') {
    return '请选择租户';
  }

  if (tenantMatchingMode.value === 'groovy') {
    return '请输入 Groovy 脚本内容，不需要手动输入 #!groovy: 前缀';
  }

  return '请输入租户ID或 Spring PathPattern 表达式';
});

const orgScopeExpressionPlaceholder = computed(() =>
  formState.orgScopeExpressionType === 'Groovy'
    ? '请输入 Groovy 脚本，可使用 _org、_user'
    : '请输入 Spring PathPattern、Groovy 或 SpringEL 表达式',
);

function normalizeOrgOptions(nodes: OrgTreeNode[]): OrgSelectOption[] {
  return nodes.map((node) => {
    const title = node.name || node.title || node.id;

    return {
      children: normalizeOrgOptions(node.children || []),
      orgId: node.id,
      orgName: title,
      title,
      value: `${API_ORG_PREFIX}${encodeURIComponent(node.id)}`,
    };
  });
}

function findOrgOption(
  nodes: OrgSelectOption[],
  value: string,
): OrgSelectOption | undefined {
  for (const node of nodes) {
    if (node.value === value) {
      return node;
    }

    const child = findOrgOption(node.children || [], value);
    if (child) {
      return child;
    }
  }
}

function getOrgName(orgId: string) {
  if (normalizeOrgScopeId(orgId) === ALL_ROOT_ORG_ID) {
    return '所有根组织';
  }

  if (orgId === USER_DEFAULT_ORG_ID) {
    return '用户默认组织';
  }

  const org = flatOrgTree.value.find((item) => item.id === orgId);
  return org?.title || orgId;
}

function encodeOrgValue(orgId: string) {
  if (normalizeOrgScopeId(orgId) === ALL_ROOT_ORG_ID) {
    return ALL_ORG_VALUE;
  }

  if (orgId === USER_DEFAULT_ORG_ID) {
    return USER_DEFAULT_ORG_VALUE;
  }

  return `${API_ORG_PREFIX}${encodeURIComponent(orgId)}`;
}

function buildScopeExpression(templateKey: string) {
  return (
    scopeOptions.find((item) => item.value === templateKey)?.expression || ''
  );
}

function parseTenantMatchingExpression(value?: string): {
  mode: TenantMatchingMode;
  value: string;
} {
  const nextValue = String(value ?? DEFAULT_TENANT_MATCHING_EXPRESSION).trim();

  if (!nextValue) {
    return { mode: 'none', value: '' };
  }

  if (nextValue === DEFAULT_TENANT_MATCHING_EXPRESSION) {
    return { mode: 'default', value: '' };
  }

  if (nextValue === '*') {
    return { mode: 'all', value: '' };
  }

  if (nextValue.startsWith(TENANT_GROOVY_EXPRESSION_PREFIX)) {
    return {
      mode: 'groovy',
      value: nextValue.slice(TENANT_GROOVY_EXPRESSION_PREFIX.length),
    };
  }

  if (nextValue.includes('/') || nextValue.includes('*')) {
    return { mode: 'path', value: nextValue };
  }

  return { mode: 'tenant', value: nextValue };
}

function buildTenantMatchingExpression(
  mode: TenantMatchingMode,
  value: string,
) {
  const nextValue = String(value || '').trim();

  if (mode === 'default') {
    return DEFAULT_TENANT_MATCHING_EXPRESSION;
  }

  if (mode === 'all') {
    return '*';
  }

  if (mode === 'none') {
    return '';
  }

  if (mode === 'groovy') {
    return nextValue
      ? `${TENANT_GROOVY_EXPRESSION_PREFIX}${nextValue.replace(
          TENANT_GROOVY_EXPRESSION_PREFIX,
          '',
        )}`
      : TENANT_GROOVY_EXPRESSION_PREFIX;
  }

  return nextValue;
}

function syncTenantMatchingExpression() {
  formState.tenantMatchingExpression = buildTenantMatchingExpression(
    tenantMatchingMode.value,
    tenantMatchingValue.value,
  );
}

function applyTenantMatchingExpression(value?: string) {
  const parsed = parseTenantMatchingExpression(value);
  tenantMatchingMode.value = parsed.mode;
  tenantMatchingValue.value = parsed.value;
  syncTenantMatchingExpression();
}

async function loadTenantOptions(keyword?: string) {
  if (tenantOptionsLoading.value) {
    return;
  }

  tenantOptionsLoading.value = true;

  try {
    tenantOptions.value = (
      props.loadTenantOptions ? await props.loadTenantOptions(keyword) : []
    ).map((item) => ({
      label: String(item.label ?? item.value ?? ''),
      value: String(item.value ?? ''),
    }));
  } catch (error) {
    console.error(error);
    message.error('加载租户列表失败，请稍后重试');
  } finally {
    tenantOptionsLoading.value = false;
  }
}

function handleTenantMatchingModeChange(value: unknown) {
  tenantMatchingMode.value = String(value || 'default') as TenantMatchingMode;

  if (!showTenantMatchingValueControl.value) {
    tenantMatchingValue.value = '';
  }

  if (tenantMatchingMode.value === 'tenant') {
    void loadTenantOptions();
  }

  syncTenantMatchingExpression();
}

function handleTenantMatchingValueChange(value: unknown) {
  tenantMatchingValue.value = String(value ?? '');
  syncTenantMatchingExpression();
}

function isCustomScope() {
  return formState.templateKey === 'Custom';
}

function getDraftScopeLabel(draft: OrgScopeDraft) {
  const scopeKey = getScopeKeyByExpression(draft.orgScopeExpression);
  return (
    scopeOptions.find((item) => item.value === scopeKey)?.label ||
    '自定义表达式'
  );
}

function resetForm() {
  Object.assign(formState, {
    isAllow: true,
    mode: 'template',
    orgId: '',
    orgName: '',
    orgScopeExpression: '',
    orgScopeExpressionType: DEFAULT_ORG_SCOPE_EXPRESSION_TYPE,
    orgSelectValue: '',
    templateKey: 'All',
    tenantMatchingExpression: DEFAULT_TENANT_MATCHING_EXPRESSION,
  });
  applyTenantMatchingExpression(DEFAULT_TENANT_MATCHING_EXPRESSION);
}

function applyOrgSelection(value: string) {
  const option = findOrgOption(orgSelectTreeData.value, value);
  if (!option?.orgId) {
    return;
  }

  formState.orgSelectValue = value;
  formState.orgId = normalizeOrgScopeId(option.orgId);
  formState.orgName = option.orgName || getOrgName(option.orgId);

  if (formState.templateKey !== 'Custom') {
    formState.orgScopeExpression = buildScopeExpression(formState.templateKey);
  }
}

function openCreateForm() {
  editingIndex.value = null;
  resetForm();
  applyOrgSelection(USER_DEFAULT_ORG_VALUE);

  formOpen.value = true;
}

function openEditForm(index: number) {
  const draft = props.value[index];
  if (!draft) {
    return;
  }

  editingIndex.value = index;
  const templateKey =
    normalizeScopeKey(draft.templateKey) ||
    getScopeKeyByExpression(draft.orgScopeExpression);

  Object.assign(formState, {
    ...draft,
    orgId: normalizeOrgScopeId(draft.orgId),
    orgScopeExpressionType: normalizeOrgScopeExpressionType(
      draft.orgScopeExpressionType || draft.expressionType,
    ),
    mode: templateKey === 'Custom' ? 'advanced' : 'template',
    orgName: draft.orgName || getOrgName(draft.orgId),
    orgSelectValue: encodeOrgValue(draft.orgId),
    templateKey,
    tenantMatchingExpression:
      draft.tenantMatchingExpression || DEFAULT_TENANT_MATCHING_EXPRESSION,
  });
  applyTenantMatchingExpression(formState.tenantMatchingExpression);
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
}

function handleRemove(index: number) {
  emit(
    'update:value',
    props.value.filter((_, itemIndex) => itemIndex !== index),
  );
}

function handleRemoveWithConfirm(index: number) {
  const draft = props.value[index];

  Modal.confirm({
    cancelText: '取消',
    content: `确定要删除“${draft?.orgName || draft?.orgId || '当前'}”的组织范围规则吗？删除后需点击弹窗确定才会保存到后端。`,
    okText: '删除',
    okType: 'danger',
    title: '确认删除规则',
    onOk: () => handleRemove(index),
  });
}

function handleExpressionTypeChange(value: unknown) {
  formState.orgScopeExpressionType = normalizeOrgScopeExpressionType(
    String(value || ''),
  );
}

function handleScopeChange(value: unknown) {
  const templateKey = String(value || '');
  formState.templateKey = templateKey;
  formState.mode = templateKey === 'Custom' ? 'advanced' : 'template';

  if (templateKey !== 'Custom') {
    formState.orgScopeExpressionType = DEFAULT_ORG_SCOPE_EXPRESSION_TYPE;
    formState.orgScopeExpression = buildScopeExpression(templateKey);
    return;
  }

  formState.orgScopeExpressionType =
    formState.orgScopeExpressionType || DEFAULT_ORG_SCOPE_EXPRESSION_TYPE;
}

function handleExpressionChange(expression: string) {
  formState.mode = 'advanced';
  formState.templateKey = 'Custom';
  formState.orgScopeExpression = expression;
}

function handleSubmitForm() {
  if (!formState.orgId) {
    message.warning('请选择组织范围');
    return;
  }

  if (
    props.showTenantMatchingExpression &&
    showTenantMatchingValueControl.value &&
    !tenantMatchingValue.value.trim()
  ) {
    message.warning('请填写租户匹配表达式的值');
    return;
  }

  if (isCustomScope() && !formState.orgScopeExpressionType) {
    message.warning('请选择表达式类型');
    return;
  }

  if (isCustomScope() && !formState.orgScopeExpression) {
    message.warning('请输入组织范围表达式');
    return;
  }

  const orgScopeExpressionType = isCustomScope()
    ? formState.orgScopeExpressionType
    : DEFAULT_ORG_SCOPE_EXPRESSION_TYPE;
  const orgScopeExpression = isCustomScope()
    ? formState.orgScopeExpression
    : buildScopeExpression(formState.templateKey);

  const draft: OrgScopeDraft = {
    isAllow: formState.isAllow,
    mode: formState.mode,
    orgId: normalizeOrgScopeId(formState.orgId),
    orgName: formState.orgName,
    orgScopeExpression,
    orgScopeExpressionType,
    templateKey: formState.templateKey,
    tenantMatchingExpression: props.showTenantMatchingExpression
      ? formState.tenantMatchingExpression || DEFAULT_TENANT_MATCHING_EXPRESSION
      : DEFAULT_TENANT_MATCHING_EXPRESSION,
  };

  const next =
    editingIndex.value === null
      ? [...props.value, draft]
      : props.value.map((item, index) =>
          index === editingIndex.value ? draft : item,
        );

  emit('update:value', next);
  closeForm();
}

function getExpressionPreview(draft: OrgScopeDraft) {
  return draft.orgScopeExpression || '未填写';
}

const tableColumnCount = computed(() =>
  props.showTenantMatchingExpression ? 6 : 5,
);

watch(formOpen, (open) => {
  if (!open) {
    editingIndex.value = null;
  }
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex justify-end">
      <Button data-test="scope-add-rule" type="primary" @click="openCreateForm">
        新增规则
      </Button>
    </div>

    <div class="overflow-hidden rounded border border-border">
      <table class="w-full table-fixed text-left text-sm">
        <thead class="bg-muted">
          <tr>
            <th
              v-if="showTenantMatchingExpression"
              class="px-3 py-2 font-medium"
            >
              租户匹配表达式
            </th>
            <th class="px-3 py-2 font-medium">组织标识</th>
            <th class="w-24 px-3 py-2 font-medium">访问许可</th>
            <th class="w-40 px-3 py-2 font-medium">组织范围表达式类型</th>
            <th class="px-3 py-2 font-medium">组织范围表达式</th>
            <th class="w-32 px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="value.length === 0">
            <td :colspan="tableColumnCount" class="px-3 py-10">
              <Empty description="暂无组织范围规则，请点击新增规则" />
            </td>
          </tr>
          <tr
            v-for="(draft, index) in value"
            :key="`${draft.orgId}-${index}`"
            class="border-t border-border"
          >
            <td v-if="showTenantMatchingExpression" class="px-3 py-2">
              <span class="line-clamp-2 break-all">
                {{
                  getTenantMatchingExpressionLabel(
                    draft.tenantMatchingExpression,
                  )
                }}
              </span>
            </td>
            <td class="px-3 py-2">
              <div class="font-medium text-foreground">
                {{ draft.orgName || getOrgName(draft.orgId) }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ draft.orgId }}
              </div>
            </td>
            <td class="px-3 py-2">
              {{ draft.isAllow ? '允许' : '拒绝' }}
            </td>
            <td class="px-3 py-2">
              {{ draft.orgScopeExpressionType || '-' }}
            </td>
            <td class="px-3 py-2">
              <span class="line-clamp-2 break-all">
                {{ getDraftScopeLabel(draft) }}
                <span class="text-muted-foreground">
                  / {{ getExpressionPreview(draft) }}
                </span>
              </span>
            </td>
            <td class="px-3 py-2">
              <div class="flex gap-2">
                <button
                  :data-test="`org-edit-${draft.orgId}`"
                  class="text-primary"
                  type="button"
                  @click="openEditForm(index)"
                >
                  编辑
                </button>
                <button
                  :data-test="`org-remove-${draft.orgId}`"
                  class="text-destructive"
                  type="button"
                  @click="handleRemoveWithConfirm(index)"
                >
                  删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal
      :open="formOpen"
      :title="editingIndex === null ? '新增组织范围规则' : '编辑组织范围规则'"
      destroy-on-close
      @cancel="closeForm"
      @ok="handleSubmitForm"
    >
      <div class="space-y-4">
        <div v-if="showTenantMatchingExpression" class="space-y-1 text-sm">
          <span class="text-muted-foreground">租户匹配表达式</span>
          <div class="grid grid-cols-[180px_1fr] gap-2">
            <Select
              :options="tenantMatchingModeOptions"
              :value="tenantMatchingMode"
              class="w-full"
              @change="handleTenantMatchingModeChange"
            />
            <Select
              v-if="tenantMatchingMode === 'tenant'"
              :filter-option="
                (input, option) =>
                  String(option?.label || '')
                    .toLowerCase()
                    .includes(String(input).toLowerCase())
              "
              :loading="tenantOptionsLoading"
              :options="tenantOptions"
              :placeholder="tenantMatchingValuePlaceholder"
              :value="tenantMatchingValue || undefined"
              allow-clear
              class="w-full"
              show-search
              @change="handleTenantMatchingValueChange"
              @focus="() => loadTenantOptions()"
              @search="loadTenantOptions"
            />
            <input
              v-else-if="showTenantMatchingValueControl"
              :value="tenantMatchingValue"
              class="w-full rounded border border-border bg-background px-3 py-2"
              :placeholder="tenantMatchingValuePlaceholder"
              @input="
                handleTenantMatchingValueChange(
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
            <div
              v-else
              class="flex min-h-9 items-center rounded border border-border bg-muted px-3 text-muted-foreground"
            >
              {{
                getTenantMatchingExpressionLabel(
                  formState.tenantMatchingExpression,
                )
              }}
            </div>
          </div>
          <span class="block text-xs text-muted-foreground">
            {{ tenantMatchingExpressionPlaceholder }}
          </span>
          <span
            v-if="tenantMatchingMode === 'groovy'"
            class="block text-xs text-muted-foreground"
          >
            {{ tenantGroovyVariablesTip }}
          </span>
        </div>

        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">组织标识</span>
          <TreeSelect
            :value="formState.orgSelectValue"
            :tree-data="orgSelectTreeData"
            allow-clear
            class="w-full"
            placeholder="请选择组织范围"
            show-search
            tree-default-expand-all
            tree-node-filter-prop="title"
            @change="(value) => applyOrgSelection(String(value || ''))"
          />
        </label>

        <div class="flex flex-col gap-2 text-sm">
          <span class="block text-muted-foreground">访问许可</span>
          <Radio.Group
            v-model:value="formState.isAllow"
            :options="allowOptions"
            class="block"
          />
        </div>

        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">组织范围表达式</span>
          <Select
            :options="scopeOptions"
            :value="formState.templateKey"
            class="w-full"
            @change="handleScopeChange"
          />
        </label>

        <template v-if="isCustomScope()">
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">组织范围表达式类型</span>
            <Select
              :options="expressionTypeOptions"
              :value="formState.orgScopeExpressionType"
              class="w-full"
              show-search
              @change="handleExpressionTypeChange"
            />
          </label>

          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">组织范围表达式</span>
            <textarea
              data-test="org-expression-editor"
              :value="formState.orgScopeExpression"
              class="min-h-24 w-full rounded border border-border bg-background px-3 py-2"
              :placeholder="orgScopeExpressionPlaceholder"
              @input="
                handleExpressionChange(
                  ($event.target as HTMLTextAreaElement).value,
                )
              "
            ></textarea>
            <span
              v-if="formState.orgScopeExpressionType === 'Groovy'"
              class="block text-xs text-muted-foreground"
            >
              {{ orgScopeGroovyVariablesTip }}
            </span>
          </label>
        </template>
      </div>
    </Modal>
  </div>
</template>
