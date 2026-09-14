<!-- 第二版独立副本：来源 stable/page-display-settings-performance-20260912，后续界面修改仅维护本文件。 -->
<script lang="ts" setup>
import type { ScriptWorkbenchVariableGroup } from './script-workbench-dialog.vue';
import type { CrudListOperationCandidate } from './crud-list-operations';
import type {
  CrudFieldConfig,
  CrudPageDisplayActionCandidate,
  CrudPageDisplayActionConfig,
  CrudPageDisplayConfig,
  CrudPageDisplayFieldConfig,
  CrudPageDisplayGroupConfig,
  CrudPageDisplayGroupedViewConfig,
  CrudPageDisplayHeaderConfig,
} from './types';

import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  AutoComplete,
  Button,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Popover,
  Select,
  Switch,
  Tabs,
  Tooltip,
} from 'ant-design-vue';

import { fetchDictOptions, fetchEnumOptions, fetchOptions } from '../api';
import { OAK_BASE_API_MODULE, roleOptionsLoader } from './config-helpers';
import { normalizeCrudGroupDisplayStyle } from './crud-group-display';
import { DEFAULT_LIST_OPERATIONS } from './crud-list-operations';
import {
  findDisplayRuleCycle,
  getDefaultFieldHidden,
  getDefaultVisibleRoleCodes,
  getDisplaySubmitMode,
  initializeFieldHidden,
  initializeVisibleRoleCodes,
  isEligibleStaticDisplayGroup,
  moveDisplayFieldToGroupEnd,
  reconcileCrudPageDisplayActions,
  reconcileCrudPageDisplayHeaders,
  releaseDisplayGroupFields,
  resolveCrudPageDisplayDefaults,
  sortDisplayGroups,
  supportsInlineChoiceOptions,
} from './crud-page-display';
import PageDisplaySettingsDetailTab from './page-display-settings-detail-tab-v2.vue';
import PageDisplaySettingsListTab from './page-display-settings-list-tab-v2.vue';
import PageDisplaySettingsV2PropertyPanel from './page-display-settings-v2-property-panel.vue';
import ScriptWorkbenchDialog from './script-workbench-dialog.vue';

type FormView = 'create' | 'detail' | 'edit';
type View = 'list' | 'query' | FormView;
type GroupView = Exclude<View, 'list'>;
type DrawerDisplayGroup = CrudPageDisplayGroupConfig & {
  developmentDefault?: boolean;
};
type Scope = {
  domain?: string;
  orgCategory?: string;
  orgType?: string;
  tenantId?: string;
  userCategory?: string;
  userType?: string;
};

const props = defineProps<{
  actionCandidates?: CrudPageDisplayActionCandidate[];
  code: string;
  detailFields?: CrudFieldConfig[];
  domainObject?: boolean;
  fields: CrudFieldConfig[];
  initialScope?: Scope;
  modelValue?: CrudPageDisplayConfig;
  listOperationCandidates?: CrudListOperationCandidate[];
  open: boolean;
  saving?: boolean;
  scriptTestContext?: Record<string, any>;
  showOperationColumn?: boolean;
}>();

const emit = defineEmits<{
  save: [value: { config: CrudPageDisplayConfig; scope: Scope }];
  'update:open': [value: boolean];
}>();

const activeKey = ref<View>('query');
// 搜索属于视图临时状态，不进入配置草稿；各页签独立记住本次打开期间的关键词。
const fieldSearchKeywords = reactive<Record<View, string>>({
  create: '',
  detail: '',
  edit: '',
  list: '',
  query: '',
});
const normalizedFieldSearch = computed(() =>
  fieldSearchKeywords[activeKey.value].trim().toLocaleLowerCase(),
);
// 仅维护一棵活动编辑树，切换时按字段键更新控件，关闭抽屉才释放整个编辑区。
const renderedView = computed(() => (props.open ? activeKey.value : undefined));
const INITIAL_FIELD_RENDER_LIMIT = 12;
const FIELD_RENDER_STEP = 12;
const fieldRenderLimits = reactive<Record<View, number>>({
  create: INITIAL_FIELD_RENDER_LIMIT,
  detail: INITIAL_FIELD_RENDER_LIMIT,
  edit: INITIAL_FIELD_RENDER_LIMIT,
  list: INITIAL_FIELD_RENDER_LIMIT,
  query: INITIAL_FIELD_RENDER_LIMIT,
});

function resetFieldRenderLimits() {
  for (const view of Object.keys(fieldRenderLimits) as View[]) {
    fieldRenderLimits[view] = INITIAL_FIELD_RENDER_LIMIT;
  }
}

const draft = ref<CrudPageDisplayConfig>(resolveCrudPageDisplayDefaults());
const scope = ref<Scope>({});
const initialSnapshot = ref('');
const scriptOpen = ref(false);
const listOperationScript = ref(false);
// 列表级表达式与运行时一致，不使用首条记录或表单字段作为隐式上下文。
const activeScriptTestContext = computed(() =>
  listOperationScript.value
    ? {
        user: props.scriptTestContext?.user || {},
        org: props.scriptTestContext?.org || {},
        tenant: props.scriptTestContext?.tenant || {},
      }
    : props.scriptTestContext,
);
const listOperationCandidates = computed(
  () => props.listOperationCandidates || DEFAULT_LIST_OPERATIONS,
);
const scriptText = ref('');
const scriptTitle = ref('脚本工作台');
const scriptGroups = ref<ScriptWorkbenchVariableGroup[]>([]);
const applyScript = ref<(value: string) => void>();
const draggedRowIndex = ref<number>();
const draggedActionKey = ref<string>();
const dragStartFromInteractiveControl = ref(false);
const tenantScopeOptions = ref<Array<{ label: string; value: string }>>([]);
const siteScopeOptions = ref<Array<{ label: string; value: string }>>([]);
const userTypeScopeOptions = ref<Array<{ label: string; value: string }>>([]);
const userCategoryScopeOptions = ref<Array<{ label: string; value: string }>>(
  [],
);
const orgCategoryScopeOptions = ref<Array<{ label: string; value: string }>>(
  [],
);
const orgTypeScopeOptions = ref<Array<{ label: string; value: string }>>([]);
let cachedScopeOptions:
  | undefined
  | {
      orgCategories: Array<{ label: string; value: string }>;
      orgTypes: Array<{ label: string; value: string }>;
      sites: Array<{ label: string; value: string }>;
      tenantId?: string;
      tenants: Array<{ label: string; value: string }>;
      userCategories: Array<{ label: string; value: string }>;
      userTypes: Array<{ label: string; value: string }>;
    };
let cachedRoleVisibilityOptions:
  | Array<{ label: string; value: string }>
  | undefined;
const roleVisibilityOptions = ref<Array<{ label: string; value: string }>>([]);
const roleVisibilityLoading = ref(false);
const groupRenderVersion = ref(0);
const fieldScrollRef = ref<HTMLElement | null>(null);
const previewContentRef = ref<HTMLElement | null>(null);
const previewExpanded = ref(false);
const previewOverflowing = ref(false);
let previewResizeObserver: null | ResizeObserver = null;
let observedPreviewElement: HTMLElement | null = null;

function currentSnapshot() {
  return JSON.stringify({
    config: draft.value,
    scope: normalizeScope(scope.value),
  });
}

const hasUnuploadedChanges = computed(
  () =>
    props.open &&
    initialSnapshot.value !== '' &&
    initialSnapshot.value !== currentSnapshot(),
);

const scopeMatchTooltip = computed(() => {
  const labels: Array<[keyof Scope, string]> = [
    ['tenantId', '租户'],
    ['domain', '站点'],
    ['userType', '用户类型'],
    ['userCategory', '用户类别'],
    ['orgCategory', '组织类别'],
    ['orgType', '组织类型'],
  ];
  const detail = labels.map(([key, label]) =>
    scope.value[key] ? `${label}：精确匹配` : `${label}：匹配任意`,
  );
  return `当前配置按以下范围匹配：${detail.join('；')}。`;
});

function requestClose() {
  if (!hasUnuploadedChanges.value) {
    emit('update:open', false);
    return;
  }
  Modal.confirm({
    cancelText: '继续编辑',
    content: '关闭将放弃本次未上传的修改。',
    okText: '放弃修改并关闭',
    okType: 'danger',
    title: '确认关闭页面展示设置？',
    onOk: () => emit('update:open', false),
  });
}

function normalizeScope(source: Scope | undefined): Scope {
  const value = source || {};
  return {
    domain: value.domain || undefined,
    orgCategory: value.orgCategory || undefined,
    orgType: value.orgType || undefined,
    tenantId: value.tenantId || undefined,
    userCategory: value.userCategory || undefined,
    userType: value.userType || undefined,
  };
}

const PageDisplaySettingsTabContent = defineComponent({
  name: 'PageDisplaySettingsTabContent',
  props: {
    view: {
      required: true,
      type: String,
    },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'page-display-settings-tab-content',
          style: { display: 'contents' },
        },
        slots.default?.({ view: props.view as View }),
      );
  },
});

function updatePreviewOverflow() {
  if (previewExpanded.value) return;
  const preview = previewContentRef.value;
  previewOverflowing.value = Boolean(
    preview && preview.scrollHeight > preview.clientHeight + 1,
  );
}

async function refreshPreviewOverflow() {
  await nextTick();
  updatePreviewOverflow();
  const preview = previewContentRef.value;
  if (preview === observedPreviewElement) return;

  previewResizeObserver?.disconnect();
  previewResizeObserver = null;
  observedPreviewElement = preview;
  if (typeof ResizeObserver !== 'undefined' && preview) {
    previewResizeObserver = new ResizeObserver(updatePreviewOverflow);
    previewResizeObserver.observe(preview);
  }
}

function clone(
  value: CrudPageDisplayConfig | undefined,
): CrudPageDisplayConfig {
  return JSON.parse(JSON.stringify(value || { version: 1 }));
}

function normalizeOptions(options: any[]) {
  return options
    .map((option) => ({
      label: String(option.label ?? option.name ?? option.value ?? ''),
      value: String(option.value ?? option.id ?? option.name ?? ''),
    }))
    .filter((option) => option.value);
}

function retainScopeValue(
  options: Array<{ label: string; value: string }>,
  value?: string,
) {
  if (value && !options.some((item) => item.value === value))
    options.unshift({ label: value, value });
}

async function loadScopeOptions() {
  const cachedOptions = cachedScopeOptions;
  if (cachedOptions && cachedOptions.tenantId === scope.value.tenantId) {
    tenantScopeOptions.value = cachedOptions.tenants;
    siteScopeOptions.value = cachedOptions.sites;
    userTypeScopeOptions.value = cachedOptions.userTypes;
    userCategoryScopeOptions.value = cachedOptions.userCategories;
    orgCategoryScopeOptions.value = cachedOptions.orgCategories;
    orgTypeScopeOptions.value = cachedOptions.orgTypes;
    return;
  }
  try {
    const [tenants, sites, userTypes, userCategories, orgCategories, orgTypes] =
      await Promise.all([
        fetchOptions(
          '/Tenant/list',
          'name',
          'id',
          { pageIndex: 1, pageSize: 500 },
          OAK_BASE_API_MODULE,
        ),
        fetchOptions(
          '/TenantSite/list',
          'domain',
          'domain',
          {
            enable: true,
            pageIndex: 1,
            pageSize: 500,
            tenantId: scope.value.tenantId || undefined,
          },
          OAK_BASE_API_MODULE,
        ),
        fetchDictOptions(
          'com.levin.oak.base.entities.User.type',
          OAK_BASE_API_MODULE,
        ),
        fetchEnumOptions(
          'com.levin.oak.base.entities.User$Category',
          OAK_BASE_API_MODULE,
        ),
        fetchDictOptions(
          'com.levin.oak.base.entities.Org.category',
          OAK_BASE_API_MODULE,
        ),
        fetchEnumOptions(
          'com.levin.oak.base.entities.Org$Type',
          OAK_BASE_API_MODULE,
        ),
      ]);
    tenantScopeOptions.value = normalizeOptions(tenants || []);
    siteScopeOptions.value = normalizeOptions(sites || []);
    userTypeScopeOptions.value = normalizeOptions(userTypes || []);
    userCategoryScopeOptions.value = normalizeOptions(userCategories || []);
    orgCategoryScopeOptions.value = normalizeOptions(orgCategories || []);
    orgTypeScopeOptions.value = normalizeOptions(orgTypes || []);
    cachedScopeOptions = {
      orgCategories: orgCategoryScopeOptions.value,
      orgTypes: orgTypeScopeOptions.value,
      sites: siteScopeOptions.value,
      tenantId: scope.value.tenantId,
      tenants: tenantScopeOptions.value,
      userCategories: userCategoryScopeOptions.value,
      userTypes: userTypeScopeOptions.value,
    };
    retainScopeValue(tenantScopeOptions.value, scope.value.tenantId);
    retainScopeValue(siteScopeOptions.value, scope.value.domain);
    retainScopeValue(userTypeScopeOptions.value, scope.value.userType);
    retainScopeValue(userCategoryScopeOptions.value, scope.value.userCategory);
    retainScopeValue(orgCategoryScopeOptions.value, scope.value.orgCategory);
    retainScopeValue(orgTypeScopeOptions.value, scope.value.orgType);
  } catch (error) {
    console.warn('加载页面展示设置作用范围选项失败。', error);
  }
}

async function loadRoleVisibilityOptions() {
  if (cachedRoleVisibilityOptions) {
    roleVisibilityOptions.value = cachedRoleVisibilityOptions;
    return;
  }
  if (roleVisibilityLoading.value) return;
  roleVisibilityLoading.value = true;
  try {
    roleVisibilityOptions.value = normalizeOptions(await roleOptionsLoader());
    cachedRoleVisibilityOptions = roleVisibilityOptions.value;
  } catch (error) {
    console.warn('加载字段可见角色选项失败。', error);
  } finally {
    roleVisibilityLoading.value = false;
  }
}

function isGroupableView(view: View): view is GroupView {
  return view !== 'list';
}

function getFieldConfigGridTemplate(view: View) {
  return view === 'list'
    ? '66px 110px 190px 120px 124px 124px 124px 120px 200px 200px 100px'
    : view === 'detail'
      ? '66px 160px 190px 170px 160px 150px 200px 60px 100px 220px 200px'
      : '52px 120px 150px 170px 110px 110px 220px 200px 110px 220px 200px';
}

function getAllowedFields(view: Exclude<View, 'list'>) {
  const sourceFields =
    view === 'detail' ? props.detailFields || [] : props.fields;
  const fieldKeys = new Set<string>();

  // 同一稳定字段键只能进入一个表单行，避免页面静态配置重复时渲染重复控件。
  return sourceFields.filter((field) => {
    const available =
      view === 'query'
        ? field.search
        : view === 'create'
          ? field.form !== false && field.formCreate !== false
          : view === 'edit'
            ? field.form !== false && field.formEdit !== false
            : true;
    if (!available || fieldKeys.has(field.key)) return false;
    fieldKeys.add(field.key);
    return true;
  });
}

function ensureFields(view: Exclude<View, 'list'>) {
  const holder = (draft.value[view] ||= { fields: [] });
  const allowed = getAllowedFields(view);
  const existing = new Map(holder.fields.map((item) => [item.key, item]));
  // 计算属性只在尚未隐藏时修正；重复读取必须复用对象，避免渲染持续触发自身更新。
  const nextFields: CrudPageDisplayFieldConfig[] = allowed.map(
    (field, index) =>
      existing.has(field.key)
        ? Object.hasOwn(existing.get(field.key)!, 'hidden')
          ? field.hasBackingField === false &&
            view === 'detail' &&
            existing.get(field.key)?.hidden !== true
            ? { ...existing.get(field.key)!, hidden: true }
            : existing.get(field.key)!
          : {
              hidden: getDefaultFieldHidden(field, {
                view,
                hideDomainId: props.domainObject === true,
              }),
              ...existing.get(field.key),
              key: field.key,
            }
        : {
            inputDisplay: 'default',
            hidden: getDefaultFieldHidden(field, {
              hideDomainId: props.domainObject === true,
              view,
            }),
            key: field.key,
            order: index,
            defaultValue: {},
            visibleRoleCodes: getDefaultVisibleRoleCodes(field.key),
          },
  );
  if (
    nextFields.length !== holder.fields.length ||
    nextFields.some((field, index) => field !== holder.fields[index])
  ) {
    holder.fields = nextFields;
  }
  for (const field of holder.fields) {
    field.hidden = initializeFieldHidden(field, { view });
    field.inputDisplay ??= 'default';
    // 后端已必填字段固定保留必填标记，设置界面不得将其取消。
    if (
      (view === 'create' || view === 'edit') &&
      isSourceFieldRequired(field.key)
    ) {
      field.required = true;
    }
    // 默认值编辑器渲染前补齐，避免切换页签才写入空对象并产生假修改。
    field.defaultValue ??= {};
    field.visibleRoleCodes = initializeVisibleRoleCodes(field);
  }
  return holder.fields;
}

function groupedViewHolder(view: GroupView): CrudPageDisplayGroupedViewConfig {
  const holder = (draft.value[view] ||= { fields: [] });
  return holder;
}

function queryHolder() {
  ensureFields('query');
  return draft.value.query!;
}

function detailHolder() {
  ensureFields('detail');
  const holder = (draft.value.detail ||= { fields: [] });
  return holder;
}

function editHolder() {
  ensureFields('edit');
  return draft.value.edit!;
}

function formHolder(view: FormView) {
  ensureFields(view);
  return draft.value[view]!;
}

function ensureGroups(view: GroupView) {
  const holder = groupedViewHolder(view);
  // 未配置分组时才建立默认草稿；显式删除后的数组不能被渲染过程自动补回。
  const groups = (holder.groups ||= getDevelopmentDefaultGroups(view).map(
    ({ developmentDefault, ...group }) => group,
  ));
  for (const [index, group] of groups.entries()) {
    group.defaultExpandedRows ??= group.defaultExpanded === false ? 1 : 'all';
    group.displayStyle = normalizeCrudGroupDisplayStyle(group.displayStyle);
    group.order ??= index;
    group.visibleRoleCodes ??= [];
  }
  holder.unassignedOrder ??=
    Math.max(-1, ...groups.map((group) => group.order ?? -1)) + 1;
  return groups;
}

function ensureHeaders() {
  const holder = (draft.value.list ||= { headers: [] });
  const nextHeaders = reconcileCrudPageDisplayHeaders(
    holder.headers,
    props.fields,
    {
      hideDomainId: props.domainObject === true,
      includeOperationColumn: props.showOperationColumn === true,
    },
  );
  if (
    nextHeaders.length !== holder.headers.length ||
    nextHeaders.some((header, index) => header !== holder.headers[index])
  ) {
    holder.headers = nextHeaders;
  }
  return holder.headers;
}

function ensureActions() {
  const holder = (draft.value.list ||= { actions: [], headers: [] });
  const nextActions = reconcileCrudPageDisplayActions(
    holder.actions,
    props.actionCandidates || [],
  );
  if (
    nextActions.length !== (holder.actions || []).length ||
    nextActions.some((action, index) => action !== holder.actions?.[index])
  ) {
    holder.actions = nextActions;
  }
  return holder.actions || [];
}

const actionRows = computed(() => ensureActions());
const detailRows = computed(() => ensureFields('detail'));
const listRows = computed(() => ensureHeaders());

function moveAction(action: CrudPageDisplayActionConfig, offset: -1 | 1) {
  const actions = [...actionRows.value];
  const index = actions.indexOf(action);
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= actions.length) return;
  const target = actions[targetIndex];
  if (!target) return;
  [action.order, target.order] = [target.order, action.order];
  draft.value.list!.actions = actions.toSorted(
    (left, right) => (left.order ?? 0) - (right.order ?? 0),
  );
}

function addVirtualHeader() {
  const holder = (draft.value.list ||= { headers: [] });
  const headers = ensureHeaders();
  const key = `virtual_${crypto.randomUUID().replaceAll('-', '')}`;
  // 虚拟字段属于业务展示列，必须排在固定的操作列之前。
  const lastDataColumnOrder = Math.max(
    -1,
    ...headers
      .filter((header) => !isOperationHeader(header))
      .map((header) => header.order ?? -1),
  );
  headers.push({
    key,
    label: `虚拟字段 ${headers.filter((header) => header.virtual === true).length + 1}`,
    order: lastDataColumnOrder + 1,
    valueDisplay: { expression: '', mode: 'script' },
    virtual: true,
    visible: { mode: 'always' },
    width: 180,
  });
  holder.headers = headers;
}

function getRowsForView(view: View) {
  return view === 'list' ? ensureHeaders() : ensureFields(view);
}

const rows = computed(() => getRowsForView(activeKey.value));
function matchesFieldSearch(
  row:
    | CrudPageDisplayActionConfig
    | CrudPageDisplayFieldConfig
    | CrudPageDisplayHeaderConfig,
) {
  const keyword = normalizedFieldSearch.value;
  if (!keyword) return true;
  // 同时匹配原始名称和当前别名，未挂载的行也通过完整配置参与搜索。
  const detailLabel =
    activeKey.value === 'detail'
      ? props.detailFields?.find((field) => field.key === row.key)?.label
      : undefined;
  return [
    row.key,
    row.label,
    'title' in row ? row.title : undefined,
    getSourceFieldTitle(row.key),
    detailLabel,
  ].some(
    (value) =>
      typeof value === 'string' && value.toLocaleLowerCase().includes(keyword),
  );
}
const filteredRows = computed(() =>
  rows.value.filter((row) => matchesFieldSearch(row)),
);
const filteredActionRows = computed(() =>
  activeKey.value === 'list'
    ? actionRows.value.filter((row) => matchesFieldSearch(row))
    : [],
);
const fieldSearchResultCount = computed(
  () => filteredRows.value.length + filteredActionRows.value.length,
);
const fieldSearchTotalCount = computed(
  () =>
    rows.value.length +
    (activeKey.value === 'list' ? actionRows.value.length : 0),
);

const fieldSearchOptions = computed(() => {
  // 将字段名称与标题别名合并为一份候选，清除空白与重复文本，不截断到已挂载的行。
  const names = new Set<string>();
  for (const row of filteredRows.value) {
    const sourceName =
      (activeKey.value === 'detail'
        ? props.detailFields?.find((field) => field.key === row.key)?.label
        : undefined) || getSourceFieldTitle(row.key);
    for (const candidate of [
      sourceName,
      row.label,
      'title' in row ? row.title : undefined,
    ]) {
      if (typeof candidate === 'string' && candidate.trim())
        names.add(candidate.trim());
    }
  }
  for (const action of filteredActionRows.value) {
    const name = (action.label || action.key).trim();
    if (name) names.add(name);
  }
  // 属性名统一追加在名称、别名之后；共用 Set，重复文本仍保留前面的候选位置。
  for (const row of filteredRows.value) {
    const key = row.key.trim();
    if (key) names.add(key);
  }
  return [...names].map((name) => ({ label: name, value: name }));
});
const previewSignature = computed(() =>
  rows.value
    .map((row) => {
      if (activeKey.value === 'list') {
        const header = row as CrudPageDisplayHeaderConfig;
        return `${header.key}:${header.title || header.label || ''}:${header.visible?.mode || ''}`;
      }
      return `${row.key}:${row.label || ''}:${row.hidden === true}`;
    })
    .join('|'),
);
function getDevelopmentDefaultGroups(view: GroupView): DrawerDisplayGroup[] {
  const fields = getAllowedFields(view);
  if (fields.length < 7) return [];
  const entries = new Map<string, CrudFieldConfig[]>();
  for (const field of fields) {
    if (!field.layoutGroup) continue;
    entries.set(field.layoutGroup, [
      ...(entries.get(field.layoutGroup) || []),
      field,
    ]);
  }
  return [...entries.entries()]
    .filter(([, groupFields]) => isEligibleStaticDisplayGroup(groupFields))
    .map(([key, groupFields], index) => ({
      developmentDefault: true,
      key,
      order: index,
      title:
        groupFields.find((field) => field.layoutGroupTitle)?.layoutGroupTitle ||
        key,
    }));
}

function resolveGroups(view: GroupView): DrawerDisplayGroup[] {
  return sortDisplayGroups(ensureGroups(view));
}

const activeGroups = computed(() => {
  groupRenderVersion.value;
  return isGroupableView(activeKey.value) ? resolveGroups(activeKey.value) : [];
});
const orderedActiveGroups = computed(() => activeGroups.value);
const groupOptions = computed(() => [
  { label: '不分组', value: undefined },
  ...orderedActiveGroups.value.map((group) => ({
    label: group.title || group.key,
    value: group.key,
  })),
]);
const fieldOptions = computed(() =>
  props.fields.map((field) => ({
    label: field.label || field.key,
    value: field.key,
  })),
);

function getSourceFieldTitle(key: string) {
  if (key === '__actions') return '操作';
  const virtual = draft.value.list?.headers?.find(
    (header) => header.key === key && header.virtual === true,
  );
  return (
    virtual?.title ||
    virtual?.label ||
    props.fields.find((field) => field.key === key)?.label ||
    key
  );
}

function isSourceFieldRequired(key: string) {
  return props.fields.some((field) => field.key === key && field.required);
}

function getSourceLayoutGroupTitle(key: string) {
  const field = props.fields.find((item) => item.key === key);
  if (!field?.layoutGroup || props.fields.length < 7) return undefined;
  const groupFields = props.fields.filter(
    (item) => item.layoutGroup === field.layoutGroup,
  );
  if (groupFields.length < 3) return undefined;
  return groupFields.find((item) => item.layoutGroupTitle)?.layoutGroupTitle;
}

function isOperationHeader(row: CrudPageDisplayHeaderConfig) {
  return row.key === '__actions';
}

function getRowGroupKey(
  row: CrudPageDisplayFieldConfig,
  view = activeKey.value,
) {
  if (!isGroupableView(view)) return undefined;
  const configuredKey = row.layoutGroup;
  if (row.layoutGroupExcluded === true) return undefined;
  if (configuredKey) {
    return resolveGroups(view).some((group) => group.key === configuredKey)
      ? configuredKey
      : undefined;
  }
  const source = getAllowedFields(view).find((field) => field.key === row.key);
  return source?.layoutGroup &&
    resolveGroups(view).some((group) => group.key === source.layoutGroup)
    ? source.layoutGroup
    : undefined;
}

function getRowGroupsForView(view: View) {
  groupRenderVersion.value;
  const rowsForView = getRowsForView(view);
  if (!isGroupableView(view)) {
    return [{ group: undefined, key: '__all__', order: 0, rows: rowsForView }];
  }

  const sortRows = (items: CrudPageDisplayFieldConfig[]) =>
    [...items].toSorted(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) -
        (right.order ?? Number.MAX_SAFE_INTEGER),
    );
  // 分组解析在一次渲染内保持复用，避免大字段页面为每个字段重复扫描和排序所有分组。
  const displayGroups = resolveGroups(view);
  const displayGroupKeys = new Set(displayGroups.map((group) => group.key));
  const sourceGroupByKey = new Map(
    getAllowedFields(view).map((field) => [field.key, field.layoutGroup]),
  );
  const resolveRowGroupKey = (row: CrudPageDisplayFieldConfig) => {
    if (row.layoutGroupExcluded === true) return undefined;
    const groupKey = row.layoutGroup || sourceGroupByKey.get(row.key);
    return groupKey && displayGroupKeys.has(groupKey) ? groupKey : undefined;
  };
  const groups = displayGroups.map((group) => ({
    group,
    key: group.key,
    order: group.order ?? Number.MAX_SAFE_INTEGER,
    rows: sortRows(
      (rowsForView as CrudPageDisplayFieldConfig[]).filter(
        (row) => resolveRowGroupKey(row) === group.key,
      ),
    ),
  }));
  const unassignedRows = sortRows(
    (rowsForView as CrudPageDisplayFieldConfig[]).filter(
      (row) => !resolveRowGroupKey(row),
    ),
  );

  return [
    ...groups,
    {
      group: undefined,
      key: '__unassigned__',
      order: groupedViewHolder(view).unassignedOrder ?? Number.MAX_SAFE_INTEGER,
      rows: unassignedRows,
    },
  ].toSorted((left, right) => left.order - right.order);
}

function getRenderedRowGroups(view: View) {
  let remaining = fieldRenderLimits[view];

  // 首批额度属于当前 Tab，而不是每个分组，防止多分组页面一次性创建成倍的输入控件。
  return getRowGroupsForView(view)
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => matchesFieldSearch(row)),
    }))
    .filter((group) => !normalizedFieldSearch.value || group.rows.length > 0)
    .map((group) => {
      const rows = group.rows.slice(0, Math.max(remaining, 0));
      remaining -= rows.length;
      return { ...group, rows };
    });
}

function loadMoreFieldRows(event: Event, view: View) {
  if (view === 'list') return;
  const target = event.currentTarget as HTMLElement;
  const isNearBottom =
    target.scrollTop + target.clientHeight >= target.scrollHeight - 160;
  if (!isNearBottom) return;
  const totalRows = filteredRows.value.length;
  if (fieldRenderLimits[view] >= totalRows) return;
  fieldRenderLimits[view] = Math.min(
    fieldRenderLimits[view] + FIELD_RENDER_STEP,
    totalRows,
  );
}

function loadMoreListFields() {
  const totalRows = filteredRows.value.length;
  fieldRenderLimits.list = Math.min(
    fieldRenderLimits.list + FIELD_RENDER_STEP,
    totalRows,
  );
}

const rowGroups = computed(() => getRowGroupsForView(activeKey.value));

function getRowGroupRows(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
) {
  const group = rowGroups.value.find((item) => item.rows.includes(row));
  return group?.rows || [];
}

function assignRowToGroup(row: CrudPageDisplayFieldConfig, value: unknown) {
  if (!isGroupableView(activeKey.value)) return;
  const groupKey =
    typeof value === 'string' &&
    orderedActiveGroups.value.some((group) => group.key === value)
      ? value
      : undefined;
  row.layoutGroupExcluded = groupKey === undefined;
  moveDisplayFieldToGroupEnd(
    ensureFields(activeKey.value) as CrudPageDisplayFieldConfig[],
    row,
    groupKey,
  );
  groupRenderVersion.value += 1;
}

function canMoveRow(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
  offset: -1 | 1,
) {
  if (row.key === '__actions') return false;
  const groupRows = getRowGroupRows(row);
  if (groupRows[groupRows.indexOf(row) + offset]?.key === '__actions')
    return false;
  return (
    groupRows.indexOf(row) + offset >= 0 &&
    groupRows.indexOf(row) + offset < groupRows.length
  );
}

function moveRow(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
  offset: -1 | 1,
) {
  if (!canMoveRow(row, offset)) return;
  const groupRows = getRowGroupRows(row);
  const index = groupRows.indexOf(row);
  const target = groupRows[index + offset];
  if (!target) return;
  // 稀疏配置也按当前组内实际顺序调整，避免两个未定义 order 互换后没有效果。
  groupRows.forEach((item, itemIndex) => {
    item.order = itemIndex;
  });
  [row.order, target.order] = [target.order, row.order];
}

function startDrag(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
  event: DragEvent,
) {
  draggedActionKey.value = undefined;
  const target = event.target as HTMLElement | null;
  if (
    dragStartFromInteractiveControl.value ||
    target?.closest(
      'button, input, textarea, select, [contenteditable="true"], [role="combobox"], [role="switch"]',
    )
  ) {
    event.preventDefault();
    return;
  }
  draggedRowIndex.value = rows.value.indexOf(row);
}

function captureDragOrigin(event: PointerEvent) {
  const target = event.target as HTMLElement | null;
  dragStartFromInteractiveControl.value = Boolean(
    target?.closest(
      'button, input, textarea, select, [contenteditable="true"], [role="combobox"], [role="switch"]',
    ),
  );
}

function clearDragOrigin() {
  dragStartFromInteractiveControl.value = false;
  draggedRowIndex.value = undefined;
  draggedActionKey.value = undefined;
}

// 行操作只在自身清单内拖拽，不能混入字段排序；输入控件仍保留原生交互。
function startActionDrag(
  action: CrudPageDisplayActionConfig,
  event: DragEvent,
) {
  draggedRowIndex.value = undefined;
  draggedActionKey.value = undefined;
  const target = event.target as HTMLElement | null;
  if (
    dragStartFromInteractiveControl.value ||
    target?.closest('button, input, textarea, select, [contenteditable="true"]')
  ) {
    event.preventDefault();
    return;
  }
  draggedActionKey.value = action.key;
}

function dropActionAt(target: CrudPageDisplayActionConfig) {
  const source = actionRows.value.find(
    (action) => action.key === draggedActionKey.value,
  );
  clearDragOrigin();
  if (!source || source.key === target.key) return;
  const actions = actionRows.value.filter(
    (action) => action.key !== source.key,
  );
  const targetIndex = actions.findIndex((action) => action.key === target.key);
  if (targetIndex === -1) return;
  actions.splice(targetIndex, 0, source);
  actions.forEach((action, index) => {
    action.order = index;
  });
  draft.value.list!.actions = actions;
}

function dropAt(
  target: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
) {
  const source = rows.value[draggedRowIndex.value ?? -1];
  draggedRowIndex.value = undefined;
  if (
    !source ||
    source === target ||
    source.key === '__actions' ||
    target.key === '__actions'
  )
    return;
  if (isGroupableView(activeKey.value)) {
    const groupKey = getRowGroupKey(target as CrudPageDisplayFieldConfig);
    (source as CrudPageDisplayFieldConfig).layoutGroup = groupKey;
    (source as CrudPageDisplayFieldConfig).layoutGroupExcluded =
      groupKey === undefined;
  }
  const groupRows = getRowGroupRows(target);
  const reordered = groupRows.filter((row) => row !== source);
  const targetIndex = reordered.indexOf(target);
  reordered.splice(targetIndex, 0, source);
  reordered.forEach((row, index) => {
    row.order = index;
  });
}

function restoreDevelopmentDefaultGroups(view: GroupView) {
  const defaults = getDevelopmentDefaultGroups(view);
  if (defaults.length === 0) {
    message.warning(`${viewTitle(view)}没有满足条件的开发默认分组。`);
    return;
  }
  const holder = groupedViewHolder(view);
  const defaultKeys = new Set(defaults.map((group) => group.key));
  const fields = ensureFields(view);
  const sourceByKey = new Map(
    getAllowedFields(view).map((field) => [field.key, field]),
  );
  for (const [index, field] of fields.entries()) {
    const source = sourceByKey.get(field.key);
    field.layoutGroup =
      source?.layoutGroup && defaultKeys.has(source.layoutGroup)
        ? source.layoutGroup
        : undefined;
    field.layoutGroupExcluded = false;
    field.order = source?.layoutOrder ?? index;
  }
  draft.value = {
    ...draft.value,
    [view]: {
      ...holder,
      groups: defaults.map(({ developmentDefault, ...group }) => group),
      unassignedOrder:
        Math.max(...defaults.map((group) => group.order ?? -1)) + 1,
    },
  };
  groupRenderVersion.value += 1;
  message.success(`${viewTitle(view)}已恢复开发默认分组，请上传后生效。`);
}

function addGroup() {
  if (!isGroupableView(activeKey.value)) return;
  const view = activeKey.value;
  const holder = groupedViewHolder(view);
  const groups = [...ensureGroups(view)];
  const key = crypto.randomUUID();
  const order =
    Math.max(
      holder.unassignedOrder ?? -1,
      ...groups.map((group) => group.order ?? -1),
    ) + 1;
  groups.push({
    defaultExpandedRows: 'all',
    key,
    order,
    title: `分组 ${groups.length + 1}`,
  });
  draft.value = { ...draft.value, [view]: { ...holder, groups } };
  groupRenderVersion.value += 1;
}

function removeGroup(group: CrudPageDisplayGroupConfig) {
  if (!isGroupableView(activeKey.value)) return;
  const view = activeKey.value;
  // 同时解除仅由开发默认值继承的归属，保证移除分组后字段真的回到默认区。
  for (const field of ensureFields(view)) {
    if (getRowGroupKey(field, view) !== group.key) continue;
    field.layoutGroup = undefined;
    field.layoutGroupExcluded = true;
  }
  releaseDisplayGroupFields(ensureFields(view), group.key);
  const holder = groupedViewHolder(view);
  const groups = ensureGroups(view).filter((item) => item !== group);
  draft.value = { ...draft.value, [view]: { ...holder, groups } };
  groupRenderVersion.value += 1;
}

function getRowGroupOrder(rowGroup: {
  group?: CrudPageDisplayGroupConfig;
  key: string;
}) {
  if (rowGroup.group) return rowGroup.group.order ?? Number.MAX_SAFE_INTEGER;
  return (
    groupedViewHolder(activeKey.value as GroupView).unassignedOrder ??
    Number.MAX_SAFE_INTEGER
  );
}

function setRowGroupOrder(
  rowGroup: { group?: CrudPageDisplayGroupConfig; key: string },
  order: number,
) {
  if (rowGroup.group) {
    rowGroup.group.order = order;
    return;
  }
  groupedViewHolder(activeKey.value as GroupView).unassignedOrder = order;
}

function moveRowGroup(
  rowGroup: { group?: CrudPageDisplayGroupConfig; key: string },
  offset: -1 | 1,
) {
  if (!isGroupableView(activeKey.value)) return;
  const index = rowGroups.value.findIndex((item) => item.key === rowGroup.key);
  const target = rowGroups.value[index + offset];
  if (!target) return;
  const order = getRowGroupOrder(rowGroup);
  setRowGroupOrder(rowGroup, getRowGroupOrder(target));
  setRowGroupOrder(target, order);
  groupRenderVersion.value += 1;
}

function canMoveRowGroup(
  rowGroup: { group?: CrudPageDisplayGroupConfig; key: string },
  offset: -1 | 1,
) {
  const index = rowGroups.value.findIndex((item) => item.key === rowGroup.key);
  return index + offset >= 0 && index + offset < rowGroups.value.length;
}

function createVariableGroups(
  kind: 'form' | 'header' | 'row',
): ScriptWorkbenchVariableGroup[] {
  const identity: ScriptWorkbenchVariableGroup[] = [
    {
      label: '用户',
      variables: [
        {
          defaultValue: {},
          label: '当前用户（完整对象）',
          name: 'user',
          type: 'json',
        },
        { label: '用户ID', name: 'user.id' },
        { label: '用户名', name: 'user.username' },
        { label: '登录名', name: 'user.loginName' },
        { label: '姓名', name: 'user.name' },
        { label: '租户ID', name: 'user.tenantId' },
        { label: '组织ID', name: 'user.orgId' },
        { label: '组织类型', name: 'user.orgType' },
        { label: '用户类型', name: 'user.type' },
        {
          defaultValue: [],
          label: '角色列表',
          name: 'user.roles',
          type: 'json',
        },
        {
          defaultValue: [],
          label: '备用角色列表',
          name: 'user.roleList',
          type: 'json',
        },
        {
          defaultValue: false,
          label: '是否超级管理员',
          name: 'user.superAdmin',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '是否超级管理员（兼容字段）',
          name: 'user.isSuperAdmin',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '超级管理员简写标记',
          name: 'user.sa',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '是否顶级超级管理员',
          name: 'user.topSuperAdmin',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '是否顶级超级管理员（兼容字段）',
          name: 'user.isTopSuperAdmin',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '顶级超级管理员简写标记',
          name: 'user.tsa',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '是否平台用户',
          name: 'user.platformUser',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '是否平台用户（兼容字段）',
          name: 'user.isPlatformUser',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '是否SAAS管理员',
          name: 'user.saasAdmin',
          type: 'boolean',
        },
        {
          defaultValue: false,
          label: '是否SAAS管理员（兼容字段）',
          name: 'user.isSaasAdmin',
          type: 'boolean',
        },
      ],
    },
    {
      label: '组织',
      variables: [
        {
          defaultValue: {},
          label: '当前组织（完整对象）',
          name: 'org',
          type: 'json',
        },
        { label: '组织ID', name: 'org.id' },
        { label: '组织名称', name: 'org.name' },
        { label: '组织编码', name: 'org.code' },
        { label: '组织类型', name: 'org.type' },
        { label: '父级组织ID', name: 'org.parentId' },
        { label: '组织路径', name: 'org.path' },
        { label: '组织层级', name: 'org.level', type: 'number' },
        {
          defaultValue: true,
          label: '是否启用',
          name: 'org.enable',
          type: 'boolean',
        },
      ],
    },
    {
      label: '租户',
      variables: [
        {
          defaultValue: {},
          label: '当前租户（完整对象）',
          name: 'tenant',
          type: 'json',
        },
        { label: '租户ID', name: 'tenant.id' },
        { label: '租户编码', name: 'tenant.code' },
        { label: '租户名称', name: 'tenant.name' },
        { label: '租户域名', name: 'tenant.domain' },
        { label: '站点标题', name: 'tenant.title' },
        { label: '站点 Logo', name: 'tenant.logo' },
        { label: '系统名称', name: 'tenant.sysName' },
        { label: '系统 Logo', name: 'tenant.sysLogo' },
        { label: '快捷图标', name: 'tenant.shortcutIcon' },
        { label: '主视觉图', name: 'tenant.mainImg' },
        { label: '标题图', name: 'tenant.titleImg' },
        { label: '技术支持', name: 'tenant.techSupport' },
        { label: '版权信息', name: 'tenant.copyright' },
        {
          defaultValue: {},
          label: '站点信息对象',
          name: 'tenant.siteInfo',
          type: 'json',
        },
        { label: '站点标题（siteInfo）', name: 'tenant.siteInfo.title' },
        { label: '站点 Logo（siteInfo）', name: 'tenant.siteInfo.logo' },
        { label: '主视觉图（siteInfo）', name: 'tenant.siteInfo.mainImg' },
        { label: '快捷图标（siteInfo）', name: 'tenant.siteInfo.shortcutIcon' },
      ],
    },
  ];
  if (kind === 'header') return identity;
  return [
    ...identity,
    {
      label: kind === 'row' ? '当前行数据' : '当前表单数据',
      variables: props.fields.map((field) => ({
        label: field.label || field.key,
        name: `${kind}.${field.key}`,
      })),
    },
  ];
}

function openScript(
  title: string,
  expression: string | undefined,
  groups: ScriptWorkbenchVariableGroup[],
  save: (value: string) => void,
  forListOperation = false,
) {
  listOperationScript.value = forListOperation;
  scriptTitle.value = title;
  scriptText.value = expression || '';
  scriptGroups.value = groups;
  applyScript.value = save;
  scriptOpen.value = true;
}

// 列表操作复用脚本工作台，只在确认应用时更新独立草稿；空表达式等同默认 true。
function editListOperationScript(operation: CrudListOperationCandidate) {
  openScript(
    `${operation.label}显示脚本`,
    draft.value.listOperations?.[operation.key]?.expression || 'true',
    createVariableGroups('header'),
    (value) => {
      draft.value.listOperations = {
        ...draft.value.listOperations,
        [operation.key]: { expression: value.trim() || 'true' },
      };
    },
    true,
  );
}

function editVisibilityScript(row: CrudPageDisplayFieldConfig) {
  row.visibility ||= {};
  openScript(
    '字段显示表达式',
    row.visibility.expression,
    createVariableGroups('form'),
    (value) => {
      row.visibility!.expression = value;
    },
  );
}

function editGroupVisibilityScript(row: CrudPageDisplayGroupConfig) {
  row.visibility ||= {};
  openScript(
    '分组显示表达式',
    row.visibility.expression,
    createVariableGroups('form'),
    (value) => {
      row.visibility!.expression = value;
    },
  );
}

function editHeaderScript(row: CrudPageDisplayHeaderConfig) {
  row.visible ||= { mode: 'script' };
  row.visible.mode = 'script';
  openScript(
    '表头显示表达式',
    row.visible.expression,
    createVariableGroups('header'),
    (value) => {
      row.visible!.expression = value;
    },
  );
}

function editActionScript(row: CrudPageDisplayActionConfig) {
  row.visible ||= { mode: 'script' };
  row.visible.mode = 'script';
  openScript(
    '行操作显示表达式',
    row.visible.expression,
    createVariableGroups('row'),
    (value) => {
      row.visible!.expression = value;
    },
  );
}

function editActionValueScript(row: CrudPageDisplayActionConfig) {
  row.valueDisplay ||= { mode: 'script' };
  row.valueDisplay.mode = 'script';
  openScript(
    '按钮名称值展示脚本',
    row.valueDisplay.expression,
    createVariableGroups('row'),
    (value) => {
      row.valueDisplay!.expression = value;
    },
  );
}

function editCellScript(row: CrudPageDisplayHeaderConfig) {
  row.valueDisplay ||= { mode: 'script' };
  row.valueDisplay.mode = 'script';
  openScript(
    '单元格值表达式',
    row.valueDisplay.expression,
    createVariableGroups('row'),
    (value) => {
      row.valueDisplay!.expression = value;
    },
  );
}

function getScriptButtonLabel(expression: string | undefined) {
  return expression?.trim() ? '编辑脚本' : '添加脚本';
}

function getScriptButtonIcon(expression: string | undefined) {
  return expression?.trim() ? 'lucide:pencil' : 'lucide:plus';
}

function ensureDefaultValue(row: CrudPageDisplayFieldConfig) {
  return (row.defaultValue ||= {});
}

function getDependencyKeys(row: CrudPageDisplayFieldConfig) {
  return row.visibility?.dependsOn?.fieldKeys || emptyFieldKeys;
}

function setDependencyKeys(row: CrudPageDisplayFieldConfig, value: string[]) {
  row.visibility ||= {};
  row.visibility.dependsOn ||= { fieldKeys: [] };
  row.visibility.dependsOn.fieldKeys = value;
}

function getExclusiveKeys(row: CrudPageDisplayFieldConfig) {
  return row.visibility?.exclusiveWith?.fieldKeys || emptyFieldKeys;
}

function setExclusiveKeys(row: CrudPageDisplayFieldConfig, value: string[]) {
  row.visibility ||= {};
  row.visibility.exclusiveWith ||= { fieldKeys: [] };
  row.visibility.exclusiveWith.fieldKeys = value;
}

function previewLabel(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
) {
  if (activeKey.value === 'list') {
    const header = row as CrudPageDisplayHeaderConfig;
    return header.title || header.label || header.key;
  }
  return row.label || getSourceFieldTitle(row.key);
}

// 选项与空选择使用稳定引用，避免无实际变化时反复触发选择器的深层更新。
const emptyFieldKeys: string[] = [];
const defaultInputDisplayOptions = [{ label: '默认', value: 'default' }];
const inlineInputDisplayOptions = [
  ...defaultInputDisplayOptions,
  { label: '平铺选项', value: 'inline-options' },
];

function getInputDisplayOptions(row: CrudPageDisplayFieldConfig) {
  const field = props.fields.find((item) => item.key === row.key);
  return field && supportsInlineChoiceOptions(field)
    ? inlineInputDisplayOptions
    : defaultInputDisplayOptions;
}

const cssLengthPattern = /^\d+(?:\.\d+)?(?:px|%|vh|vw|vmin|vmax)$/i;

function viewTitle(view: Exclude<View, 'list'>) {
  return view === 'query'
    ? '查询表单'
    : view === 'create'
      ? '新增表单'
      : view === 'edit'
        ? '编辑表单'
        : '详情表单';
}

function validateExpression(expression: string | undefined, label: string) {
  const source = expression?.trim();
  if (!source) return undefined;
  try {
    new Function(`return (${source});`);
  } catch {
    return `${label}语法无效，请在脚本工作台修正后上传。`;
  }
  return undefined;
}

function validateView(view: Exclude<View, 'list'>) {
  const fields = ensureFields(view);
  const groups = ensureGroups(view);
  if (view === 'detail' && fields.length === 0) {
    return '详情表单没有可配置字段，不能上传空详情配置。';
  }
  const form = view === 'query' ? undefined : formHolder(view);
  for (const [label, value] of [
    ['弹窗最大宽度', form?.modalMaxWidth],
    ['弹窗最大高度', form?.modalMaxHeight],
  ] as const) {
    if (value?.trim() && !cssLengthPattern.test(value.trim())) {
      return `${viewTitle(view)}${label}格式无效，只支持如 960px、80vw、70vh 或 100%。`;
    }
  }
  const groupKeys = new Set<string>();
  for (const group of groups) {
    const key = group.key?.trim();
    if (!key) return `${viewTitle(view)}存在空分组标识。`;
    if (groupKeys.has(key)) return `${viewTitle(view)}的分组标识“${key}”重复。`;
    groupKeys.add(key);
    const expressionError = validateExpression(
      group.visibility?.expression,
      `分组“${group.title || key}”展示脚本`,
    );
    if (expressionError) return expressionError;
  }
  const fieldKeys = new Set(fields.map((field) => field.key));
  const titles = new Map<string, boolean>();
  const sourceByKey = new Map(
    getAllowedFields(view).map((field) => [field.key, field]),
  );
  for (const field of fields) {
    // 开发默认字段可能同名，不能阻止无关配置上传；自定义别名新增冲突仍需拒绝。
    const sourceTitle = sourceByKey.get(field.key)?.label?.trim() || field.key;
    const title = field.label?.trim() || sourceTitle;
    const customTitle = title !== sourceTitle;
    if (titles.has(title) && (customTitle || titles.get(title))) {
      return `${viewTitle(view)}存在重复标题“${title}”，请调整标题别名。`;
    }
    titles.set(title, customTitle);
    if (field.layoutGroup && !groupKeys.has(field.layoutGroup)) {
      return `${viewTitle(view)}字段“${field.label || field.key}”引用了不存在的分组“${field.layoutGroup}”。`;
    }
    const references = [
      ...(field.visibility?.dependsOn?.fieldKeys || []),
      ...(field.visibility?.exclusiveWith?.fieldKeys || []),
    ];
    for (const key of references) {
      if (key === field.key)
        return `${viewTitle(view)}字段“${field.label || field.key}”不能引用自身。`;
      if (!fieldKeys.has(key))
        return `${viewTitle(view)}字段“${field.label || field.key}”引用了不存在的字段“${key}”。`;
    }
    const expressionError = validateExpression(
      field.visibility?.expression,
      `字段“${field.label || field.key}”展示脚本`,
    );
    if (expressionError) return expressionError;
  }
  const cycle = findDisplayRuleCycle(fields);
  if (cycle)
    return `${viewTitle(view)}存在展示规则循环：${cycle.join(' → ')}，请调整依赖或互斥项后上传。`;
  return undefined;
}

function validateDisplayConfig(): undefined | { message: string; view: View } {
  ensureHeaders();
  for (const view of ['query', 'create', 'edit', 'detail'] as const) {
    const error = validateView(view);
    if (error) return { message: error, view };
  }
  const titles = new Set<string>();
  for (const header of draft.value.list?.headers || []) {
    const title = header.title?.trim() || header.label?.trim() || header.key;
    if (header.visible?.mode !== 'hidden' && titles.has(title)) {
      return {
        message: `展示列表存在重复标题“${title}”，请调整标题别名。`,
        view: 'list',
      };
    }
    if (header.visible?.mode !== 'hidden') titles.add(title);
    if (header.virtual === true && !/^[A-Z][\w.-]{0,127}$/i.test(header.key)) {
      return { message: `虚拟字段“${title}”的字段编码无效。`, view: 'list' };
    }
    if (
      header.virtual === true &&
      props.fields.some((field) => field.key === header.key)
    ) {
      return {
        message: `虚拟字段“${title}”的字段编码与真实字段冲突。`,
        view: 'list',
      };
    }
    if (
      header.virtual === true &&
      (draft.value.list?.headers || []).some(
        (item) => item !== header && item.key === header.key,
      )
    ) {
      return { message: `虚拟字段“${title}”的字段编码重复。`, view: 'list' };
    }
    if (header.virtual === true && !header.valueDisplay?.expression?.trim()) {
      return {
        message: `虚拟字段“${title}”必须填写值展示脚本。`,
        view: 'list',
      };
    }
    const visibleError = validateExpression(
      header.visible?.expression,
      `列表列“${title}”显示脚本`,
    );
    if (visibleError) return { message: visibleError, view: 'list' };
    const valueError = validateExpression(
      header.valueDisplay?.expression,
      `列表列“${header.title || header.label || header.key}”值展示脚本`,
    );
    if (valueError) return { message: valueError, view: 'list' };
  }
  return undefined;
}

const uploadTooltip = computed(() => {
  const counts = { disabled: 0, hidden: 0, omitted: 0 };
  for (const view of ['query', 'create', 'edit', 'detail'] as const) {
    for (const field of draft.value[view]?.fields || []) {
      const mode = getDisplaySubmitMode(field);
      if (mode === 'disabled-submit') counts.disabled += 1;
      if (mode === 'hidden-submit') counts.hidden += 1;
      if (mode === 'hidden-omit') counts.omitted += 1;
    }
  }
  const scopeText = [
    scope.value.tenantId ? '指定租户' : '当前租户',
    scope.value.domain ? '指定站点' : '任意站点',
  ].join('、');
  return `上传到${scopeText}。字段状态：隐提 ${counts.hidden}、禁提 ${counts.disabled}、不提 ${counts.omitted}；上传前会校验尺寸、分组、引用和脚本。`;
});

function save() {
  for (const [key, operation] of Object.entries(
    draft.value.listOperations || {},
  )) {
    const error = validateExpression(
      operation.expression,
      `列表操作“${key}”显示脚本`,
    );
    if (error) {
      activeKey.value = 'list';
      message.error(error);
      return;
    }
  }
  const validationError = validateDisplayConfig();
  if (validationError) {
    activeKey.value = validationError.view;
    message.error(validationError.message);
    return;
  }
  emit('save', { config: clone(draft.value), scope: { ...scope.value } });
}

type SelectedKind = 'action' | 'field' | 'group';
const selectedItem = ref<{ key: string; kind: SelectedKind }>();

// 选择状态只保存稳定键；右侧直接引用第二版草稿，不复制或覆盖其它字段的编辑值。
const selectedEntry = computed(() => {
  const selection = selectedItem.value;
  if (selection?.kind === 'group') {
    const group = activeGroups.value.find((item) => item.key === selection.key);
    if (group) return { item: group, kind: 'group' as const };
  }
  if (selection?.kind === 'action') {
    const action = filteredActionRows.value.find(
      (item) => item.key === selection.key,
    );
    if (action) return { item: action, kind: 'action' as const };
  }
  const field =
    filteredRows.value.find(
      (item) => selection?.kind === 'field' && item.key === selection.key,
    ) || filteredRows.value[0];
  if (field) return { item: field, kind: 'field' as const };
  const action = filteredActionRows.value[0];
  return action ? { item: action, kind: 'action' as const } : undefined;
});
const selectedSourceField = computed(() => {
  const key = selectedEntry.value?.item.key;
  return (
    activeKey.value === 'detail' ? props.detailFields : props.fields
  )?.find((field) => field.key === key);
});
const selectedTitle = computed(() => {
  const entry = selectedEntry.value;
  if (!entry) return '';
  if (entry.kind === 'group')
    return (entry.item as CrudPageDisplayGroupConfig).title || entry.item.key;
  if (entry.kind === 'action')
    return (entry.item as CrudPageDisplayActionConfig).label;
  return (
    selectedSourceField.value?.label || getSourceFieldTitle(entry.item.key)
  );
});

// 左侧完整清单只渲染轻量元素；搜索不改变底层分组对象或排序依据。
const visibleRowGroups = computed(() =>
  rowGroups.value
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => matchesFieldSearch(row)),
    }))
    .filter((group) => !normalizedFieldSearch.value || group.rows.length > 0),
);

function selectItem(kind: SelectedKind, key: string) {
  selectedItem.value = { kind, key };
}
function patchSelectedItem(patch: Record<string, unknown>) {
  if (selectedEntry.value) Object.assign(selectedEntry.value.item, patch);
}
function removeGroupFromList(group: CrudPageDisplayGroupConfig) {
  const view = activeKey.value;
  if (!isGroupableView(view)) return;

  // 删除前只展示确认，不提前移动字段；确认时再次核对视图和分组，避免操作到过期对象。
  Modal.confirm({
    title: `确认删除分组“${group.title || group.key}”？`,
    content: '组内字段将移至“不分组”，不会删除字段。修改在上传当前配置后生效。',
    okText: '删除分组',
    cancelText: '取消',
    okType: 'danger',
    maskClosable: false,
    onOk: () => {
      if (!props.open || activeKey.value !== view) return;
      const target = ensureGroups(view).find((item) => item.key === group.key);
      if (!target) return;
      removeGroup(target);
      if (
        selectedItem.value?.kind === 'group' &&
        selectedItem.value.key === target.key
      ) {
        selectedItem.value = undefined;
      }
    },
  });
}
function getRowAlias(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
) {
  return activeKey.value === 'list'
    ? (row as CrudPageDisplayHeaderConfig).title
    : row.label;
}

function isConfiguredVisible(
  item:
    | CrudPageDisplayFieldConfig
    | CrudPageDisplayHeaderConfig
    | CrudPageDisplayActionConfig,
  view: View,
) {
  // 这里只反映配置开关，不执行角色或脚本判断；左侧标记不承担状态修改职责。
  return view === 'list'
    ? (item as CrudPageDisplayHeaderConfig).visible?.mode !== 'hidden'
    : (item as CrudPageDisplayFieldConfig).hidden !== true;
}

function visibilityBadgeClass(visible: boolean) {
  return visible
    ? 'border-success/30 bg-success/5 text-success'
    : 'border-border bg-muted text-muted-foreground';
}

function updateListVisibility(
  item: CrudPageDisplayHeaderConfig | CrudPageDisplayActionConfig,
  checked: boolean,
) {
  // 列表有独立状态列，直接修改当前行草稿；保留脚本和其它条件，仍由上传统一保存。
  item.visible = { ...item.visible, mode: checked ? 'always' : 'hidden' };
}
function updateRowAlias(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
  event: Event,
) {
  const value = (event.target as HTMLInputElement).value;
  Object.assign(
    row,
    activeKey.value === 'list' ? { title: value } : { label: value },
  );
}
function requestSelectedScript(
  kind:
    | 'actionValue'
    | 'actionVisibility'
    | 'fieldVisibility'
    | 'groupVisibility'
    | 'headerValue'
    | 'headerVisibility',
) {
  const item = selectedEntry.value?.item;
  if (!item) return;
  // 脚本依旧通过既有工作台与验证路径，只为当前选中项打开编辑。
  switch (kind) {
    case 'actionValue': {
      editActionValueScript(item as CrudPageDisplayActionConfig);
      break;
    }
    case 'fieldVisibility': {
      editVisibilityScript(item as CrudPageDisplayFieldConfig);
      break;
    }
    case 'groupVisibility': {
      editGroupVisibilityScript(item as CrudPageDisplayGroupConfig);
      break;
    }
    case 'headerValue': {
      editCellScript(item as CrudPageDisplayHeaderConfig);
      break;
    }
    case 'headerVisibility': {
      editHeaderScript(item as CrudPageDisplayHeaderConfig);
      break;
    }
    default: {
      editActionScript(item as CrudPageDisplayActionConfig);
    }
  }
}
watch(activeKey, () => {
  selectedItem.value = undefined;
});

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }
    resetFieldRenderLimits();
    for (const view of Object.keys(fieldSearchKeywords) as View[]) {
      fieldSearchKeywords[view] = '';
    }
    draft.value = resolveCrudPageDisplayDefaults(clone(props.modelValue));
    scope.value = normalizeScope(props.initialScope);
    void loadScopeOptions();
    void loadRoleVisibilityOptions();
    // 一次补齐数据并建立关闭比较基线；复杂 UI 始终只挂载选中项，不因切换视图产生假修改。
    for (const view of ['query', 'create', 'edit', 'detail'] as const) {
      ensureFields(view);
      ensureGroups(view);
    }
    ensureHeaders();
    ensureActions();
    selectedItem.value = undefined;
    initialSnapshot.value = currentSnapshot();
    previewExpanded.value = false;
    void refreshPreviewOverflow();
  },
  { immediate: true },
);

watch(
  () => [props.modelValue, props.initialScope] as const,
  ([modelValue]) => {
    if (!props.open) return;
    const savedSnapshot = JSON.stringify({
      config: modelValue || { version: 1 },
      scope: normalizeScope(props.initialScope),
    });
    // 保存结果成为新基线，保留上传期间继续编辑的草稿。
    initialSnapshot.value = savedSnapshot;
  },
  { deep: true },
);

watch([activeKey, previewSignature], () => {
  if (!props.open) return;
  previewExpanded.value = false;
  void refreshPreviewOverflow();
});

watch(activeKey, () => {
  // 更新活动视图前恢复滚动起点，沿用原先重建容器时的行为，避免旧滚动位置触发批量加载。
  if (fieldScrollRef.value) fieldScrollRef.value.scrollTop = 0;
});

watch(normalizedFieldSearch, () => {
  // 搜索先覆盖全部候选，再从结果首批展示；清空后不会遗留旧滚动位置或加载额度。
  fieldRenderLimits[activeKey.value] = INITIAL_FIELD_RENDER_LIMIT;
  if (fieldScrollRef.value) fieldScrollRef.value.scrollTop = 0;
});

onUnmounted(() => {
  previewResizeObserver?.disconnect();
  observedPreviewElement = null;
});
onMounted(() => {
  void loadRoleVisibilityOptions();
});
</script>

<template>
  <Drawer
    :open="open"
    :title="`界面UI设置2 · ${code}`"
    width="min(90vw, 1800px)"
    :body-style="{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }"
    :mask-closable="false"
    @close="requestClose"
  >
    <div
      data-test="page-display-v2-scope"
      class="mb-0.5 grid grid-cols-4 gap-3 px-0 py-[1.5px]"
    >
      <Tooltip :title="scopeMatchTooltip">
        <Input :value="code" disabled addon-before="设置项编码" />
      </Tooltip>
      <Select
        v-model:value="scope.tenantId"
        :options="tenantScopeOptions"
        placeholder="当前租户"
        allow-clear
        show-search
        @change="loadScopeOptions"
      />
      <Select
        v-model:value="scope.domain"
        :options="siteScopeOptions"
        placeholder="当前域名站点"
        allow-clear
        show-search
      />
      <Select
        v-model:value="scope.userType"
        :options="userTypeScopeOptions"
        placeholder="未指定（匹配任意）"
        allow-clear
        show-search
      />
      <Select
        v-model:value="scope.userCategory"
        :options="userCategoryScopeOptions"
        placeholder="未指定（匹配任意）"
        allow-clear
        show-search
      />
      <Select
        v-model:value="scope.orgCategory"
        :options="orgCategoryScopeOptions"
        placeholder="未指定（匹配任意）"
        allow-clear
        show-search
      />
      <Select
        v-model:value="scope.orgType"
        :options="orgTypeScopeOptions"
        placeholder="未指定（匹配任意）"
        allow-clear
        show-search
      />
      <Tooltip :title="uploadTooltip">
        <Button
          type="primary"
          class="col-start-4 w-full"
          :disabled="saving"
          :loading="saving"
          @click="save"
        >
          上传当前配置
        </Button>
      </Tooltip>
    </div>
    <Tabs v-model:active-key="activeKey">
      <Tabs.TabPane key="query" tab="查询表单" />
      <Tabs.TabPane key="create" tab="新增表单" />
      <Tabs.TabPane key="edit" tab="编辑表单" />
      <Tabs.TabPane key="detail" tab="详情表单" />
      <Tabs.TabPane key="list" tab="展示列表" />
    </Tabs>

    <PageDisplaySettingsTabContent v-if="renderedView" :view="renderedView">
      <template #default="{ view }">
        <!-- 页签基础设置在上方独立排列，保持在字段滚动区域外。 -->
        <div class="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <section v-if="view === 'query'" class="contents">
            <Form layout="inline" :style="{ display: 'contents' }">
              <Popover
                placement="bottomLeft"
                title="展示字段清单"
                trigger="hover"
              >
                <template #content>
                  <div class="flex max-w-80 flex-wrap gap-2">
                    <span
                      v-for="item in getRowsForView(view)"
                      :key="item.key"
                      class="border-border rounded border px-2 py-1 text-sm"
                      >{{ previewLabel(item) }}</span
                    >
                  </div>
                </template>
                <Button>展示字段清单</Button>
              </Popover>
              <Tooltip
                title="启用后，查询字段变更会立即刷新列表，并隐藏手动查询按钮。"
              >
                <Form.Item label="自动查询" class="mb-0">
                  <Switch
                    v-model:checked="queryHolder().autoSearch"
                    checked-children="自动"
                    un-checked-children="手动"
                  />
                </Form.Item>
              </Tooltip>
            </Form>
          </section>

          <PageDisplaySettingsListTab
            v-if="view === 'list'"
            :config="draft.list!"
            :headers="listRows"
            :preview-label="previewLabel"
            @add-virtual-field="addVirtualHeader"
            @update:config="(value) => (draft.list = value)"
          />

          <PageDisplaySettingsDetailTab
            v-if="view === 'detail'"
            :config="detailHolder()"
            :fields="detailRows"
            :preview-label="previewLabel"
            @update:config="(value) => (draft.detail = value)"
          />

          <section v-if="view === 'create' || view === 'edit'" class="contents">
            <Form layout="inline" :style="{ display: 'contents' }">
              <Popover
                placement="bottomLeft"
                title="展示字段清单"
                trigger="hover"
              >
                <template #content>
                  <div class="flex max-w-80 flex-wrap gap-2">
                    <span
                      v-for="item in getRowsForView(view)"
                      :key="item.key"
                      class="border-border rounded border px-2 py-1 text-sm"
                      >{{ previewLabel(item) }}</span
                    >
                  </div> </template
                ><Button>展示字段清单</Button>
              </Popover>
              <Tooltip
                title="留空沿用当前页面配置；支持 960px、80vw 等 CSS 长度。"
              >
                <Form.Item label="弹窗最大宽度" class="mb-0">
                  <Input
                    v-model:value="formHolder(view as FormView).modalMaxWidth"
                    class="w-[90px]"
                    placeholder="80vw"
                  />
                </Form.Item>
              </Tooltip>
              <Tooltip
                title="留空沿用当前页面配置；支持 70vh、720px 等 CSS 长度。"
              >
                <Form.Item label="弹窗最大高度" class="mb-0">
                  <Input
                    v-model:value="formHolder(view as FormView).modalMaxHeight"
                    class="w-[90px]"
                    placeholder="70vh"
                  />
                </Form.Item>
              </Tooltip>
              <Tooltip
                v-if="view === 'create' || view === 'edit'"
                title="开启后，表单首次打开默认进入快捷填写；不满足快捷填写条件时自动保持普通表单。"
              >
                <Form.Item label="快捷填写" class="mb-0">
                  <Switch
                    v-model:checked="formHolder(view as FormView).quickFill"
                    aria-label="快捷填写"
                    checked-children="开启"
                    un-checked-children="关闭"
                  />
                </Form.Item>
              </Tooltip>
              <Tooltip
                v-if="view === 'edit'"
                title="开启后，编辑表单实际上传的字段即使为空也会更新；关闭后保留服务端默认的空值忽略语义。"
              >
                <Form.Item label="自动强制更新字段" class="mb-0">
                  <Switch
                    v-model:checked="editHolder().autoForceUpdateField"
                    checked-children="开启"
                    un-checked-children="关闭"
                  />
                </Form.Item>
              </Tooltip>
            </Form>
          </section>
        </div>

        <!-- 列表操作按用户指定位置嵌入基础设置与搜索之间，不增加页签。 -->
        <section
          v-if="view === 'list'"
          data-test="page-display-v2-list-operations"
          class="mb-3 flex flex-wrap items-center gap-2"
          aria-label="列表操作展示脚本"
        >
          <span class="mr-1 font-medium">列表操作展示脚本：</span>
          <Tooltip
            v-for="operation in listOperationCandidates"
            :key="operation.key"
            :title="`${operation.placement === 'left' ? '左侧' : '右侧'}按钮；仅在原条件成立时执行附加脚本。${operation.key.startsWith('settings:') ? '超管始终保留此入口。' : ''} 当前脚本：${draft.listOperations?.[operation.key]?.expression || 'true'}`"
          >
            <Button
              size="small"
              :aria-label="`配置${operation.label}显示脚本`"
              @click="editListOperationScript(operation)"
              >{{ operation.label }}</Button
            >
          </Tooltip>
        </section>

        <!-- 搜索及分组操作紧邻字段清单，两个版本分别维护自身工具区。 -->
        <div
          data-test="page-display-field-tools"
          class="mb-3 flex flex-wrap items-center gap-3"
        >
          <div class="flex max-w-full flex-wrap items-center gap-3">
            <AutoComplete
              v-model:value="fieldSearchKeywords[activeKey]"
              allow-clear
              :default-active-first-option="false"
              :filter-option="false"
              :options="fieldSearchOptions"
              :show-action="['focus']"
              class="w-[13.333rem] max-w-full"
            >
              <Input aria-label="搜索字段" placeholder="搜索名称、编码或别名">
                <template #prefix>
                  <IconifyIcon
                    icon="lucide:search"
                    class="text-muted-foreground size-4"
                  />
                </template>
              </Input>
            </AutoComplete>
            <span class="text-muted-foreground text-sm" role="status">
              匹配 {{ fieldSearchResultCount }} / {{ fieldSearchTotalCount }} 项
            </span>
          </div>
          <template v-if="isGroupableView(view)">
            <Button type="primary" class="px-4" @click="addGroup">
              + 添加分组
            </Button>
            <Tooltip
              title="移除当前表单的运行时分组覆盖，并按开发阶段的有效分组重新组织草稿；上传后才保存。"
            >
              <Button
                @click="restoreDevelopmentDefaultGroups(view as GroupView)"
              >
                恢复开发默认分组
              </Button>
            </Tooltip>
            <span class="text-muted-foreground text-sm"
              >字段未归入任何分组时显示在默认分组。</span
            >
          </template>
        </div>

        <!-- 左侧仅保留轻量识别与排序控件；右侧同时只存在一个属性编辑器。 -->
        <div
          class="settings-v2-workspace flex min-h-0 flex-1 gap-4 overflow-hidden"
        >
          <section
            class="settings-v2-fields border-border flex min-h-0 w-[55.2%] shrink-0 flex-col overflow-hidden rounded border"
          >
            <div
              ref="fieldScrollRef"
              class="min-h-0 flex-1 overflow-auto"
              data-test="page-display-v2-field-list"
            >
              <table
                class="w-full table-fixed text-sm"
                aria-label="界面UI设置2字段列表"
              >
                <colgroup>
                  <col class="w-[44%]" />
                  <col class="w-[28%]" />
                  <col class="w-[28%]" />
                </colgroup>
                <thead class="bg-muted sticky top-0 z-10 text-left">
                  <tr>
                    <th scope="col" class="px-3 py-3">字段</th>
                    <th scope="col" class="px-2 py-3">标题别名</th>
                    <th scope="col" class="px-2 py-3">
                      {{ view === 'list' ? '是否展示' : '所属分组' }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template
                    v-for="rowGroup in visibleRowGroups"
                    :key="rowGroup.key"
                  >
                    <tr
                      v-if="view !== 'list'"
                      class="bg-primary-background-lightest border-border border-y"
                    >
                      <td colspan="3" class="py-2 pl-1 pr-3">
                        <div class="flex items-center gap-2">
                          <div class="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              class="settings-v2-move settings-v2-group-move"
                              :disabled="!canMoveRowGroup(rowGroup, -1)"
                              aria-label="上移分组"
                              @click="moveRowGroup(rowGroup, -1)"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              class="settings-v2-move settings-v2-group-move"
                              :disabled="!canMoveRowGroup(rowGroup, 1)"
                              aria-label="下移分组"
                              @click="moveRowGroup(rowGroup, 1)"
                            >
                              ↓
                            </button>
                          </div>
                          <span class="shrink-0 font-medium"
                            >分组
                            {{
                              rowGroups.findIndex(
                                (group) => group.key === rowGroup.key,
                              ) + 1
                            }}：</span
                          >
                          <button
                            v-if="rowGroup.group"
                            type="button"
                            class="text-primary min-w-0 flex-1 truncate text-left font-medium"
                            @click="selectItem('group', rowGroup.key)"
                          >
                            {{ rowGroup.group.title || rowGroup.key }}
                          </button>
                          <span v-else class="flex-1 font-medium"
                            >默认分组</span
                          >
                          <span class="text-muted-foreground"
                            >{{ rowGroup.rows.length }} 项</span
                          >
                          <Tooltip v-if="rowGroup.group" title="删除分组">
                            <button
                              type="button"
                              class="settings-v2-move text-destructive shrink-0"
                              :aria-label="`删除分组 ${rowGroup.group.title || rowGroup.key}`"
                              @click.stop="removeGroupFromList(rowGroup.group)"
                            >
                              <IconifyIcon
                                icon="lucide:trash-2"
                                class="mx-auto size-3.5"
                              />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                    <tr
                      v-for="row in rowGroup.rows"
                      :key="row.key"
                      data-test="page-display-v2-field-row"
                      :data-field-key="row.key"
                      class="border-border hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                      :class="
                        selectedEntry?.kind === 'field' &&
                        selectedEntry.item.key === row.key
                          ? 'bg-primary/10'
                          : ''
                      "
                      :aria-selected="
                        selectedEntry?.kind === 'field' &&
                        selectedEntry.item.key === row.key
                      "
                      :draggable="row.key !== '__actions'"
                      tabindex="0"
                      @click="selectItem('field', row.key)"
                      @keydown.enter.self.prevent="selectItem('field', row.key)"
                      @pointerdown.capture="captureDragOrigin"
                      @dragstart="startDrag(row, $event)"
                      @dragend="clearDragOrigin"
                      @dragover.prevent
                      @drop="dropAt(row)"
                    >
                      <td class="px-3 py-2 align-middle">
                        <div class="flex items-center gap-2">
                          <span
                            class="text-muted-foreground cursor-grab"
                            aria-label="拖动排序"
                            >⠿</span
                          >
                          <div class="flex shrink-0 flex-col">
                            <button
                              type="button"
                              class="settings-v2-move"
                              :disabled="!canMoveRow(row, -1)"
                              :aria-label="`上移字段 ${row.key}`"
                              @click.stop="moveRow(row, -1)"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              class="settings-v2-move"
                              :disabled="!canMoveRow(row, 1)"
                              :aria-label="`下移字段 ${row.key}`"
                              @click.stop="moveRow(row, 1)"
                            >
                              ↓
                            </button>
                          </div>
                          <div class="min-w-0 flex-1">
                            <div
                              class="break-words"
                              :class="
                                row.key === '__actions'
                                  ? 'text-primary font-bold'
                                  : 'font-medium'
                              "
                            >
                              {{
                                row.key === '__actions'
                                  ? '操作列'
                                  : getSourceFieldTitle(row.key)
                              }}
                            </div>
                            <div
                              class="text-muted-foreground break-all text-xs"
                            >
                              {{ row.key }}
                            </div>
                          </div>
                          <span
                            v-if="view !== 'list'"
                            data-test="page-display-v2-visibility"
                            class="shrink-0 whitespace-nowrap rounded border px-1 text-xs leading-5"
                            :class="
                              visibilityBadgeClass(
                                isConfiguredVisible(row, view),
                              )
                            "
                            :aria-label="`${row.key}配置为${isConfiguredVisible(row, view) ? '展示' : '隐藏'}`"
                            >{{
                              isConfiguredVisible(row, view) ? '展示' : '隐藏'
                            }}</span
                          >
                        </div>
                      </td>
                      <td class="px-2 py-2">
                        <input
                          class="settings-v2-input"
                          :value="getRowAlias(row) || ''"
                          :aria-label="`${row.key}标题别名`"
                          :placeholder="getSourceFieldTitle(row.key)"
                          @focus="selectItem('field', row.key)"
                          @click.stop
                          @input="updateRowAlias(row, $event)"
                        />
                      </td>
                      <td class="px-2 py-2">
                        <select
                          v-if="view !== 'list'"
                          class="settings-v2-input"
                          :aria-label="`${row.key}所属分组`"
                          :value="getRowGroupKey(row, view) || ''"
                          @focus="selectItem('field', row.key)"
                          @click.stop
                          @change="
                            assignRowToGroup(
                              row,
                              ($event.target as HTMLSelectElement).value ||
                                undefined,
                            )
                          "
                        >
                          <option value="">不分组</option>
                          <option
                            v-for="group in groupOptions.filter(
                              (option) => option.value,
                            )"
                            :key="group.value"
                            :value="group.value"
                          >
                            {{ group.label }}
                          </option>
                        </select>
                        <span v-else @click.stop>
                          <Switch
                            data-test="page-display-v2-visibility-switch"
                            :checked="isConfiguredVisible(row, 'list')"
                            checked-children="展示"
                            un-checked-children="隐藏"
                            :aria-label="`${getSourceFieldTitle(row.key)}是否展示`"
                            @update:checked="
                              (checked) => updateListVisibility(row, checked)
                            "
                          />
                        </span>
                      </td>
                    </tr>
                  </template>
                  <tr
                    v-if="view === 'list' && filteredActionRows.length > 0"
                    class="bg-muted/60 border-border border-y"
                  >
                    <td colspan="3" class="px-3 py-2 font-medium">操作按钮</td>
                  </tr>
                  <tr
                    v-for="action in filteredActionRows"
                    :key="action.key"
                    data-test="page-display-v2-action-row"
                    :data-action-key="action.key"
                    class="border-border hover:bg-muted/50 cursor-pointer border-b"
                    :class="
                      selectedEntry?.kind === 'action' &&
                      selectedEntry.item.key === action.key
                        ? 'bg-primary/10'
                        : ''
                    "
                    tabindex="0"
                    draggable="true"
                    @pointerdown.capture="captureDragOrigin"
                    @dragstart="startActionDrag(action, $event)"
                    @dragend="clearDragOrigin"
                    @dragover.prevent
                    @drop="dropActionAt(action)"
                    @click="selectItem('action', action.key)"
                    @keydown.enter.self.prevent="
                      selectItem('action', action.key)
                    "
                  >
                    <td class="px-3 py-2 align-middle">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-muted-foreground cursor-grab"
                          aria-label="拖动排序"
                          >⠿</span
                        >
                        <div class="flex shrink-0 flex-col">
                          <button
                            type="button"
                            class="settings-v2-move"
                            :disabled="actionRows.indexOf(action) === 0"
                            aria-label="上移操作"
                            @click.stop="moveAction(action, -1)"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            class="settings-v2-move"
                            :disabled="
                              actionRows.indexOf(action) ===
                              actionRows.length - 1
                            "
                            aria-label="下移操作"
                            @click.stop="moveAction(action, 1)"
                          >
                            ↓
                          </button>
                        </div>
                        <!-- 名称仅作按钮类型标记，不挂载业务动作或独立点击入口。 -->
                        <div class="min-w-0 flex-1">
                          <span
                            data-test="page-display-v2-action-label"
                            class="border-primary/20 bg-primary/5 text-primary inline-block max-w-full cursor-default break-words rounded border px-2 py-0.5 text-xs font-medium"
                            title="操作按钮名称（仅标识，不执行操作）"
                            >{{ action.label }}</span
                          >
                          <div class="text-muted-foreground break-all text-xs">
                            {{ action.key }}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-2 py-2">
                      <input
                        class="settings-v2-input"
                        :value="action.title || ''"
                        :aria-label="`${action.key}标题别名`"
                        @focus="selectItem('action', action.key)"
                        @click.stop
                        @input="
                          action.title = (
                            $event.target as HTMLInputElement
                          ).value
                        "
                      />
                    </td>
                    <td class="px-2 py-2">
                      <span @click.stop>
                        <Switch
                          data-test="page-display-v2-visibility-switch"
                          :checked="isConfiguredVisible(action, 'list')"
                          checked-children="展示"
                          un-checked-children="隐藏"
                          :aria-label="`${action.label}是否展示`"
                          @update:checked="
                            (checked) => updateListVisibility(action, checked)
                          "
                        />
                      </span>
                    </td>
                  </tr>
                  <tr v-if="fieldSearchResultCount === 0">
                    <td
                      colspan="3"
                      class="text-muted-foreground px-3 py-8 text-center"
                    >
                      未找到匹配的字段或操作
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <aside
            class="settings-v2-inspector border-border min-h-0 min-w-0 flex-1 overflow-auto rounded border p-4"
            aria-label="属性编辑面板"
          >
            <PageDisplaySettingsV2PropertyPanel
              v-if="selectedEntry"
              :item="selectedEntry.item"
              :kind="selectedEntry.kind"
              :view="view"
              :title="selectedTitle"
              :source-field="selectedSourceField"
              :field-options="fieldOptions"
              :role-options="roleVisibilityOptions"
              :role-loading="roleVisibilityLoading"
              @patch="patchSelectedItem"
              @script="requestSelectedScript"
              @load-roles="loadRoleVisibilityOptions"
            />
            <div v-else class="text-muted-foreground py-12 text-center">
              请在左侧选择字段或分组
            </div>
          </aside>
        </div>
      </template>
    </PageDisplaySettingsTabContent>
    <ScriptWorkbenchDialog
      v-model:open="scriptOpen"
      :model-value="scriptText"
      :test-context="activeScriptTestContext"
      :title="scriptTitle"
      :variable-groups="scriptGroups"
      @update:model-value="(value) => applyScript?.(value)"
    />
  </Drawer>
</template>

<style scoped>
/* 原生轻量控件承载左侧整张清单，主题及焦点提示沿用框架变量。 */
.settings-v2-input {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
.settings-v2-input:focus {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 1px;
}
.settings-v2-move {
  width: 24px;
  height: 22px;
  border-radius: 4px;
}
/* 分组排序双箭头使用紧凑尺寸，并由标题行的小间距容器统一靠左排列。 */
.settings-v2-group-move {
  width: 20px;
  height: 20px;
}
.settings-v2-move:hover:not(:disabled) {
  background: hsl(var(--accent));
}
.settings-v2-move:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
/* 窄视口按上下顺序提供完整操作空间，两区仍可滚动且不遮住上传工具。 */
@media (max-width: 900px) {
  .settings-v2-workspace {
    flex-direction: column;
    overflow: auto;
  }
  .settings-v2-fields {
    width: 100%;
    min-height: 260px;
  }
  .settings-v2-inspector {
    flex-shrink: 0;
    min-height: 320px;
  }
}
</style>
