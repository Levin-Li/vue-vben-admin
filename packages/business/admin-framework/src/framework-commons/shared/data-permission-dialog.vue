<script lang="ts" setup>
import type {
  DataPermissionPreviewPayload,
  DataPermissionSubjectType,
  OrgTreeNode,
} from './data-permission-types';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/runtime/icons';
import { useUserStore } from '@vben/runtime/stores';

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Empty,
  Input,
  List,
  message,
  Modal,
  Select,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  TreeSelect,
} from 'ant-design-vue';

import { rbacService } from '../app/api/rbac-service';
import { requestClient } from '../runtime';
import { tenantDataScopeOptionsLoader } from './config-helpers';
import { isPlatformUser, isTenantAdminUser } from './user-identity';

type ScopeField =
  | 'deniedDomainScopeList'
  | 'deniedOrgScopeList'
  | 'deniedTenantScopeList'
  | 'domainScopeList'
  | 'orgScopeList'
  | 'tenantScopeList';
type ScopeKind = 'domain' | 'org' | 'tenant';
type ScopeSide = 'allow' | 'deny';
type Option = {
  description?: string;
  label: string;
  preset?: boolean;
  value: string;
};
interface ScopeTab {
  allowField: ScopeField;
  denyField: ScopeField;
  kind: ScopeKind;
  label: string;
}

const props = defineProps<{
  loadDomainOptions?: (keyword?: string) => Promise<Option[]>;
  open: boolean;
  previewPayload?: DataPermissionPreviewPayload;
  record: null | Record<string, any>;
  subjectType: DataPermissionSubjectType;
}>();
const emit = defineEmits<{ saved: []; 'update:open': [boolean] }>();
const scopeTabs: ScopeTab[] = [
  {
    allowField: 'domainScopeList',
    denyField: 'deniedDomainScopeList',
    kind: 'domain',
    label: '领域',
  },
  {
    allowField: 'tenantScopeList',
    denyField: 'deniedTenantScopeList',
    kind: 'tenant',
    label: '租户',
  },
  {
    allowField: 'orgScopeList',
    denyField: 'deniedOrgScopeList',
    kind: 'org',
    label: '组织',
  },
];
const activeKey = ref<ScopeKind>('domain');
const candidateKind = ref<ScopeKind>('domain');
const candidateKeyword = ref('');
const candidateLoading = ref(false);
const candidateOptions = ref<Option[]>([]);
const candidateOpen = ref(false);
const candidateSide = ref<ScopeSide>('allow');
const candidateEditingValue = ref('');
const orgMatchingMode = ref('SelfAndAllChild');
const orgMatchingExpression = ref('');
const orgStartValue = ref('_DEFAULT_');
const isNoOrgStart = computed(() => orgStartValue.value === '_NONE_');
const detail = ref<null | Record<string, any>>(null);
const domainOptions = ref<Option[]>([]);
const knownOptions = ref<Option[]>([]);
const errorMessage = ref('');
const loading = ref(false);
const orgTree = ref<OrgTreeNode[]>([]);
const saving = ref(false);
const userStore = useUserStore();
const scopeValues = ref<Record<ScopeField, null | string[]>>({
  deniedDomainScopeList: [],
  deniedOrgScopeList: [],
  deniedTenantScopeList: [],
  domainScopeList: [],
  orgScopeList: [],
  tenantScopeList: [],
});
const savedValues = ref<Record<ScopeField, null | string[]>>({
  deniedDomainScopeList: [],
  deniedOrgScopeList: [],
  deniedTenantScopeList: [],
  domainScopeList: [],
  orgScopeList: [],
  tenantScopeList: [],
});
const isUser = computed(() => props.subjectType === 'user');
const apiBase = computed(() => (isUser.value ? '/User' : '/Role'));
const modalTitle = computed(() =>
  isUser.value ? '用户数据权限分配' : '角色数据权限分配',
);
const isPlatformOperator = computed(() => isPlatformUser(userStore.userInfo));
const canConfigureDomainScope = computed(() => isPlatformOperator.value || isTenantAdminUser(userStore.userInfo));
const hasGroovyOrgRule = computed(() =>
  [
    ...(scopeValues.value.orgScopeList || []),
    ...(scopeValues.value.deniedOrgScopeList || []),
  ].some((value) => value.includes('|Groovy#')),
);
const isOrgScopeReadOnly = computed(
  () => !isSuperAdmin.value && hasGroovyOrgRule.value,
);
const visibleScopeTabs = computed(() =>
  scopeTabs.filter((tab) =>
    tab.kind === 'tenant'
      ? isPlatformOperator.value
      : tab.kind === 'domain'
        ? canConfigureDomainScope.value
        : true,
  ),
);
const hasChanges = computed(
  () => visibleScopeTabs.value.flatMap((tab) => fieldsChanged(tab)).length > 0,
);
const modalBodyStyle = {
  height: '640px',
  maxHeight: 'calc(100vh - 220px)',
  overflow: 'hidden',
} as const;
const candidateModalBodyStyle = {
  maxHeight: '420px',
  overflowY: 'auto',
} as const;
const summaryText = computed(() =>
  detail.value
    ? [
        detail.value.name,
        detail.value.code || detail.value.loginName,
        detail.value.org?.name || detail.value.orgName,
      ]
        .filter(Boolean)
        .join(' / ')
    : '',
);
const tenantBuiltinOptions: Option[] = [
  {
    description: '匹配所有租户的数据。',
    label: '全部租户',
    preset: true,
    value: '_ALL_',
  },
  {
    description: '平台用户匹配无租户数据；租户用户匹配本租户数据。',
    label: '默认租户',
    preset: true,
    value: '_DEFAULT_',
  },
  {
    description: '匹配无归属租户的数据。',
    label: '无租户',
    preset: true,
    value: '_NONE_',
  },
];
const domainBuiltinOptions: Option[] = [
  {
    description: '匹配所有领域的数据。',
    label: '全部领域',
    preset: true,
    value: '_ALL_',
  },
  {
    description: '匹配无归属领域的数据。',
    label: '无领域',
    preset: true,
    value: '_NONE_',
  },
];
const orgBuiltinOptions: Option[] = [
  {
    description: '匹配默认组织及其全部下级组织的数据。',
    label: '默认组织（含全部下级）',
    preset: true,
    value: '_DEFAULT_|SelfAndAllChild',
  },
  {
    description: '匹配无归属组织的数据。',
    label: '无组织',
    preset: true,
    value: '_NONE_|Self',
  },
  {
    description: '匹配所有根组织及其全部下级组织的数据。',
    label: '全部根组织（含全部下级）',
    preset: true,
    value: '_ALL_ROOT_|SelfAndAllChild',
  },
];
const orgMatchingModeOptions = [
  { label: '仅自身', value: 'Self' },
  { label: '仅直接下级', value: 'DirectChild' },
  { label: '自身及直接下级', value: 'SelfAndDirectChild' },
  { label: '自身及全部下级', value: 'SelfAndAllChild' },
  { label: '基于 ID 的路径', value: 'IdPath' },
  { label: '基于名称的路径', value: 'NamePath' },
  { label: 'Groovy 表达式', value: 'Groovy' },
];
const orgPresetStartLabels: Record<string, string> = {
  _ALL_ROOT_: '全部根组织',
  _DEFAULT_: '默认组织',
  _NONE_: '无组织',
};
const orgMatchingModeLabels = new Map(
  orgMatchingModeOptions.map((item) => [item.value, item.label]),
);
const orgExpressionModeSet = new Set(['Groovy', 'IdPath', 'NamePath']);
const availableOrgMatchingModeOptions = computed(() =>
  orgMatchingModeOptions.filter(
    (item) => item.value !== 'Groovy' || isSuperAdmin.value,
  ),
);
const requiresOrgMatchingExpression = computed(() =>
  orgExpressionModeSet.has(orgMatchingMode.value),
);
function cloneValue(value: null | string[]) {
  return value === null ? null : [...value];
}
function toScopeValue(value: unknown): null | string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(String).filter((item) => item.trim().length > 0))]
    : null;
}
function setDetailState(nextDetail: Record<string, any>) {
  detail.value = nextDetail;
  for (const tab of scopeTabs)
    for (const field of [tab.allowField, tab.denyField]) {
      const value = toScopeValue(nextDetail[field]);

      // 角色不存在字段级继承开关，空值必须作为可编辑的空列表初始化。
      const initialValue = !isUser.value && value === null ? [] : value;
      scopeValues.value[field] = cloneValue(initialValue);
      savedValues.value[field] = cloneValue(initialValue);
    }
}
function flattenOrgOptions(
  nodes: OrgTreeNode[],
  result: Option[],
  prefix = '',
) {
  for (const node of nodes) {
    const id = String(node.id);
    const name = String(node.name || node.title || id);
    result.push({
      label: `${prefix}${name}（自身及下级）`,
      value: `${id}|SelfAndAllChild`,
    });
    flattenOrgOptions(node.children || [], result, `${prefix}${name} / `);
  }
}
const orgOptions = computed(() => {
  const result = [...orgBuiltinOptions];
  flattenOrgOptions(orgTree.value, result);
  return result;
});
function toOrgTreeData(nodes: OrgTreeNode[]): Array<Record<string, any>> {
  return nodes.map((node) => ({
    children: toOrgTreeData(node.children || []),
    title: String(node.name || node.title || node.id),
    value: String(node.id),
  }));
}
function findOrgName(nodes: OrgTreeNode[], id: string): null | string {
  for (const node of nodes) {
    if (String(node.id) === id)
      return String(node.name || node.title || node.id);
    const childName = findOrgName(node.children || [], id);
    if (childName) return childName;
  }
  return null;
}
function parseOrgRule(value: string) {
  const [startValue, rawMode = 'SelfAndAllChild'] = value.split('|');
  const matchingMode =
    orgMatchingModeOptions.find((item) => rawMode.startsWith(`${item.value}#`))
      ?.value || rawMode;
  const expression = rawMode.startsWith(`${matchingMode}#`)
    ? rawMode.slice(matchingMode.length + 1)
    : '';
  return { expression, matchingMode, startValue };
}
function orgRuleStartLabel(value: string) {
  const { startValue } = parseOrgRule(value);
  return (
    orgPresetStartLabels[startValue] ||
    findOrgName(orgTree.value, startValue) ||
    startValue
  );
}
function orgRuleMatchingModeLabel(value: string) {
  const { expression, matchingMode, startValue } = parseOrgRule(value);
  return startValue === '_NONE_'
    ? '—'
    : [orgMatchingModeLabels.get(matchingMode) || matchingMode, expression]
        .filter(Boolean)
        .join('：');
}
function isOrgMatchingModePreset(value: string) {
  const { matchingMode, startValue } = parseOrgRule(value);
  return (
    startValue !== '_NONE_' &&
    orgMatchingModeLabels.has(matchingMode) &&
    !orgExpressionModeSet.has(matchingMode)
  );
}
function orgMatchingModeBadge(value: string) {
  const { matchingMode } = parseOrgRule(value);
  return (
    {
      Groovy: 'Groovy匹配',
      IdPath: 'ID匹配',
      NamePath: '名称匹配',
    }[matchingMode] || ''
  );
}
function orgRuleLabel(value: string) {
  return `${orgRuleStartLabel(value)} ${orgRuleMatchingModeLabel(value)}`;
}
function orgRuleStartTooltip(value: string) {
  const description = presetDescription('org', value);
  return description
    ? `${orgRuleStartLabel(value)}：${description}`
    : orgRuleStartLabel(value);
}
const orgStartTreeData = computed(() => [
  {
    children: [
      { title: '默认组织', value: '_DEFAULT_' },
      { title: '无组织', value: '_NONE_' },
      { title: '全部根组织', value: '_ALL_ROOT_' },
    ],
    disabled: true,
    title: '预设值',
    value: '__preset__',
  },
  ...toOrgTreeData(orgTree.value),
]);
function builtinOptions(kind: ScopeKind): Option[] {
  if (kind === 'tenant')
    return tenantBuiltinOptions.filter(
      (item) => item.value !== '_ALL_' || isSuperAdmin.value,
    );
  if (kind === 'domain')
    return domainBuiltinOptions.filter(
      (item) => item.value !== '_ALL_' || isSuperAdmin.value,
    );
  return orgOptions.value.filter(
    (item) => item.value !== '_ALL_ROOT_|SelfAndAllChild' || isSuperAdmin.value,
  );
}
function fieldFor(tab: ScopeTab, side: ScopeSide) {
  return side === 'allow' ? tab.allowField : tab.denyField;
}
function isTabReadOnly(tab: ScopeTab) {
  return tab.kind === 'org' && isOrgScopeReadOnly.value;
}
function isFieldUnset(field: ScopeField) {
  return scopeValues.value[field] === null;
}
function isFieldCustom(field: ScopeField) {
  return !isFieldUnset(field);
}
function setFieldCustom(field: ScopeField, checked: boolean, tab: ScopeTab) {
  if (!isUser.value || isTabReadOnly(tab)) return;
  if (checked) {
    scopeValues.value[field] = [];
    return;
  }
  const current = scopeValues.value[field] || [];
  if (current.length === 0) {
    scopeValues.value[field] = null;
    return;
  }
  Modal.confirm({
    content: '取消自定义会清空当前列表，并继承有效角色的对应范围。',
    okText: '清空并继承',
    onOk: () => {
      scopeValues.value[field] = null;
    },
    title: '确认取消自定义？',
  });
}
function optionLabel(kind: ScopeKind, value: string) {
  if (kind === 'org') return orgRuleLabel(value);
  return (
    [
      ...builtinOptions(kind),
      ...knownOptions.value,
      ...domainOptions.value,
      ...orgOptions.value,
    ].find((item) => item.value === value)?.label || value
  );
}
function cacheOptions(options: Option[]) {
  knownOptions.value = [
    ...new Map(
      [...knownOptions.value, ...options].map((item) => [item.value, item]),
    ).values(),
  ];
}
async function loadTenantDisplayOptions(values: string[]) {
  const ids = values.filter((value) => !value.startsWith('_'));
  if (ids.length === 0) return;
  const result: any = await requestClient.get('/Tenant/list', {
    params: { idList: ids, pageIndex: 1, pageSize: Math.min(ids.length, 50) },
  });
  const items = result?.items || result?.records || result || [];
  if (Array.isArray(items)) {
    cacheOptions(
      items.map((item) => ({
        label: String(item.name || item.code || item.id),
        value: String(item.id),
      })),
    );
  }
}
function isPresetValue(kind: ScopeKind, value: string) {
  if (kind === 'org')
    return Boolean(orgPresetStartLabels[parseOrgRule(value).startValue]);
  return builtinOptions(kind).some((item) => item.value === value);
}
function orderedValues(kind: ScopeKind, values: string[]) {
  return values.toSorted((left, right) => {
    const presetOrder =
      Number(isPresetValue(kind, right)) - Number(isPresetValue(kind, left));
    return (
      presetOrder ||
      optionLabel(kind, left).localeCompare(optionLabel(kind, right))
    );
  });
}
function presetDescription(kind: ScopeKind, value: string) {
  if (kind === 'org') {
    const { matchingMode, startValue } = parseOrgRule(value);
    if (startValue === '_NONE_') return '匹配无归属组织的数据。';
    const startLabel = orgPresetStartLabels[startValue];
    const modeLabel = orgMatchingModeLabels.get(matchingMode);
    return startLabel && modeLabel
      ? `匹配${startLabel}${modeLabel}的数据。`
      : undefined;
  }
  return builtinOptions(kind).find((item) => item.value === value)?.description;
}
function fieldsChanged(tab: ScopeTab) {
  return [tab.allowField, tab.denyField].filter(
    (field) =>
      JSON.stringify(scopeValues.value[field]) !==
      JSON.stringify(savedValues.value[field]),
  );
}
async function loadData() {
  if (!props.open) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    if (props.previewPayload) {
      setDetailState(props.previewPayload.detail);
      orgTree.value = props.previewPayload.orgTree;
      return;
    }
    if (!props.record?.id) return;
    const [nextDetail, nextOrgTree, nextDomainOptions] = await Promise.all([
      requestClient.get<Record<string, any>>(`${apiBase.value}/retrieve`, {
        params: { id: props.record.id },
      }),
      rbacService.fetchAuthorizedOrgTree() as Promise<OrgTreeNode[]>,
      props.loadDomainOptions ? props.loadDomainOptions() : Promise.resolve([]),
    ]);
    setDetailState(nextDetail);
    orgTree.value = nextOrgTree || [];
    domainOptions.value = nextDomainOptions || [];
    cacheOptions(domainOptions.value);
    try {
      await loadTenantDisplayOptions([
        ...(scopeValues.value.tenantScopeList || []),
        ...(scopeValues.value.deniedTenantScopeList || []),
      ]);
    } catch (error) {
      console.warn('租户范围名称回显失败', error);
    }
  } catch (error) {
    console.error(error);
    errorMessage.value = '加载数据权限信息失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}
async function loadCandidates(nextKeyword?: string) {
  candidateLoading.value = true;
  try {
    const keyword = String(nextKeyword ?? candidateKeyword.value).trim();
    const presetOptions = builtinOptions(candidateKind.value);
    let remoteOptions: Option[] = [];
    if (candidateKind.value === 'domain') {
      remoteOptions = props.loadDomainOptions
        ? await props.loadDomainOptions(keyword)
        : [];
    } else if (candidateKind.value === 'tenant') {
      remoteOptions = await tenantDataScopeOptionsLoader(keyword);
    } else {
      remoteOptions = orgOptions.value.filter((item) =>
        item.label.includes(keyword),
      );
      remoteOptions = remoteOptions.slice(0, keyword ? 50 : 10);
    }
    const editingOption = candidateEditingValue.value
      ? [
          {
            label: optionLabel(candidateKind.value, candidateEditingValue.value),
            preset: isPresetValue(
              candidateKind.value,
              candidateEditingValue.value,
            ),
            value: candidateEditingValue.value,
          },
        ]
      : [];
    candidateOptions.value = [
      ...new Map(
        [...editingOption, ...presetOptions, ...remoteOptions].map((item) => [
          item.value,
          item,
        ]),
      ).values(),
    ];
    cacheOptions(candidateOptions.value);
  } finally {
    candidateLoading.value = false;
  }
}
async function openCandidate(tab: ScopeTab, side: ScopeSide) {
  if (isTabReadOnly(tab)) return;
  candidateKind.value = tab.kind;
  candidateSide.value = side;
  candidateEditingValue.value = '';
  candidateKeyword.value = '';
  orgStartValue.value = '_DEFAULT_';
  orgMatchingMode.value = 'SelfAndAllChild';
  orgMatchingExpression.value = '';
  candidateOpen.value = true;
  await loadCandidates();
}
async function openCandidateEditor(
  tab: ScopeTab,
  side: ScopeSide,
  value: string,
) {
  if (isTabReadOnly(tab)) return;

  candidateKind.value = tab.kind;
  candidateSide.value = side;
  candidateEditingValue.value = value;
  candidateKeyword.value = '';

  if (tab.kind === 'org') {
    const rule = parseOrgRule(value);
    orgStartValue.value = rule.startValue;
    orgMatchingMode.value = rule.matchingMode;
    orgMatchingExpression.value = rule.expression;
  } else {
    candidateOptions.value = [
      {
        label: optionLabel(tab.kind, value),
        preset: isPresetValue(tab.kind, value),
        value,
      },
    ];
  }

  candidateOpen.value = true;
  await loadCandidates();
}
function addCandidate(tab: ScopeTab, value: string) {
  const field = fieldFor(tab, candidateSide.value);
  const current = scopeValues.value[field] || [];
  const editingValue = candidateEditingValue.value;

  scopeValues.value[field] = editingValue
    ? [...new Set(current.map((item) => (item === editingValue ? value : item)))]
    : [...new Set([value, ...current])];
}
function addOrgRule(tab: ScopeTab, closeAfterAdd = false) {
  const matchingRule = requiresOrgMatchingExpression.value
    ? `${orgMatchingMode.value}#${orgMatchingExpression.value.trim()}`
    : orgMatchingMode.value;
  addCandidate(
    tab,
    `${orgStartValue.value}|${isNoOrgStart.value ? 'Self' : matchingRule}`,
  );
  if (closeAfterAdd || candidateEditingValue.value) candidateOpen.value = false;
}
function isCandidateAdded(tab: ScopeTab, value: string) {
  return (
    value !== candidateEditingValue.value &&
    (scopeValues.value[fieldFor(tab, candidateSide.value)] || []).includes(
      value,
    )
  );
}
function removeValue(field: ScopeField, value: string) {
  if (
    isOrgScopeReadOnly.value &&
    (field === 'orgScopeList' || field === 'deniedOrgScopeList')
  ) {
    return;
  }
  scopeValues.value[field] = (scopeValues.value[field] || []).filter(
    (item) => item !== value,
  );
}
async function saveChanges(closeAfterSave = false) {
  const changed = visibleScopeTabs.value.flatMap((tab) => fieldsChanged(tab));
  if (!detail.value?.id || saving.value || changed.length === 0) return;
  saving.value = true;
  try {
    const payload: Record<string, any> = {
      autoForceUpdateField: false,
      forceUpdateFields: changed,
      id: detail.value.id,
      optimisticLock: detail.value.optimisticLock,
    };
    for (const field of changed)
      payload[field] =
        scopeValues.value[field] === null
          ? null
          : [...new Set(scopeValues.value[field] || [])];
    if (props.previewPayload) {
      for (const field of changed)
        savedValues.value[field] = cloneValue(scopeValues.value[field]);
      message.success('预览模式下已模拟保存');
      emit('saved');
      if (closeAfterSave) emit('update:open', false);
      return;
    }
    const updated: any = await requestClient.put(
      `${apiBase.value}/update`,
      payload,
    );
    if (updated?.optimisticLock !== undefined && detail.value)
      detail.value.optimisticLock = updated.optimisticLock;
    await loadData();
    message.success('数据权限已保存');
    emit('saved');
    if (closeAfterSave) emit('update:open', false);
  } finally {
    saving.value = false;
  }
}
watch(
  () => [props.open, props.record?.id, props.subjectType] as const,
  ([open]) => {
    if (open) void loadData();
  },
  { immediate: true },
);
</script>

<template>
  <Modal
    :footer="null"
    :mask-closable="false"
    :open="open"
    :title="summaryText ? `${modalTitle}【${summaryText}】` : modalTitle"
    :width="1180"
    :body-style="modalBodyStyle"
    destroy-on-close
    @cancel="emit('update:open', false)"
  >
    <div class="flex h-full min-h-0 flex-col">
      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
        <div class="space-y-4">
          <Alert
            v-if="errorMessage"
            :message="errorMessage"
            show-icon
            type="error"
          />
          <Spin :spinning="loading">
            <Tabs v-model:active-key="activeKey">
              <Tabs.TabPane v-for="tab in visibleScopeTabs" :key="tab.kind">
                <template #tab>
                  <span class="inline-flex items-center gap-1">
                    {{ tab.label }}
                    <Badge
                      :count="(scopeValues[tab.allowField] || []).length"
                      :number-style="{ backgroundColor: '#22c55e' }"
                    />
                    <Badge
                      :count="(scopeValues[tab.denyField] || []).length"
                      :number-style="{ backgroundColor: '#ef4444' }"
                    />
                  </span>
                </template>
                <div class="space-y-4 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <Alert
                      class="flex-1"
                      :message="`仅可添加当前操作者实际拥有的${tab.label}范围；服务端会再次校验。`"
                      show-icon
                      type="info"
                    />
                  </div>
                  <Alert
                    v-if="isTabReadOnly(tab)"
                    message="当前组织范围包含 Groovy 表达式，只有超级管理员可以编辑。"
                    show-icon
                    type="warning"
                  />
                  <div class="grid grid-cols-2 gap-4">
                    <section
                      v-for="side in ['allow', 'deny'] as ScopeSide[]"
                      :key="side"
                      class="flex h-[390px] flex-col rounded-lg border border-slate-200 p-4"
                    >
                      <div class="mb-3 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                          <strong>
                            {{ side === 'allow' ? '允许列表' : '拒绝列表' }}
                          </strong>
                          <Checkbox
                            v-if="isUser"
                            :checked="isFieldCustom(fieldFor(tab, side))"
                            :disabled="isTabReadOnly(tab)"
                            @update:checked="
                              setFieldCustom(fieldFor(tab, side), $event, tab)
                            "
                          >
                            自定义
                          </Checkbox>
                        </div>
                        <Button
                          :disabled="
                            isTabReadOnly(tab) ||
                            isFieldUnset(fieldFor(tab, side))
                          "
                          size="small"
                          type="primary"
                          @click="openCandidate(tab, side)"
                        >
                          添加
                        </Button>
                      </div>
                      <div class="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div
                          v-if="
                            tab.kind === 'org' &&
                            (scopeValues[fieldFor(tab, side)] || []).length > 0
                          "
                          class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 px-3 pb-2 text-xs text-slate-500"
                        >
                          <span>起点根组织</span>
                          <span>子组织匹配模式</span>
                          <span class="w-12"></span>
                        </div>
                        <List
                          v-if="
                            (scopeValues[fieldFor(tab, side)] || []).length > 0
                          "
                          :data-source="
                            orderedValues(
                              tab.kind,
                              scopeValues[fieldFor(tab, side)] || [],
                            )
                          "
                          :split="false"
                          size="small"
                        >
                          <template #renderItem="{ item }">
                            <List.Item
                              class="transition-colors hover:bg-blue-50/60"
                            >
                              <div
                                v-if="tab.kind === 'org'"
                                class="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3"
                              >
                                <Tooltip
                                  v-if="isPresetValue(tab.kind, item)"
                                  :title="orgRuleStartTooltip(item)"
                                >
                                  <span
                                    class="relative block min-w-0 max-w-full pt-4"
                                  >
                                    <span
                                      class="block truncate whitespace-nowrap"
                                    >
                                      {{ orgRuleStartLabel(item) }}
                                    </span>
                                    <Tag
                                      class="absolute left-0 top-0 !m-0 !rounded-sm !px-1 !py-0 !text-[12px] !leading-4"
                                      color="blue"
                                    >
                                      预设值
                                    </Tag>
                                  </span>
                                </Tooltip>
                                <Tooltip
                                  v-else
                                  :title="orgRuleStartTooltip(item)"
                                >
                                  <span
                                    class="block truncate whitespace-nowrap"
                                  >
                                    {{ orgRuleStartLabel(item) }}
                                  </span>
                                </Tooltip>
                                <span
                                  v-if="isOrgMatchingModePreset(item)"
                                  :title="orgRuleMatchingModeLabel(item)"
                                >
                                  <span
                                    class="relative block min-w-0 max-w-full pt-4"
                                  >
                                    <span
                                      class="block truncate whitespace-nowrap"
                                    >
                                      {{ orgRuleMatchingModeLabel(item) }}
                                    </span>
                                    <Tag
                                      class="absolute left-0 top-0 !m-0 !rounded-sm !px-1 !py-0 !text-[12px] !leading-4"
                                      color="blue"
                                    >
                                      预设值
                                    </Tag>
                                  </span>
                                </span>
                                <Tooltip
                                  v-else
                                  :title="orgRuleMatchingModeLabel(item)"
                                >
                                  <span
                                    class="relative block min-w-0 max-w-full pt-4"
                                  >
                                    <span
                                      class="block truncate whitespace-nowrap"
                                    >
                                      {{ orgRuleMatchingModeLabel(item) }}
                                    </span>
                                    <Tag
                                      v-if="orgMatchingModeBadge(item)"
                                      class="absolute left-0 top-0 !m-0 !rounded-sm !px-1 !py-0 !text-[12px] !leading-4"
                                      color="blue"
                                    >
                                      {{ orgMatchingModeBadge(item) }}
                                    </Tag>
                                  </span>
                                </Tooltip>
                                <div class="flex items-center gap-1">
                                  <Tooltip title="编辑">
                                    <Button
                                      :aria-label="`编辑${orgRuleLabel(item)}`"
                                      :disabled="isTabReadOnly(tab)"
                                      size="small"
                                      type="text"
                                      @click="openCandidateEditor(tab, side, item)"
                                    >
                                      <IconifyIcon
                                        class="size-4"
                                        icon="lucide:pencil"
                                      />
                                    </Button>
                                  </Tooltip>
                                  <Tooltip title="删除">
                                  <Button
                                    aria-label="删除"
                                    class="border border-rose-200 text-rose-500 hover:!border-rose-300 hover:!bg-rose-50"
                                    :disabled="isTabReadOnly(tab)"
                                    danger
                                    size="small"
                                    type="text"
                                    @click="
                                      removeValue(fieldFor(tab, side), item)
                                    "
                                  >
                                    <IconifyIcon
                                      class="size-4"
                                      icon="lucide:minus"
                                    />
                                  </Button>
                                </Tooltip>
                                </div>
                              </div>
                              <template v-else>
                                <Tooltip
                                  v-if="isPresetValue(tab.kind, item)"
                                  :title="presetDescription(tab.kind, item)"
                                >
                                  <span class="relative inline-block pt-4">
                                    {{ optionLabel(tab.kind, item) }}
                                    <Tag
                                      class="absolute left-0 top-0 !m-0 !rounded-sm !px-1 !py-0 !text-[12px] !leading-4"
                                      color="blue"
                                    >
                                      预设值
                                    </Tag>
                                  </span>
                                </Tooltip>
                                <span v-else>
                                  {{ optionLabel(tab.kind, item) }}
                                </span>
                                <div class="flex items-center gap-1">
                                  <Tooltip title="编辑">
                                    <Button
                                      :aria-label="`编辑${optionLabel(tab.kind, item)}`"
                                      :disabled="isTabReadOnly(tab)"
                                      size="small"
                                      type="text"
                                      @click="openCandidateEditor(tab, side, item)"
                                    >
                                      <IconifyIcon
                                        class="size-4"
                                        icon="lucide:pencil"
                                      />
                                    </Button>
                                  </Tooltip>
                                  <Tooltip title="删除">
                                  <Button
                                    aria-label="删除"
                                    class="border border-rose-200 text-rose-500 hover:!border-rose-300 hover:!bg-rose-50"
                                    :disabled="isTabReadOnly(tab)"
                                    danger
                                    size="small"
                                    type="text"
                                    @click="
                                      removeValue(fieldFor(tab, side), item)
                                    "
                                  >
                                    <IconifyIcon
                                      class="size-4"
                                      icon="lucide:minus"
                                    />
                                  </Button>
                                </Tooltip>
                                </div>
                              </template>
                            </List.Item>
                          </template>
                        </List>
                        <Empty
                          v-else
                          :description="
                            isUser && isFieldUnset(fieldFor(tab, side))
                              ? '不设置（继承）'
                              : '暂无配置'
                          "
                          :image="Empty.PRESENTED_IMAGE_SIMPLE"
                        />
                      </div>
                    </section>
                  </div>
                </div>
              </Tabs.TabPane>
            </Tabs>
          </Spin>
        </div>
      </div>
      <div
        class="mt-4 flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white pb-1 pt-3"
      >
        <Button
          :disabled="!hasChanges"
          :loading="saving"
          type="primary"
          @click="saveChanges"
        >
          保存
        </Button>
        <Button
          :disabled="!hasChanges"
          :loading="saving"
          @click="saveChanges(true)"
        >
          保存并关闭
        </Button>
      </div>
    </div>
  </Modal>
  <Modal
    v-model:open="candidateOpen"
    :footer="null"
    :title="`${candidateEditingValue ? '编辑' : '添加'}${candidateSide === 'allow' ? '允许' : '拒绝'}${candidateKind === 'domain' ? '领域' : candidateKind === 'tenant' ? '租户' : '组织'}`"
    :width="480"
    :body-style="candidateModalBodyStyle"
  >
    <Input
      v-if="candidateKind !== 'org'"
      v-model:value="candidateKeyword"
      allow-clear
      class="mb-3"
      placeholder="输入名称搜索"
      @update:value="loadCandidates"
      @press-enter="loadCandidates"
    />
    <div v-if="candidateKind === 'org'" class="space-y-4">
      <div>
        <div class="mb-1 text-sm font-medium">起点根组织</div>
        <TreeSelect
          v-model:value="orgStartValue"
          allow-clear
          class="w-full"
          :tree-data="orgStartTreeData"
          placeholder="请选择起点根组织"
          show-search
          tree-default-expand-all
        />
      </div>
      <div>
        <div class="mb-1 text-sm font-medium">子组织匹配模式</div>
        <Select
          v-model:value="orgMatchingMode"
          class="w-full"
          :disabled="isNoOrgStart"
          :options="availableOrgMatchingModeOptions"
        />
        <div v-if="isNoOrgStart" class="mt-1 text-xs text-gray-500">
          无组织不包含下级组织，此匹配模式不生效。
        </div>
      </div>
      <div v-if="!isNoOrgStart && requiresOrgMatchingExpression">
        <div class="mb-1 text-sm font-medium">匹配表达式</div>
        <Input.TextArea
          v-if="orgMatchingMode === 'Groovy'"
          v-model:value="orgMatchingExpression"
          :rows="3"
          placeholder="Groovy 可用变量：_org、_user"
        />
        <Input
          v-else
          v-model:value="orgMatchingExpression"
          :placeholder="
            orgMatchingMode === 'IdPath'
              ? '例如：/* 或 /组织ID/**'
              : orgMatchingMode === 'NamePath'
                ? '例如：/* 或 /组织名称/**'
                : ''
          "
        />
        <div class="mt-1 text-xs text-gray-500">
          <template v-if="orgMatchingMode === 'Groovy'">
            Groovy 属于动态代码，仅超级管理员可以配置。
          </template>
          <template v-else>
            使用 Spring PathPattern：/ 为起点组织，* 匹配一层，**
            匹配零层或多层。
          </template>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button
          :disabled="
            !orgStartValue ||
            (!isNoOrgStart &&
              (!orgMatchingMode ||
                (requiresOrgMatchingExpression &&
                  !orgMatchingExpression.trim())))
          "
          type="primary"
          @click="addOrgRule(scopeTabs.find((tab) => tab.kind === 'org')!)"
        >
          {{ candidateEditingValue ? '保存' : '添加' }}
        </Button>
        <Button
          :disabled="
            !orgStartValue ||
            (!isNoOrgStart &&
              (!orgMatchingMode ||
                (requiresOrgMatchingExpression &&
                  !orgMatchingExpression.trim())))
          "
          @click="
            addOrgRule(scopeTabs.find((tab) => tab.kind === 'org')!, true)
          "
        >
          {{ candidateEditingValue ? '保存并关闭' : '添加并关闭' }}
        </Button>
      </div>
    </div>
    <Spin v-else :spinning="candidateLoading">
      <List
        v-if="candidateOptions.length > 0"
        :data-source="candidateOptions"
        bordered
        :split="false"
        size="small"
      >
        <template #renderItem="{ item }">
          <List.Item class="group transition-colors hover:bg-blue-50/60">
            <Tooltip v-if="item.preset" :title="item.description">
              <span class="relative inline-block pt-4">
                {{ item.label }}
                <Tag
                  class="absolute left-0 top-0 !m-0 !rounded-sm !px-1 !py-0 !text-[12px] !leading-4"
                  color="blue"
                >
                  预设值
                </Tag>
              </span>
            </Tooltip>
            <span v-else>
              {{ item.label }}
            </span>
            <Button
              class="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
              :disabled="
                isCandidateAdded(
                  scopeTabs.find((tab) => tab.kind === candidateKind)!,
                  item.value,
                )
              "
              size="small"
              type="primary"
              @click="
                addCandidate(
                  scopeTabs.find((tab) => tab.kind === candidateKind)!,
                  item.value,
                );
                candidateEditingValue && (candidateOpen = false)
              "
            >
              {{
                candidateEditingValue
                  ? '保存'
                  : isCandidateAdded(
                        scopeTabs.find((tab) => tab.kind === candidateKind)!,
                        item.value,
                      )
                    ? '已添加'
                    : '添加'
              }}
            </Button>
          </List.Item>
        </template>
      </List>
      <Empty v-else description="没有可添加的候选资源" />
    </Spin>
  </Modal>
</template>
