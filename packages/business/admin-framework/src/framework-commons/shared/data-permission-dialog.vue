<script lang="ts" setup>
import type {
  DataPermissionPreviewPayload,
  DataPermissionSubjectType,
  OrgTreeNode,
} from './data-permission-types';

import { computed, ref, watch } from 'vue';

import { useAppConfig } from '@vben/runtime/hooks';
import { useUserStore } from '@vben/runtime/stores';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  message,
  Modal,
  Segmented,
  Select,
  Spin,
  Switch,
  Tabs,
  TreeSelect,
} from 'ant-design-vue';

import { buildModuleRequestPath } from '../api';
import { rbacService } from '../app/api/rbac-service';
import { requestClient } from '../runtime';
import { tenantDataScopeOptionsLoader } from './config-helpers';
import {
  isPlatformUser,
  isSuperAdminUser,
  isTenantAdminUser,
} from './user-identity';
import UserOrgSelector from './user-org-selector.vue';

type ScopeField =
  | 'deniedDomainScopeList'
  | 'deniedOrgScopeList'
  | 'deniedTenantScopeList'
  | 'domainScopeList'
  | 'orgScopeList'
  | 'tenantScopeList';
type ScopeKind = 'domain' | 'org' | 'tenant';
type ScopeSide = 'allow' | 'deny';
type ScopeChoice = 'none' | ScopeSide;
type ScopeMode = 'allowAll' | 'custom' | 'denyAll';
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
const choiceOptions = [
  { label: '未设置', value: 'none' },
  { label: '允许', value: 'allow' },
  { label: '禁止', value: 'deny' },
];
const activeKey = ref<ScopeKind>('domain');
const candidateKeyword = ref('');
const candidateLoading = ref(false);
const advancedMode = ref(false);
const advancedCandidateOpen = ref(false);
const advancedCandidateKind = ref<ScopeKind>('domain');
const advancedCandidateSide = ref<ScopeSide>('allow');
const advancedEditingValue = ref('');
const advancedKeyword = ref('');
const advancedOptions = ref<Option[]>([]);
const advancedLoading = ref(false);
const advancedTenantPage = ref(0);
const advancedTenantHasMore = ref(false);
let advancedGeneration = 0;
const advancedOrgStart = ref('_DEFAULT_');
const advancedOrgMode = ref('SelfAndAllChild');
const advancedOrgExpression = ref('');
const modeSnapshots = new Map<
  ScopeKind,
  { allow: null | string[]; deny: null | string[] }
>();
const tenantOptions = ref<Option[]>([]);
const tenantPage = ref(0);
const tenantHasMore = ref(true);
let candidateGeneration = 0;
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
const runtimeEnv = (import.meta as ImportMeta & { env: Record<string, any> })
  .env;
const { apiURL } = useAppConfig(runtimeEnv, Boolean(runtimeEnv.PROD));
const apiBase = computed(() =>
  buildModuleRequestPath(isUser.value ? '/User' : '/Role', apiURL),
);
const modalTitle = computed(() =>
  isUser.value ? '用户数据权限分配' : '角色数据权限分配',
);
const isPlatformOperator = computed(() => isPlatformUser(userStore.userInfo));
// 全域预设和脚本规则沿用超级管理员专属边界，平台普通用户只获得平台页可见性。
const isSuperAdmin = computed(() => isSuperAdminUser(userStore.userInfo));
const canConfigureDomainScope = computed(
  () => isPlatformOperator.value || isTenantAdminUser(userStore.userInfo),
);
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
  scopeTabs.filter((tab) => {
    if (tab.kind === 'tenant') return isPlatformOperator.value;
    if (tab.kind === 'domain') return canConfigureDomainScope.value;
    return true;
  }),
);
const hasChanges = computed(
  () => visibleScopeTabs.value.flatMap((tab) => fieldsChanged(tab)).length > 0,
);
const modalBodyStyle = {
  height: '640px',
  maxHeight: 'calc(100vh - 220px)',
  overflow: 'hidden',
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
    label: '用户默认租户',
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
    description: '按所选匹配模式匹配用户默认组织的数据。',
    label: '用户默认组织',
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
    description: '按所选匹配模式匹配全部根组织的数据。',
    label: '全部根组织',
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
const orgInlineMatchingModeOptions = orgMatchingModeOptions.slice(0, 4);
const orgInlineMatchingModes = new Set(
  orgInlineMatchingModeOptions.map((item) => item.value),
);
const orgModeDraft = ref<Record<string, string>>({});
const savedOrgInlineModes = computed(() => {
  const modes = new Map<string, string>();
  for (const value of [
    ...(scopeValues.value.deniedOrgScopeList || []),
    ...(scopeValues.value.orgScopeList || []),
  ]) {
    const rule = parseOrgRule(value);
    if (
      !modes.has(rule.startValue) &&
      orgInlineMatchingModes.has(rule.matchingMode)
    )
      modes.set(rule.startValue, rule.matchingMode);
  }
  return modes;
});
const configuredOrgIds = computed(() => [
  ...new Set(
    [
      ...(scopeValues.value.orgScopeList || []),
      ...(scopeValues.value.deniedOrgScopeList || []),
    ]
      .map((value) => parseOrgRule(value).startValue)
      .filter((value) => value && !value.startsWith('_')),
  ),
]);
const orgPresetStartLabels: Record<string, string> = {
  _ALL_ROOT_: '全部根组织',
  _DEFAULT_: '用户默认组织',
  _NONE_: '无组织',
};
const orgMatchingModeLabels = new Map(
  orgMatchingModeOptions.map((item) => [item.value, item.label]),
);
const advancedNoOrg = computed(() => advancedOrgStart.value === '_NONE_');
const advancedRequiresExpression = computed(() =>
  ['Groovy', 'IdPath', 'NamePath'].includes(advancedOrgMode.value),
);
const advancedOrgModeOptions = computed(() =>
  orgMatchingModeOptions.filter(
    (item) => item.value !== 'Groovy' || isSuperAdmin.value,
  ),
);
function cloneValue(value: null | string[]) {
  return value === null ? null : [...value];
}
function removeRules(value: null | string[], rules: Set<string>) {
  return value === null ? null : value.filter((item) => !rules.has(item));
}
function toScopeValue(value: unknown): null | string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(String).filter((item) => item.trim().length > 0))]
    : null;
}
function setDetailState(nextDetail: Record<string, any>) {
  modeSnapshots.clear();
  orgModeDraft.value = {};
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
function toAdvancedOrgTreeData(
  nodes: OrgTreeNode[],
): Array<Record<string, any>> {
  return nodes.map((node) => ({
    children: toAdvancedOrgTreeData(node.children || []),
    title: String(node.name || node.title || node.id),
    value: String(node.id),
  }));
}
const advancedOrgTreeData = computed(() => [
  {
    children: [
      { title: '用户默认组织', value: '_DEFAULT_' },
      { title: '无组织', value: '_NONE_' },
      ...(isSuperAdmin.value
        ? [{ title: '全部根组织', value: '_ALL_ROOT_' }]
        : []),
    ],
    disabled: true,
    title: '预设值',
    value: '__preset__',
  },
  ...toAdvancedOrgTreeData(orgTree.value),
]);
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
  const [startValue = '', rawMode = 'SelfAndAllChild'] = value.split('|');
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
function orgRuleLabel(value: string) {
  return `${orgRuleStartLabel(value)} ${orgRuleMatchingModeLabel(value)}`;
}
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
function allRowOptions(tab: ScopeTab) {
  const saved: Option[] = [
    ...(scopeValues.value[tab.allowField] || []),
    ...(scopeValues.value[tab.denyField] || []),
  ].map((value) => ({ label: optionLabel(tab.kind, value), value }));
  let available: Option[] = orgOptions.value;
  if (tab.kind === 'domain') available = domainOptions.value;
  if (tab.kind === 'tenant') available = tenantOptions.value;
  return [
    ...new Map(
      [...builtinOptions(tab.kind), ...saved, ...available].map((item) => [
        item.value,
        item,
      ]),
    ).values(),
  ];
}
function allTokens(tab: ScopeTab) {
  return tab.kind === 'org' ? ['_ALL_ROOT_|SelfAndAllChild'] : ['_ALL_'];
}
function scopeMode(tab: ScopeTab): ScopeMode {
  const allow = scopeValues.value[tab.allowField] || [];
  const deny = scopeValues.value[tab.denyField] || [];
  const all = allTokens(tab);
  if (all.every((value) => deny.includes(value))) return 'denyAll';
  const relevantDeny =
    tab.kind === 'org' ? deny.filter((value) => value !== '_NONE_|Self') : deny;
  if (relevantDeny.length === 0 && all.every((value) => allow.includes(value)))
    return 'allowAll';
  return 'custom';
}
function setScopeMode(tab: ScopeTab, mode: ScopeMode) {
  if (isTabReadOnly(tab) || !isTabCustom(tab)) return;
  const current = scopeMode(tab);
  if (current === mode) return;
  if (mode === 'custom') {
    const snapshot = modeSnapshots.get(tab.kind);
    const all = new Set(allTokens(tab));
    scopeValues.value[tab.allowField] = snapshot
      ? cloneValue(snapshot.allow)
      : removeRules(scopeValues.value[tab.allowField], all);
    scopeValues.value[tab.denyField] = snapshot
      ? cloneValue(snapshot.deny)
      : removeRules(scopeValues.value[tab.denyField], all);
    modeSnapshots.delete(tab.kind);
    return;
  }
  if (current === 'custom' && !modeSnapshots.has(tab.kind)) {
    modeSnapshots.set(tab.kind, {
      allow: cloneValue(scopeValues.value[tab.allowField]),
      deny: cloneValue(scopeValues.value[tab.denyField]),
    });
  }
  const independentAllow =
    tab.kind === 'org'
      ? (scopeValues.value[tab.allowField] || []).filter(
          (value) => value === '_NONE_|Self',
        )
      : [];
  const independentDeny =
    tab.kind === 'org'
      ? (scopeValues.value[tab.denyField] || []).filter(
          (value) => value === '_NONE_|Self',
        )
      : [];
  scopeValues.value[tab.allowField] = [
    ...independentAllow,
    ...(mode === 'allowAll' ? allTokens(tab) : []),
  ];
  scopeValues.value[tab.denyField] = [
    ...independentDeny,
    ...(mode === 'denyAll' ? allTokens(tab) : []),
  ];
  candidateKeyword.value = '';
}
function allChoice(tab: ScopeTab): ScopeChoice {
  const all = allTokens(tab);
  if (
    all.every((value) =>
      (scopeValues.value[tab.denyField] || []).includes(value),
    )
  )
    return 'deny';
  if (
    all.every((value) =>
      (scopeValues.value[tab.allowField] || []).includes(value),
    )
  )
    return 'allow';
  return 'none';
}
function setAllChoice(tab: ScopeTab, choice: ScopeChoice) {
  if (allChoice(tab) === choice) return;
  if (choice === 'none' && scopeMode(tab) === 'custom') {
    const all = new Set(allTokens(tab));
    for (const field of [tab.allowField, tab.denyField])
      scopeValues.value[field] = removeRules(scopeValues.value[field], all);
    return;
  }
  let mode: ScopeMode = 'custom';
  if (choice === 'allow') mode = 'allowAll';
  if (choice === 'deny') mode = 'denyAll';
  setScopeMode(tab, mode);
}
function fixedOptions(tab: ScopeTab) {
  return builtinOptions(tab.kind)
    .filter((item) => item.preset)
    .map((item) =>
      tab.kind === 'org' && item.value === '_ALL_ROOT_|SelfAndAllChild'
        ? { ...item, label: '全部组织' }
        : item,
    )
    .toSorted(
      (left, right) =>
        Number(right.value === allTokens(tab)[0]) -
        Number(left.value === allTokens(tab)[0]),
    );
}
function visibleFixedOptions(tab: ScopeTab) {
  if (tab.kind === 'org') return fixedOptions(tab);
  return scopeMode(tab) === 'custom'
    ? fixedOptions(tab)
    : fixedOptions(tab).filter((item) => item.value === allTokens(tab)[0]);
}
// 固定项的组织起点与三档选择统一由规则起点解析，避免模板按具体模式判断。
function fixedOrgPresetStart(tab: ScopeTab, value: string) {
  if (tab.kind !== 'org') return '';
  if (value.startsWith('_ALL_ROOT_|')) return '_ALL_ROOT_';
  if (value.startsWith('_DEFAULT_|')) return '_DEFAULT_';
  return '';
}
function fixedChoice(tab: ScopeTab, item: Option): ScopeChoice {
  const start = fixedOrgPresetStart(tab, item.value);
  if (start) return orgPresetChoice(tab, start);
  return item.value === allTokens(tab)[0]
    ? allChoice(tab)
    : selectedChoice(tab, item.value);
}
function setFixedChoice(tab: ScopeTab, item: Option, choice: ScopeChoice) {
  const start = fixedOrgPresetStart(tab, item.value);
  if (start) {
    setOrgPresetChoice(tab, start, choice);
    return;
  }
  if (item.value === allTokens(tab)[0]) {
    setAllChoice(tab, choice);
    return;
  }
  setChoice(tab, item.value, choice);
}
function dynamicOptions(tab: ScopeTab) {
  const keyword = candidateKeyword.value.trim().toLowerCase();
  const fixed = new Set(fixedOptions(tab).map((item) => item.value));
  return allRowOptions(tab).filter(
    (item) =>
      !fixed.has(item.value) &&
      (!keyword ||
        item.label.toLowerCase().includes(keyword) ||
        item.value.toLowerCase().includes(keyword)),
  );
}
function isChecked(tab: ScopeTab, side: ScopeSide, value: string) {
  return (scopeValues.value[fieldFor(tab, side)] || []).includes(value);
}
function selectedChoice(tab: ScopeTab, value: string): ScopeChoice {
  if (isChecked(tab, 'deny', value)) return 'deny';
  if (isChecked(tab, 'allow', value)) return 'allow';
  return 'none';
}
function orgModeForNode(id: unknown) {
  const key = String(id);
  if (orgModeDraft.value[key]) return orgModeDraft.value[key];
  return savedOrgInlineModes.value.get(key) || '';
}
// 固定组织项与普通组织共用四种常用模式，规则仍写入原有范围字段。
function orgPresetMode(start: string) {
  return orgModeForNode(start);
}
function orgPresetChoice(tab: ScopeTab, start: string): ScopeChoice {
  for (const side of ['deny', 'allow'] as const) {
    const rules = scopeValues.value[fieldFor(tab, side)] || [];
    if (
      rules.some((value) => {
        const rule = parseOrgRule(value);
        return (
          rule.startValue === start &&
          orgInlineMatchingModes.has(rule.matchingMode)
        );
      })
    )
      return side;
  }
  return 'none';
}
function clearOrgPresetRules(tab: ScopeTab, start: string) {
  for (const side of ['allow', 'deny'] as const) {
    const field = fieldFor(tab, side);
    const current = scopeValues.value[field];
    scopeValues.value[field] =
      current === null
        ? null
        : current.filter((value) => {
            const rule = parseOrgRule(value);
            return (
              rule.startValue !== start ||
              !orgInlineMatchingModes.has(rule.matchingMode)
            );
          });
  }
}
function setOrgPresetChoice(tab: ScopeTab, start: string, choice: ScopeChoice) {
  if (isTabReadOnly(tab) || !isTabCustom(tab)) return;
  const mode = orgPresetMode(start) || 'SelfAndAllChild';
  if (start === '_ALL_ROOT_' && scopeMode(tab) !== 'custom')
    setScopeMode(tab, 'custom');
  clearOrgPresetRules(tab, start);
  if (choice === 'none') {
    const draft = { ...orgModeDraft.value };
    delete draft[start];
    orgModeDraft.value = draft;
    return;
  }
  orgModeDraft.value = { ...orgModeDraft.value, [start]: mode };
  if (start === '_ALL_ROOT_' && mode === 'SelfAndAllChild') {
    setScopeMode(tab, choice === 'allow' ? 'allowAll' : 'denyAll');
    return;
  }
  const field = fieldFor(tab, choice);
  scopeValues.value[field] = [
    ...new Set([`${start}|${mode}`, ...(scopeValues.value[field] || [])]),
  ];
}
function setOrgPresetMode(tab: ScopeTab, start: string, mode: string) {
  if (isTabReadOnly(tab) || !isTabCustom(tab)) return;
  if (!orgInlineMatchingModes.has(mode)) return;
  const choice = orgPresetChoice(tab, start);
  if (choice === 'none' || orgPresetMode(start) === mode) return;
  if (start === '_ALL_ROOT_' && scopeMode(tab) !== 'custom')
    setScopeMode(tab, 'custom');
  clearOrgPresetRules(tab, start);
  orgModeDraft.value = { ...orgModeDraft.value, [start]: mode };
  if (start === '_ALL_ROOT_' && mode === 'SelfAndAllChild') {
    setScopeMode(tab, choice === 'allow' ? 'allowAll' : 'denyAll');
    return;
  }
  const field = fieldFor(tab, choice);
  scopeValues.value[field] = [
    ...new Set([`${start}|${mode}`, ...(scopeValues.value[field] || [])]),
  ];
}
function orgRuleValue(id: unknown) {
  return `${String(id)}|${orgModeForNode(id) || 'SelfAndAllChild'}`;
}
function setOrgChoice(tab: ScopeTab, id: unknown, choice: ScopeChoice) {
  if (isTabReadOnly(tab) || !isTabCustom(tab)) return;
  const key = String(id);
  if (choice === 'none') {
    const current = [
      ...(scopeValues.value[tab.allowField] || []),
      ...(scopeValues.value[tab.denyField] || []),
    ];
    for (const value of current) {
      const rule = parseOrgRule(value);
      if (
        rule.startValue === key &&
        orgInlineMatchingModes.has(rule.matchingMode)
      )
        setChoice(tab, value, 'none');
    }
    const draft = { ...orgModeDraft.value };
    delete draft[key];
    orgModeDraft.value = draft;
    return;
  }
  setChoice(tab, orgRuleValue(key), choice);
}
function setOrgMode(tab: ScopeTab, id: unknown, mode: string) {
  if (isTabReadOnly(tab) || !isTabCustom(tab)) return;
  if (!orgInlineMatchingModes.has(mode)) return;
  const key = String(id);
  const previous = orgModeForNode(key);
  if (!previous || previous === mode) return;
  const oldRule = `${key}|${previous}`;
  const choice = selectedChoice(tab, oldRule);
  orgModeDraft.value = { ...orgModeDraft.value, [key]: mode };
  if (choice === 'none') return;
  setChoice(tab, oldRule, 'none');
  setChoice(tab, `${key}|${mode}`, choice);
}
const loadOrgTreeForSelector = async () => orgTree.value;
function isTabReadOnly(tab: ScopeTab) {
  return tab.kind === 'org' && isOrgScopeReadOnly.value;
}
function isFieldUnset(field: ScopeField) {
  return scopeValues.value[field] === null;
}
function isTabCustom(tab: ScopeTab) {
  return (
    !isUser.value ||
    !isFieldUnset(tab.allowField) ||
    !isFieldUnset(tab.denyField)
  );
}
function setChoice(tab: ScopeTab, value: string, choice: ScopeChoice) {
  if (isTabReadOnly(tab) || !isTabCustom(tab)) return;
  for (const side of ['allow', 'deny'] as const) {
    const field = fieldFor(tab, side);
    const current = scopeValues.value[field];
    scopeValues.value[field] =
      choice === side
        ? [...new Set([value, ...(current || [])])]
        : removeRules(current, new Set([value]));
  }
}
function setTabCustom(tab: ScopeTab, checked: boolean) {
  if (!isUser.value || isTabReadOnly(tab)) return;
  if (checked) {
    if (isFieldUnset(tab.allowField)) scopeValues.value[tab.allowField] = [];
    if (isFieldUnset(tab.denyField)) scopeValues.value[tab.denyField] = [];
    return;
  }
  const current = [
    ...(scopeValues.value[tab.allowField] || []),
    ...(scopeValues.value[tab.denyField] || []),
  ];
  const clear = () => {
    scopeValues.value[tab.allowField] = null;
    scopeValues.value[tab.denyField] = null;
  };
  if (current.length === 0) {
    clear();
    return;
  }
  Modal.confirm({
    content:
      '取消自定义会清空当前类别的允许与禁止设置，并继承有效角色的对应范围。',
    okText: '清空并继承',
    onOk: clear,
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
function advancedRuleDescription(kind: ScopeKind, value: string) {
  if (kind !== 'org')
    return builtinOptions(kind).find((item) => item.value === value)
      ?.description;
  if (value === '_NONE_|Self')
    return orgBuiltinOptions.find((item) => item.value === value)?.description;
  const { matchingMode, startValue } = parseOrgRule(value);
  const start = orgPresetStartLabels[startValue];
  if (!start) return undefined;
  if (matchingMode === 'Self') return `仅匹配${start}自身的数据。`;
  if (matchingMode === 'DirectChild') return `仅匹配${start}直接下级的数据。`;
  if (matchingMode === 'SelfAndDirectChild')
    return `匹配${start}及其直接下级的数据。`;
  const mode = orgMatchingModeLabels.get(matchingMode) || matchingMode;
  return `按${mode}匹配${start}的数据。`;
}
function cacheOptions(options: Option[]) {
  knownOptions.value = [
    ...new Map(
      [...knownOptions.value, ...options].map((item) => [item.value, item]),
    ).values(),
  ];
}
function tenantOptionLabel(label: string, value: string) {
  return label === '默认租户' && value !== '_DEFAULT_'
    ? `${label}（ID ${value}）`
    : label;
}
async function loadTenantDisplayOptions(values: string[]) {
  const ids = values.filter((value) => !value.startsWith('_'));
  if (ids.length === 0) return;
  const result: any = await requestClient.get(
    buildModuleRequestPath('/Tenant/list', apiURL),
    {
      baseURL: '',
      params: { idList: ids, pageIndex: 1, pageSize: Math.min(ids.length, 50) },
    },
  );
  const items = result?.items || result?.records || result || [];
  if (Array.isArray(items)) {
    cacheOptions(
      items.map((item) => ({
        label: tenantOptionLabel(
          String(item.name || item.code || item.id),
          String(item.id),
        ),
        value: String(item.id),
      })),
    );
  }
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
      tenantHasMore.value = false;
      return;
    }
    if (!props.record?.id) return;
    const [nextDetail, nextOrgTree, nextDomainOptions] = await Promise.all([
      requestClient.get<Record<string, any>>(`${apiBase.value}/retrieve`, {
        baseURL: '',
        params: { id: props.record.id },
      }),
      rbacService.fetchAuthorizedOrgTree() as Promise<OrgTreeNode[]>,
      props.loadDomainOptions ? props.loadDomainOptions() : Promise.resolve([]),
    ]);
    setDetailState(nextDetail);
    orgTree.value = nextOrgTree || [];
    domainOptions.value = nextDomainOptions || [];
    cacheOptions(domainOptions.value);
    tenantOptions.value = [];
    tenantPage.value = 0;
    tenantHasMore.value = true;
    if (isPlatformOperator.value) await loadMoreTenants();
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
async function loadMoreTenants() {
  if (!tenantHasMore.value || candidateLoading.value) return;
  const generation = candidateGeneration;
  candidateLoading.value = true;
  try {
    const loaded = await tenantDataScopeOptionsLoader(
      candidateKeyword.value,
      tenantPage.value + 1,
    );
    const options: Option[] = loaded.map((item) => ({
      label: tenantOptionLabel(String(item.label), String(item.value)),
      value: String(item.value),
    }));
    if (generation !== candidateGeneration) return;
    tenantOptions.value = [
      ...new Map(
        [...tenantOptions.value, ...options].map((item) => [item.value, item]),
      ).values(),
    ];
    cacheOptions(options);
    tenantPage.value += 1;
    tenantHasMore.value = options.length === 50;
    errorMessage.value = '';
  } catch (error) {
    console.warn('租户候选加载失败', error);
    errorMessage.value = '租户候选加载失败，请重试。';
  } finally {
    if (generation === candidateGeneration) candidateLoading.value = false;
  }
}
async function searchCandidates(value: string) {
  candidateKeyword.value = value;
  candidateGeneration += 1;
  candidateLoading.value = false;
  if (activeKey.value === 'tenant') {
    tenantOptions.value = [];
    tenantPage.value = 0;
    tenantHasMore.value = true;
    await loadMoreTenants();
  } else if (activeKey.value === 'domain' && props.loadDomainOptions) {
    const generation = candidateGeneration;
    candidateLoading.value = true;
    try {
      const options = await props.loadDomainOptions(value);
      if (generation !== candidateGeneration) return;
      domainOptions.value = options;
      cacheOptions(options);
      errorMessage.value = '';
    } catch (error) {
      console.warn('领域候选加载失败', error);
      errorMessage.value = '领域候选加载失败，请重试。';
    } finally {
      if (generation === candidateGeneration) candidateLoading.value = false;
    }
  }
}
function advancedSideValues(tab: ScopeTab, side: ScopeSide) {
  const values = scopeValues.value[fieldFor(tab, side)] || [];
  return values.toSorted((left, right) =>
    optionLabel(tab.kind, left).localeCompare(optionLabel(tab.kind, right)),
  );
}
function setAdvancedSideCustom(
  tab: ScopeTab,
  side: ScopeSide,
  checked: boolean,
) {
  if (!isUser.value || isTabReadOnly(tab)) return;
  const field = fieldFor(tab, side);
  if (checked) {
    scopeValues.value[field] = [];
    return;
  }
  const clear = () => {
    scopeValues.value[field] = null;
  };
  if ((scopeValues.value[field] || []).length === 0) {
    clear();
    return;
  }
  Modal.confirm({
    content: '取消自定义会清空当前列表，并继承有效角色的对应范围。',
    okText: '清空并继承',
    onOk: clear,
    title: '确认取消自定义？',
  });
}
function removeAdvancedRule(tab: ScopeTab, side: ScopeSide, value: string) {
  if (isAdvancedRuleReadOnly(tab, value)) return;
  const field = fieldFor(tab, side);
  scopeValues.value[field] = removeRules(
    scopeValues.value[field],
    new Set([value]),
  );
}
function isAdvancedRuleReadOnly(tab: ScopeTab, value: string) {
  return (
    isTabReadOnly(tab) ||
    (tab.kind === 'org' &&
      !isSuperAdmin.value &&
      parseOrgRule(value).startValue === '_ALL_ROOT_')
  );
}
async function loadAdvancedCandidates(reset = true) {
  const generation = ++advancedGeneration;
  if (reset) {
    advancedOptions.value = [];
    advancedTenantPage.value = 0;
  }
  advancedLoading.value = true;
  try {
    const keyword = advancedKeyword.value.trim();
    let options: Option[] = [];
    if (advancedCandidateKind.value === 'domain') {
      options = props.loadDomainOptions
        ? await props.loadDomainOptions(keyword)
        : [];
    } else if (advancedCandidateKind.value === 'tenant') {
      const loaded = await tenantDataScopeOptionsLoader(
        keyword,
        advancedTenantPage.value + 1,
      );
      options = loaded.map((item) => ({
        label: tenantOptionLabel(String(item.label), String(item.value)),
        value: String(item.value),
      }));
      advancedTenantPage.value += 1;
      advancedTenantHasMore.value = loaded.length === 50;
    }
    if (generation !== advancedGeneration) return;
    const saved = advancedEditingValue.value
      ? [
          {
            label: optionLabel(
              advancedCandidateKind.value,
              advancedEditingValue.value,
            ),
            value: advancedEditingValue.value,
          },
        ]
      : [];
    advancedOptions.value = [
      ...new Map(
        [
          ...(reset
            ? builtinOptions(advancedCandidateKind.value)
            : advancedOptions.value),
          ...saved,
          ...options,
        ].map((item) => [item.value, item]),
      ).values(),
    ];
    cacheOptions(advancedOptions.value);
  } finally {
    if (generation === advancedGeneration) advancedLoading.value = false;
  }
}
async function openAdvancedCandidate(
  tab: ScopeTab,
  side: ScopeSide,
  value = '',
) {
  if (isTabReadOnly(tab) || (value && isAdvancedRuleReadOnly(tab, value)))
    return;
  advancedCandidateKind.value = tab.kind;
  advancedCandidateSide.value = side;
  advancedEditingValue.value = value;
  advancedKeyword.value = '';
  if (tab.kind === 'org') {
    const rule = value ? parseOrgRule(value) : null;
    advancedOrgStart.value = rule?.startValue || '_DEFAULT_';
    advancedOrgMode.value = rule?.matchingMode || 'SelfAndAllChild';
    advancedOrgExpression.value = rule?.expression || '';
  } else {
    await loadAdvancedCandidates();
  }
  advancedCandidateOpen.value = true;
}
function saveAdvancedCandidate(value: string) {
  const tab = scopeTabs.find(
    (item) => item.kind === advancedCandidateKind.value,
  );
  if (!tab || !value || isTabReadOnly(tab)) return;
  if (advancedEditingValue.value && advancedEditingValue.value !== value)
    setChoice(tab, advancedEditingValue.value, 'none');
  setChoice(tab, value, advancedCandidateSide.value);
  advancedCandidateOpen.value = false;
}
function saveAdvancedOrgRule() {
  if (!advancedOrgStart.value) return;
  if (advancedOrgStart.value === '_ALL_ROOT_' && !isSuperAdmin.value) return;
  if (
    !advancedNoOrg.value &&
    advancedRequiresExpression.value &&
    !advancedOrgExpression.value.trim()
  )
    return;
  let mode = advancedOrgMode.value;
  if (advancedNoOrg.value) mode = 'Self';
  else if (advancedRequiresExpression.value)
    mode = `${advancedOrgMode.value}#${advancedOrgExpression.value.trim()}`;
  saveAdvancedCandidate(`${advancedOrgStart.value}|${mode}`);
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
      { baseURL: '' },
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
    if (open) {
      advancedMode.value = false;
      advancedCandidateOpen.value = false;
      void loadData();
    }
  },
  { immediate: true },
);
</script>

<template>
  <Modal
    :mask-closable="false"
    :open="open"
    :width="advancedMode ? 1180 : 1040"
    :body-style="modalBodyStyle"
    destroy-on-close
    @cancel="emit('update:open', false)"
  >
    <template #title>
      <div class="flex items-center justify-between gap-4 pr-8">
        <span>{{
          summaryText ? `${modalTitle}【${summaryText}】` : modalTitle
        }}</span>
        <Button
          data-testid="data-permission-mode-switch"
          size="small"
          type="link"
          @click="advancedMode = !advancedMode"
        >
          {{ advancedMode ? '返回简单模式' : '切换到高级模式' }}
        </Button>
      </div>
    </template>
    <template #footer>
      <div data-testid="data-permission-footer" class="flex justify-end gap-2">
        <Button
          :disabled="!hasChanges"
          :loading="saving"
          type="primary"
          @click="saveChanges()"
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
    </template>
    <div class="flex h-full min-h-0 flex-col">
      <Alert
        v-if="errorMessage"
        :message="errorMessage"
        show-icon
        type="error"
      />
      <Spin :spinning="loading" class="min-h-0 flex-1">
        <Tabs v-model:active-key="activeKey" @change="searchCandidates('')">
          <Tabs.TabPane v-for="tab in visibleScopeTabs" :key="tab.kind">
            <template #tab>
              <span class="inline-flex items-start gap-0.5">
                <span>{{ tab.label }}</span>
                <span class="inline-flex -translate-y-1 gap-0.5">
                  <sup
                    v-if="(scopeValues[tab.allowField] || []).length > 0"
                    :aria-label="`${tab.label}允许规则数`"
                    class="inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-emerald-500 px-0.5 text-[9px] leading-3 text-white"
                    v-text="(scopeValues[tab.allowField] || []).length"
                  ></sup>
                  <sup
                    v-if="(scopeValues[tab.denyField] || []).length > 0"
                    :aria-label="`${tab.label}禁止规则数`"
                    class="inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] leading-3 text-white"
                    v-text="(scopeValues[tab.denyField] || []).length"
                  ></sup>
                </span>
              </span>
            </template>
            <div
              v-if="advancedMode"
              data-testid="data-permission-advanced"
              class="grid grid-cols-1 gap-4 py-3 md:grid-cols-2"
            >
              <section
                v-for="side in ['allow', 'deny'] as ScopeSide[]"
                :key="side"
                class="flex h-[390px] min-w-0 flex-col rounded-lg border border-slate-200 p-4"
              >
                <div class="mb-3 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <strong>{{
                      side === 'allow' ? '允许列表' : '禁止列表'
                    }}</strong>
                    <span class="text-xs text-slate-500">
                      {{ advancedSideValues(tab, side).length }}
                    </span>
                    <Checkbox
                      v-if="isUser"
                      :checked="!isFieldUnset(fieldFor(tab, side))"
                      :disabled="isTabReadOnly(tab)"
                      @update:checked="
                        setAdvancedSideCustom(tab, side, Boolean($event))
                      "
                    >
                      自定义
                    </Checkbox>
                  </div>
                  <Button
                    :disabled="
                      isTabReadOnly(tab) || isFieldUnset(fieldFor(tab, side))
                    "
                    size="small"
                    type="primary"
                    @click="openAdvancedCandidate(tab, side)"
                  >
                    添加
                  </Button>
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto">
                  <div
                    v-for="value in advancedSideValues(tab, side)"
                    :key="value"
                    class="flex min-h-11 items-center gap-2 border-t border-slate-100 px-2 text-sm"
                  >
                    <span
                      class="min-w-0 flex-1 py-2"
                      :title="
                        [
                          optionLabel(tab.kind, value),
                          advancedRuleDescription(tab.kind, value),
                        ]
                          .filter(Boolean)
                          .join(' ')
                      "
                    >
                      <span class="block truncate">{{
                        optionLabel(tab.kind, value)
                      }}</span>
                      <span
                        v-if="advancedRuleDescription(tab.kind, value)"
                        class="mt-0.5 block text-xs text-slate-500"
                        v-text="advancedRuleDescription(tab.kind, value)"
                      ></span>
                    </span>
                    <Button
                      :aria-label="`编辑${optionLabel(tab.kind, value)}`"
                      :disabled="isAdvancedRuleReadOnly(tab, value)"
                      size="small"
                      @click="openAdvancedCandidate(tab, side, value)"
                    >
                      编辑
                    </Button>
                    <Button
                      :aria-label="`删除${optionLabel(tab.kind, value)}`"
                      :disabled="isAdvancedRuleReadOnly(tab, value)"
                      danger
                      size="small"
                      @click="removeAdvancedRule(tab, side, value)"
                    >
                      删除
                    </Button>
                  </div>
                  <Empty
                    v-if="advancedSideValues(tab, side).length === 0"
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
            <div v-else class="flex min-h-0 flex-col gap-3 py-3">
              <div v-if="isUser" class="flex items-center gap-2 text-sm">
                <span>自定义{{ tab.label }}范围</span>
                <Switch
                  :aria-label="`自定义${tab.label}范围`"
                  :checked="isTabCustom(tab)"
                  :disabled="isTabReadOnly(tab)"
                  @update:checked="setTabCustom(tab, Boolean($event))"
                />
              </div>
              <div
                class="data-permission-options-scroll rounded-lg border border-slate-200"
              >
                <table class="w-full border-collapse text-left text-sm">
                  <thead class="bg-slate-50">
                    <tr>
                      <th class="px-4 py-3 font-medium">选项</th>
                      <th class="w-72 px-3 py-3 text-center font-medium">
                        访问设置
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in visibleFixedOptions(tab)"
                      :key="item.value"
                      class="border-t border-slate-100"
                    >
                      <td class="px-4 py-3">
                        {{ item.label }}
                        <span
                          v-if="item.description"
                          class="ml-2 text-xs text-slate-500"
                          v-text="item.description"
                        ></span>
                      </td>
                      <td class="px-3 py-2 text-center">
                        <!-- 固定组织项在权限开关后选择匹配模式；无组织没有下级。 -->
                        <div class="flex items-center justify-center gap-2">
                          <Segmented
                            :aria-label="`${item.label}访问设置`"
                            class="data-permission-choice"
                            :class="{
                              'data-permission-choice--unset':
                                fixedChoice(tab, item) === 'none',
                            }"
                            :disabled="isTabReadOnly(tab) || !isTabCustom(tab)"
                            :options="choiceOptions"
                            :value="fixedChoice(tab, item)"
                            @change="
                              setFixedChoice(
                                tab,
                                item,
                                String($event) as ScopeChoice,
                              )
                            "
                          />
                          <Select
                            v-if="fixedOrgPresetStart(tab, item.value)"
                            :aria-label="`${item.label}子组织匹配模式`"
                            class="w-40"
                            :disabled="
                              isTabReadOnly(tab) ||
                              !isTabCustom(tab) ||
                              orgPresetChoice(
                                tab,
                                fixedOrgPresetStart(tab, item.value),
                              ) === 'none'
                            "
                            :options="orgInlineMatchingModeOptions"
                            placeholder="选择匹配模式"
                            :value="
                              orgPresetMode(
                                fixedOrgPresetStart(tab, item.value),
                              ) || undefined
                            "
                            @update:value="
                              setOrgPresetMode(
                                tab,
                                fixedOrgPresetStart(tab, item.value),
                                String($event),
                              )
                            "
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div
                  v-if="scopeMode(tab) === 'custom'"
                  class="border-t border-slate-200 p-3"
                >
                  <Input
                    v-if="tab.kind !== 'org'"
                    :value="candidateKeyword"
                    allow-clear
                    class="mb-3 max-w-sm"
                    :placeholder="`搜索${tab.label}名称或 ID`"
                    @update:value="searchCandidates"
                  />
                  <div v-if="tab.kind === 'org'" class="min-w-0">
                    <UserOrgSelector
                      v-if="!loading"
                      class="min-w-0"
                      :action-only="true"
                      :auto-expand-org-ids="configuredOrgIds"
                      :inline="true"
                      :selectable-types="['org']"
                      :disabled="isTabReadOnly(tab) || !isTabCustom(tab)"
                      :load-org-tree="loadOrgTreeForSelector"
                    >
                      <template #org-action="{ node }">
                        <Segmented
                          :aria-label="`${node.name}访问设置`"
                          class="data-permission-choice"
                          :class="{
                            'data-permission-choice--unset':
                              selectedChoice(tab, orgRuleValue(node.id)) ===
                              'none',
                          }"
                          :disabled="
                            isTabReadOnly(tab) ||
                            !isTabCustom(tab) ||
                            node.disabled
                          "
                          :options="choiceOptions"
                          :value="selectedChoice(tab, orgRuleValue(node.id))"
                          @change="
                            setOrgChoice(
                              tab,
                              node.id,
                              String($event) as ScopeChoice,
                            )
                          "
                        />
                        <Select
                          :aria-label="`${node.name}子组织匹配模式`"
                          class="w-40"
                          :disabled="
                            isTabReadOnly(tab) ||
                            !isTabCustom(tab) ||
                            node.disabled ||
                            selectedChoice(tab, orgRuleValue(node.id)) ===
                              'none'
                          "
                          :options="orgInlineMatchingModeOptions"
                          placeholder="选择匹配模式"
                          :value="orgModeForNode(node.id) || undefined"
                          @update:value="
                            setOrgMode(tab, node.id, String($event))
                          "
                        />
                      </template>
                    </UserOrgSelector>
                  </div>
                  <table
                    v-else
                    class="w-full border-collapse text-left text-sm"
                  >
                    <tbody>
                      <tr
                        v-for="item in dynamicOptions(tab)"
                        :key="item.value"
                        class="border-t border-slate-100 hover:bg-blue-50/60"
                      >
                        <td class="px-4 py-2">{{ item.label }}</td>
                        <td class="w-72 px-3 py-2 text-center">
                          <Segmented
                            :aria-label="`${item.label}访问设置`"
                            class="data-permission-choice"
                            :class="{
                              'data-permission-choice--unset':
                                selectedChoice(tab, item.value) === 'none',
                            }"
                            :disabled="isTabReadOnly(tab) || !isTabCustom(tab)"
                            :options="choiceOptions"
                            :value="selectedChoice(tab, item.value)"
                            @change="
                              setChoice(
                                tab,
                                item.value,
                                String($event) as ScopeChoice,
                              )
                            "
                          />
                        </td>
                      </tr>
                      <tr v-if="dynamicOptions(tab).length === 0">
                        <td
                          colspan="2"
                          class="px-4 py-8 text-center text-slate-500"
                        >
                          没有更多
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <Button
                    v-if="tab.kind === 'tenant' && tenantHasMore"
                    :loading="candidateLoading"
                    class="mt-3"
                    @click="loadMoreTenants"
                  >
                    加载更多租户
                  </Button>
                </div>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </Spin>
    </div>
  </Modal>

  <Modal
    v-model:open="advancedCandidateOpen"
    :footer="null"
    :title="`${advancedEditingValue ? '编辑' : '添加'}${advancedCandidateSide === 'allow' ? '允许' : '禁止'}${scopeTabs.find((tab) => tab.kind === advancedCandidateKind)?.label || ''}`"
    :width="480"
    :body-style="{ maxHeight: '420px', overflowY: 'auto' }"
  >
    <div v-if="advancedCandidateKind === 'org'" class="space-y-4">
      <div>
        <div class="mb-1 text-sm font-medium">起点根组织</div>
        <TreeSelect
          v-model:value="advancedOrgStart"
          allow-clear
          class="w-full"
          :tree-data="advancedOrgTreeData"
          placeholder="请选择起点根组织"
          show-search
          tree-default-expand-all
        />
      </div>
      <div>
        <div class="mb-1 text-sm font-medium">子组织匹配模式</div>
        <Select
          v-model:value="advancedOrgMode"
          class="w-full"
          :disabled="advancedNoOrg"
          :options="advancedOrgModeOptions"
        />
        <div v-if="advancedNoOrg" class="mt-1 text-xs text-slate-500">
          无组织不包含下级组织，此匹配模式不生效。
        </div>
      </div>
      <div v-if="!advancedNoOrg && advancedRequiresExpression">
        <div class="mb-1 text-sm font-medium">匹配表达式</div>
        <Input.TextArea
          v-if="advancedOrgMode === 'Groovy'"
          v-model:value="advancedOrgExpression"
          :rows="3"
          placeholder="Groovy 可用变量：_org、_user"
        />
        <Input
          v-else
          v-model:value="advancedOrgExpression"
          :placeholder="
            advancedOrgMode === 'IdPath'
              ? '例如：/* 或 /组织ID/**'
              : '例如：/* 或 /组织名称/**'
          "
        />
      </div>
      <div class="flex justify-end">
        <Button
          :disabled="
            !advancedOrgStart ||
            (!advancedNoOrg &&
              advancedRequiresExpression &&
              !advancedOrgExpression.trim())
          "
          type="primary"
          @click="saveAdvancedOrgRule"
        >
          {{ advancedEditingValue ? '保存规则' : '添加规则' }}
        </Button>
      </div>
    </div>
    <div v-else data-testid="advanced-candidate-options" class="space-y-3">
      <Input
        :value="advancedKeyword"
        allow-clear
        placeholder="输入名称搜索"
        @update:value="
          advancedKeyword = String($event);
          loadAdvancedCandidates();
        "
      />
      <Spin :spinning="advancedLoading">
        <div
          v-for="item in advancedOptions"
          :key="item.value"
          class="flex min-h-11 items-center justify-between gap-2 border-b border-slate-100 px-2 text-sm"
        >
          <span
            class="min-w-0 truncate"
            :title="item.description || item.label"
          >
            {{ item.label }}
          </span>
          <Button
            :disabled="
              item.value !== advancedEditingValue &&
              (
                scopeValues[
                  fieldFor(
                    scopeTabs.find(
                      (tab) => tab.kind === advancedCandidateKind,
                    )!,
                    advancedCandidateSide,
                  )
                ] || []
              ).includes(item.value)
            "
            size="small"
            type="primary"
            @click="saveAdvancedCandidate(item.value)"
          >
            {{ advancedEditingValue ? '保存' : '添加' }}
          </Button>
        </div>
        <Empty
          v-if="advancedOptions.length === 0 && !advancedLoading"
          description="没有可添加的候选资源"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        />
      </Spin>
      <Button
        v-if="advancedCandidateKind === 'tenant' && advancedTenantHasMore"
        :loading="advancedLoading"
        @click="loadAdvancedCandidates(false)"
      >
        加载更多租户
      </Button>
    </div>
  </Modal>
</template>

<style scoped>
/* 固定与动态候选共用一个滚动框；保存按钮由弹窗 Footer 固定在底部。 */
.data-permission-options-scroll {
  max-height: min(480px, calc(100vh - 330px));
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

/* 组织树在外层滚动框内自然增高，避免树和外框出现两层滚动条。 */
.data-permission-options-scroll :deep(.user-org-selector__inline-tree) {
  flex: 0 0 auto;
  overflow: visible;
}

.data-permission-options-scroll :deep(.user-org-selector__inline-search) {
  width: 25%;
  min-width: min(240px, 100%);
  height: 32px;
  min-height: 32px;
}

/* 三档开关只突出当前档位，随运行时主题主色与前景色变化。 */
.data-permission-choice:not(.data-permission-choice--unset)
  :deep(.ant-segmented-item-selected),
.data-permission-choice:not(.data-permission-choice--unset)
  :deep(.ant-segmented-item-selected:hover) {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.data-permission-choice:not(.data-permission-choice--unset)
  :deep(.ant-segmented-thumb) {
  background: hsl(var(--primary));
}

.data-permission-choice--unset :deep(.ant-segmented-item-selected),
.data-permission-choice--unset :deep(.ant-segmented-item-selected:hover),
.data-permission-choice--unset :deep(.ant-segmented-thumb) {
  background: hsl(var(--foreground) / 0.18);
  color: hsl(var(--foreground));
}
</style>
