<script lang="ts" setup>
import type { UiSettingRuntimeRecord } from '../app/api/ui-setting-runtime';
import PageDisplaySettingTitle from './page-display-setting-title.vue';
import {
  AutoComplete,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popover,
  Radio,
  Select,
  Switch,
  Tag,
  Tabs,
  Tooltip,
} from 'ant-design-vue';
import { IconifyIcon } from '@vben/runtime/icons';
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

import { fetchDictOptions, fetchEnumOptions, fetchOptions } from '../api';
import ScriptWorkbenchDialog, {
  type ScriptWorkbenchVariableGroup,
} from './script-workbench-dialog.vue';
import PageDisplaySettingsDetailTab from './page-display-settings-detail-tab.vue';
import PageDisplaySettingsListTab from './page-display-settings-list-tab.vue';
import { OAK_BASE_API_MODULE, roleOptionsLoader } from './config-helpers';
import { normalizeCrudGroupDisplayStyle } from './crud-group-display';
import {
  findDisplayRuleCycle,
  getDisplaySubmitMode,
  setDisplaySubmitMode,
  getDefaultFieldHidden,
  getDefaultVisibleRoleCodes,
  isEligibleStaticDisplayGroup,
  initializeVisibleRoleCodes,
  initializeFieldHidden,
  initializeHeaderVisibility,
  moveDisplayFieldToGroupEnd,
  reconcileCrudPageDisplayActions,
  reconcileCrudPageDisplayHeaders,
  releaseDisplayGroupFields,
  resolveCrudPageDisplayDefaults,
  resolveDefaultTableColumnWidth,
  sortDisplayGroups,
  supportsInlineChoiceOptions,
} from './crud-page-display';
import type {
  CrudFieldConfig,
  CrudPageDisplayActionCandidate,
  CrudPageDisplayActionConfig,
  CrudPageDisplayConfig,
  CrudPageDisplayFieldConfig,
  CrudPageDisplayGroupedViewConfig,
  CrudPageDisplayGroupConfig,
  CrudPageDisplayHeaderConfig,
} from './types';
import type { CrudFormElementDeclaration } from './crud-form-elements';

type FormView = 'create' | 'detail' | 'edit';
type View = FormView | 'list' | 'query';
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
  domainObject?: boolean;
  initialScope?: Scope;
  fields: CrudFieldConfig[];
  formElements?: CrudFormElementDeclaration[];
  detailFields?: CrudFieldConfig[];
  modelValue?: CrudPageDisplayConfig;
  open: boolean;
  saving?: boolean;
  settingRecord?: null | UiSettingRuntimeRecord;
  showOperationColumn?: boolean;
  scriptTestContext?: Record<string, any>;
}>();

const emit = defineEmits<{
  load: [];
  'update:open': [value: boolean];
  save: [value: { config: CrudPageDisplayConfig; scope: Scope }];
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
const scriptText = ref('');
const scriptTitle = ref('脚本工作台');
const scriptGroups = ref<ScriptWorkbenchVariableGroup[]>([]);
const applyScript = ref<(value: string) => void>();
const draggedRowIndex = ref<number>();
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
  | {
      orgCategories: Array<{ label: string; value: string }>;
      orgTypes: Array<{ label: string; value: string }>;
      sites: Array<{ label: string; value: string }>;
      tenantId?: string;
      tenants: Array<{ label: string; value: string }>;
      userCategories: Array<{ label: string; value: string }>;
      userTypes: Array<{ label: string; value: string }>;
    }
  | undefined;
let scopeOptionsRequestVersion = 0;
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
  const requestVersion = ++scopeOptionsRequestVersion;
  const requestTenantId = scope.value.tenantId;
  const cachedOptions = cachedScopeOptions;
  if (cachedOptions && cachedOptions.tenantId === requestTenantId) {
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
        requestTenantId
          ? fetchOptions(
              '/TenantSite/list',
              'domain',
              'domain',
              {
                enable: true,
                pageIndex: 1,
                pageSize: 500,
                tenantId: requestTenantId,
              },
              OAK_BASE_API_MODULE,
            )
          : Promise.resolve([]),
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
    if (
      requestVersion !== scopeOptionsRequestVersion ||
      requestTenantId !== scope.value.tenantId
    )
      return;
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

function handleTenantScopeChange() {
  // 域名必须属于当前租户；切换租户后不能保留旧域名或使用旧请求的候选项。
  scope.value.domain = undefined;
  siteScopeOptions.value = [];
  void loadScopeOptions();
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
      : view === 'query'
        ? // 查询表单额外包含“标题展示”控件，互斥项必须占独立第十二列而不能折到下一行。
          '52px 120px 150px 170px 160px 160px 220px 220px 220px 220px 200px 200px'
        : // 查询、新增和编辑视图的状态组、角色与关联选择器需要保持完整操作宽度；窄视口由外层横向滚动承载。
          '52px 120px 150px 170px 160px 160px 220px 220px 220px 220px 200px';
}

function getAllowedFields(view: Exclude<View, 'list'>) {
  const sourceFields =
    view === 'detail' ? props.detailFields || [] : props.fields;
  const fieldKeys = new Set<string>();

  // 同一稳定字段键只能进入一个表单行，避免页面静态配置重复时渲染重复控件。
  const fields = sourceFields.filter((field) => {
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
  const known = new Set(fields.map((field) => field.key));
  for (const element of props.formElements || []) {
    if (element.view !== view || known.has(element.key)) continue;
    fields.push({
      key: element.key,
      label: element.label,
      search: view === 'query',
      form: view !== 'query',
    });
  }
  return fields;
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
  const groups = (holder.groups ||= []);
  const defaults = getDevelopmentDefaultGroups(view);
  for (const defaultGroup of defaults) {
    if (!groups.some((group) => group.key === defaultGroup.key)) {
      const { developmentDefault, ...group } = defaultGroup;
      groups.push(group);
    }
  }
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
  const configured = ensureGroups(view);
  const defaults = getDevelopmentDefaultGroups(view);
  const groups = new Map<string, DrawerDisplayGroup>(
    defaults.map((group) => [group.key, group]),
  );
  for (const group of configured) {
    groups.set(group.key, group);
  }
  return sortDisplayGroups([...groups.values()]);
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
  [row.order, target.order] = [target.order, row.order];
}

function startDrag(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
  event: DragEvent,
) {
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
    (source as CrudPageDisplayFieldConfig).layoutGroup = getRowGroupKey(
      target as CrudPageDisplayFieldConfig,
    );
  }
  const groupRows = getRowGroupRows(target);
  const targetIndex = groupRows.indexOf(target);
  const reordered = groupRows.filter((row) => row !== source);
  reordered.splice(targetIndex, 0, source);
  reordered.forEach((row, index) => {
    row.order = index;
  });
}

function restoreDevelopmentDefaultGroups(view: GroupView) {
  const defaults = getDevelopmentDefaultGroups(view);
  if (!defaults.length) {
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
  const index = rowGroups.value.indexOf(rowGroup as any);
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
  const index = rowGroups.value.indexOf(rowGroup as any);
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
) {
  scriptTitle.value = title;
  scriptText.value = expression || '';
  scriptGroups.value = groups;
  applyScript.value = save;
  scriptOpen.value = true;
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
  const titles = new Set<string>();
  const sourceByKey = new Map(
    getAllowedFields(view).map((field) => [field.key, field]),
  );
  for (const field of fields) {
    const title =
      field.label?.trim() ||
      sourceByKey.get(field.key)?.label?.trim() ||
      field.key;
    if (titles.has(title)) {
      return `${viewTitle(view)}存在重复标题“${title}”，请调整标题别名。`;
    }
    titles.add(title);
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

function changedViews(): View[] {
  try {
    const baseline = JSON.parse(initialSnapshot.value || '{}').config || {};
    return (['query', 'create', 'edit', 'detail', 'list'] as const).filter(
      (view) =>
        JSON.stringify(draft.value[view]) !== JSON.stringify(baseline[view]),
    );
  } catch {
    return [activeKey.value];
  }
}

function validateDisplayConfig(
  views: View[],
): { message: string; view: View } | undefined {
  ensureHeaders();
  for (const view of views.filter(
    (view): view is Exclude<View, 'list'> => view !== 'list',
  )) {
    const error = validateView(view);
    if (error) return { message: error, view };
  }
  if (!views.includes('list')) return undefined;
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
    if (
      header.virtual === true &&
      !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(header.key)
    ) {
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
  const validationError = validateDisplayConfig(changedViews());
  if (validationError) {
    activeKey.value = validationError.view;
    message.error(validationError.message);
    return;
  }
  emit('save', { config: clone(draft.value), scope: { ...scope.value } });
}

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
    // 大字段页面只初始化当前页签，避免打开抽屉时同步构造五套复杂配置树。
    if (activeKey.value === 'list') {
      ensureHeaders();
      ensureActions();
    } else {
      ensureFields(activeKey.value);
      ensureGroups(activeKey.value);
    }
    initialSnapshot.value = currentSnapshot();
    previewExpanded.value = false;
    void refreshPreviewOverflow();
  },
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
    :width="'min(90vw, 1800px)'"
    :body-style="{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      paddingTop: '12px',
    }"
    :mask-closable="false"
    @close="requestClose"
  >
    <template #title>
      <PageDisplaySettingTitle
        :title="`页面展示设置 · ${code}`"
        :record="settingRecord"
      />
    </template>
    <div class="mb-1 grid grid-cols-4 gap-3 px-3 py-[3px]">
      <Tooltip :title="scopeMatchTooltip">
        <Input :value="code" disabled addon-before="设置项编码" />
      </Tooltip>
      <Select
        v-model:value="scope.tenantId"
        :options="tenantScopeOptions"
        placeholder="当前租户"
        allow-clear
        show-search
        @change="handleTenantScopeChange"
      />
      <Select
        v-model:value="scope.domain"
        :options="siteScopeOptions"
        :disabled="!scope.tenantId"
        placeholder="当前域名站点（请先选择租户）"
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
      <!-- 加载与上传共用范围区最后一格，避免挤占其它适用范围控件。 -->
      <div class="col-start-4 flex gap-3">
        <Button class="flex-1" @click="emit('load')">加载设置</Button>
        <Tooltip :title="uploadTooltip" class="flex-1">
          <Button
            type="primary"
            class="w-full"
            :disabled="saving"
            :loading="saving"
            @click="save"
            >上传设置</Button
          >
        </Tooltip>
      </div>
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
                <template #content
                  ><div class="flex max-w-80 flex-wrap gap-2">
                    <span
                      v-for="item in getRowsForView(view)"
                      :key="item.key"
                      class="border-border rounded border px-2 py-1 text-sm"
                      >{{ previewLabel(item) }}</span
                    >
                  </div></template
                >
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
                <Form.Item label="默认不展示标题" class="mb-0">
                  <Switch
                    v-model:checked="queryHolder().defaultHideFieldTitle"
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
                ><template #content
                  ><div class="flex max-w-80 flex-wrap gap-2">
                    <span
                      v-for="item in getRowsForView(view)"
                      :key="item.key"
                      class="border-border rounded border px-2 py-1 text-sm"
                      >{{ previewLabel(item) }}</span
                    >
                  </div></template
                ><Button>展示字段清单</Button></Popover
              >
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
            <Button type="primary" class="px-4" @click="addGroup"
              >+ 添加分组</Button
            >
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

        <div
          ref="fieldScrollRef"
          data-test="page-display-settings-scroll"
          class="page-display-settings-scroll min-h-0 flex-1 overflow-auto"
          @scroll.passive="(event) => loadMoreFieldRows(event, view)"
        >
          <div
            v-if="normalizedFieldSearch && fieldSearchResultCount === 0"
            class="text-muted-foreground border-border rounded border px-4 py-8 text-center"
            role="status"
          >
            未找到匹配的字段{{ view === 'list' ? '或操作' : '' }}
          </div>
          <div
            class="border-border rounded border"
            :style="{ width: 'max-content' }"
          >
            <div
              data-test="page-display-settings-grid-header"
              class="page-display-settings-grid-header border-border bg-primary-background-lightest sticky top-0 z-20 grid gap-x-5 gap-y-3 border-b px-3 py-2 text-sm font-medium shadow-sm"
              :style="{ gridTemplateColumns: getFieldConfigGridTemplate(view) }"
            >
              <template v-if="view === 'list'">
                <Tooltip title="调整字段在当前展示列表中的前后顺序。"
                  ><span
                    aria-hidden="true"
                    class="page-display-settings-fixed-cell page-display-settings-fixed-header-cell page-display-settings-fixed-header-control-cell bg-primary-background-lightest sticky left-0 z-30"
                  ></span
                ></Tooltip>
                <div
                  class="page-display-settings-fixed-cell page-display-settings-fixed-header-cell bg-primary-background-lightest sticky left-[86px] z-30"
                >
                  <Tooltip title="当前配置所对应的数据字段。"
                    ><span>字段</span></Tooltip
                  >
                </div>
                <Tooltip title="当前列表列的标题别名；留空时沿用字段名称。"
                  ><span>标题别名</span></Tooltip
                >
                <Tooltip title="用于转换每行单元格显示内容。"
                  ><span>展示值脚本</span></Tooltip
                >
                <Tooltip
                  title="列表列当前的基础宽度；留空时使用当前页面已有配置。"
                  ><span>列宽</span></Tooltip
                >
                <Tooltip
                  title="列表列允许收缩前的最小像素宽度；留空时不额外限制。"
                  ><span>最小列宽</span></Tooltip
                >
                <Tooltip
                  title="该列允许扩展的最大像素宽度；留空时使用列表默认最大列宽。"
                  ><span>最大列宽</span></Tooltip
                >
                <Tooltip
                  title="控制整列是否显示，或使用脚本按当前上下文决定是否显示。"
                  ><span>是否展示</span></Tooltip
                >
                <Tooltip
                  title="留空继承列表默认超宽展示；可单独设为截断或换行。"
                  ><span>超宽展示样式</span></Tooltip
                >
                <Tooltip
                  title="只有当前用户拥有任一选中角色时，才会看到该列表列。"
                  ><span>可见角色</span></Tooltip
                >
                <Tooltip title="表头脚本控制列标题是否显示。"
                  ><span>显示脚本</span></Tooltip
                >
              </template>
              <template v-else>
                <Tooltip title="调整字段在当前表单中的前后顺序。"
                  ><span>调整</span></Tooltip
                >
                <Tooltip title="当前配置所对应的数据字段。"
                  ><span>字段</span></Tooltip
                >
                <Tooltip title="当前表单字段的标题别名；留空时沿用字段名称。"
                  ><span>标题别名</span></Tooltip
                >
                <Tooltip
                  v-if="view === 'detail'"
                  title="初始化表单时为字段预填的值。"
                  ><span>默认值</span></Tooltip
                >
                <Tooltip
                  v-if="view !== 'detail'"
                  title="初始化表单时为字段预填的值。"
                  ><span>默认值</span></Tooltip
                >
                <Tooltip
                  title="选择字段所属的展示分组；选择后字段会移动到该分组末尾。"
                  ><span>所属分组</span></Tooltip
                >
                <Tooltip
                  title="默认使用原控件；布尔、字典、枚举和固定选项可选择平铺展示。"
                  ><span>展示方式</span></Tooltip
                >
                <Tooltip
                  title="只有当前用户拥有任一选中角色时，才会看到该字段。"
                  ><span>可见角色</span></Tooltip
                >
                <Tooltip
                  :title="
                    view === 'detail'
                      ? '控制详情字段是否展示。'
                      : '控制字段是否展示及参与提交；权限、条件和分组提交选择仍然有效。'
                  "
                  ><span>{{
                    view === 'detail' ? '是否展示' : '展示与提交'
                  }}</span></Tooltip
                >
                <Tooltip v-if="false" title="初始化表单时为字段预填的值。"
                  ><span>默认值</span></Tooltip
                >
                <Tooltip title="编写脚本决定字段是否展示。"
                  ><span>显示脚本</span></Tooltip
                >
                <Tooltip title="依赖字段展示时当前字段才展示。"
                  ><span>依赖显示项</span></Tooltip
                >
                <Tooltip title="互斥字段展示时当前字段隐藏。"
                  ><span>互斥项</span></Tooltip
                >
              </template>
            </div>
            <template
              v-for="(rowGroup, groupIndex) in getRenderedRowGroups(view)"
              :key="rowGroup.key"
            >
              <div
                data-test="page-display-settings-group"
                class="w-full min-w-max"
                :class="
                  isGroupableView(view)
                    ? [
                        'border-primary bg-primary/5 overflow-hidden rounded border',
                        groupIndex === 0 ? '' : 'mt-5',
                      ]
                    : ''
                "
              >
                <div
                  v-if="isGroupableView(view)"
                  class="border-primary bg-primary/10 flex w-full flex-wrap items-center gap-2 border-b px-3 py-2"
                >
                  <template v-if="rowGroup.group">
                    <Tooltip title="上移分组"
                      ><Button
                        size="small"
                        :disabled="!canMoveRowGroup(rowGroup, -1)"
                        @click="moveRowGroup(rowGroup, -1)"
                        >↑</Button
                      ></Tooltip
                    >
                    <Tooltip title="下移分组"
                      ><Button
                        size="small"
                        :disabled="!canMoveRowGroup(rowGroup, 1)"
                        @click="moveRowGroup(rowGroup, 1)"
                        >↓</Button
                      ></Tooltip
                    >
                    <span class="min-w-5 text-right text-sm font-medium"
                      >分组 {{ groupIndex + 1 }}：</span
                    >
                    <Input
                      v-model:value="rowGroup.group.title"
                      placeholder="分组标题"
                      class="w-[210px]"
                    />
                    <div class="flex flex-wrap items-center gap-2">
                      <Tooltip
                        title="控制该分组初始展示的字段行数；选择展开所有字段则不折叠。"
                      >
                        <span class="text-sm">组自动折叠行数</span>
                      </Tooltip>
                      <Select
                        v-model:value="rowGroup.group.defaultExpandedRows"
                        class="w-[160px]"
                        :options="[
                          { label: '展开所有字段', value: 'all' },
                          { label: '1 行', value: 1 },
                          { label: '2 行', value: 2 },
                          { label: '3 行', value: 3 },
                          { label: '4 行', value: 4 },
                          { label: '5 行', value: 5 },
                          { label: '6 行', value: 6 },
                          { label: '7 行', value: 7 },
                          { label: '8 行', value: 8 },
                          { label: '9 行', value: 9 },
                          { label: '10 行', value: 10 },
                        ]"
                      />
                      <span class="text-sm">分组展示样式</span>
                      <Select
                        v-model:value="rowGroup.group.displayStyle"
                        class="w-[120px]"
                        :options="[
                          { label: '默认', value: 'divider' },
                          { label: '卡片', value: 'card' },
                          { label: '边框', value: 'border' },
                        ]"
                      />
                      <Select
                        v-model:value="rowGroup.group.visibleRoleCodes"
                        mode="multiple"
                        :loading="roleVisibilityLoading"
                        :options="roleVisibilityOptions"
                        placeholder="分组可见角色"
                        class="min-w-[180px]"
                        @focus="loadRoleVisibilityOptions"
                        @dropdown-visible-change="
                          (open) => open && loadRoleVisibilityOptions()
                        "
                      />
                      <Tooltip
                        title="编写脚本决定整个分组是否展示；不展示时组内字段不提交。"
                      >
                        <Button
                          size="small"
                          :aria-label="
                            getScriptButtonLabel(
                              rowGroup.group.visibility?.expression,
                            )
                          "
                          @click="editGroupVisibilityScript(rowGroup.group)"
                        >
                          <IconifyIcon
                            class="size-3.5"
                            :icon="
                              getScriptButtonIcon(
                                rowGroup.group.visibility?.expression,
                              )
                            "
                          />
                        </Button>
                      </Tooltip>
                      <template v-if="view === 'create' || view === 'edit'">
                        <span class="text-sm">显示提交勾选</span>
                        <Switch
                          :checked="rowGroup.group.showSubmitCheckbox === true"
                          aria-label="显示提交勾选"
                          @update:checked="
                            rowGroup.group.showSubmitCheckbox = $event
                          "
                        />
                      </template>
                    </div>
                    <Tooltip title="删除分组后，其中字段将回到默认分组。"
                      ><Button
                        danger
                        size="small"
                        @click="removeGroup(rowGroup.group)"
                        >删除分组</Button
                      ></Tooltip
                    >
                  </template>
                  <template v-else>
                    <Tooltip title="上移默认分组"
                      ><Button
                        size="small"
                        :disabled="!canMoveRowGroup(rowGroup, -1)"
                        @click="moveRowGroup(rowGroup, -1)"
                        >↑</Button
                      ></Tooltip
                    >
                    <Tooltip title="下移默认分组"
                      ><Button
                        size="small"
                        :disabled="!canMoveRowGroup(rowGroup, 1)"
                        @click="moveRowGroup(rowGroup, 1)"
                        >↓</Button
                      ></Tooltip
                    >
                    <span class="min-w-5 text-right text-sm font-medium"
                      >{{ groupIndex + 1 }}.</span
                    >
                    <span class="font-medium">默认分组</span>
                  </template>
                </div>
                <div
                  v-if="isGroupableView(view) && !rowGroup.rows.length"
                  class="border-border text-muted-foreground w-full border-b px-4 py-3 text-sm"
                >
                  暂无字段，可通过字段行的分组选择器归入此分组。
                </div>
                <div
                  v-for="row in rowGroup.rows"
                  :key="row.key"
                  draggable="true"
                  class="page-display-settings-field-row border-border grid w-full items-center gap-x-5 gap-y-3 border-b p-3 last:border-b-0"
                  :style="{
                    gridTemplateColumns: getFieldConfigGridTemplate(view),
                  }"
                  @pointerdown.capture="captureDragOrigin"
                  @dragstart="startDrag(row, $event)"
                  @dragend="clearDragOrigin"
                  @dragover.prevent
                  @drop="dropAt(row)"
                >
                  <div
                    class="flex gap-1"
                    :class="
                      view === 'list'
                        ? 'page-display-settings-fixed-body-cell page-display-settings-fixed-control-cell page-display-settings-fixed-cell page-display-settings-fixed-control-cell--list sticky left-0 z-10'
                        : ''
                    "
                  >
                    <Tooltip title="上移字段"
                      ><Button
                        size="small"
                        :disabled="!canMoveRow(row, -1)"
                        @click="moveRow(row, -1)"
                        >↑</Button
                      ></Tooltip
                    ><Tooltip title="下移字段"
                      ><Button
                        size="small"
                        :disabled="!canMoveRow(row, 1)"
                        @click="moveRow(row, 1)"
                        >↓</Button
                      ></Tooltip
                    >
                  </div>
                  <div
                    :class="
                      view === 'list'
                        ? 'page-display-settings-fixed-body-cell page-display-settings-fixed-field-cell page-display-settings-fixed-cell sticky left-[86px] z-10'
                        : ''
                    "
                  >
                    <Tooltip
                      :title="
                        view === 'list' &&
                        (row as CrudPageDisplayHeaderConfig).virtual
                          ? '虚拟字段编码由系统生成，创建后保持不变。'
                          : '按住可拖拽排序'
                      "
                    >
                      <Input
                        v-if="
                          view === 'list' &&
                          (row as CrudPageDisplayHeaderConfig).virtual
                        "
                        :value="(row as CrudPageDisplayHeaderConfig).key"
                        placeholder="虚拟字段编码"
                        readonly
                      />
                      <div v-else>
                        {{ getSourceFieldTitle(row.key) }}
                      </div>
                    </Tooltip>
                  </div>
                  <Input
                    v-if="view === 'list'"
                    v-model:value="(row as CrudPageDisplayHeaderConfig).title"
                    :placeholder="getSourceFieldTitle(row.key)"
                  />
                  <Tooltip
                    v-if="
                      view === 'list' &&
                      !isOperationHeader(row as CrudPageDisplayHeaderConfig)
                    "
                    title="编写脚本转换当前字段在每一行中的展示内容。"
                  >
                    <Button
                      size="small"
                      :aria-label="
                        getScriptButtonLabel(
                          (row as CrudPageDisplayHeaderConfig).valueDisplay
                            ?.expression,
                        )
                      "
                      @click="
                        editCellScript(row as CrudPageDisplayHeaderConfig)
                      "
                    >
                      <IconifyIcon
                        class="size-3.5"
                        :icon="
                          getScriptButtonIcon(
                            (row as CrudPageDisplayHeaderConfig).valueDisplay
                              ?.expression,
                          )
                        "
                      />
                    </Button>
                  </Tooltip>
                  <span v-else-if="view === 'list'" aria-hidden="true"></span>
                  <Input
                    v-else
                    v-model:value="row.label"
                    :placeholder="getSourceFieldTitle(row.key)"
                  />
                  <InputNumber
                    v-if="view === 'detail'"
                    v-model:value="ensureDefaultValue(row).value"
                    placeholder="默认值"
                    class="w-full"
                  />
                  <InputNumber
                    v-if="view !== 'list' && view !== 'detail'"
                    v-model:value="ensureDefaultValue(row).value"
                    placeholder="默认值"
                    class="w-full"
                  />
                  <Select
                    v-if="view !== 'list' && isGroupableView(view)"
                    :value="getRowGroupKey(row, view)"
                    :options="groupOptions"
                    placeholder="选择分组"
                    allow-clear
                    class="w-full"
                    @update:value="(value) => assignRowToGroup(row, value)"
                  />
                  <Input
                    v-else-if="view !== 'list'"
                    v-model:value="row.layoutGroup"
                    placeholder="分组 / 换行标识"
                  />
                  <template v-if="view === 'list'">
                    <InputNumber
                      v-model:value="(row as CrudPageDisplayHeaderConfig).width"
                      :min="40"
                      :precision="0"
                      addon-after="px"
                      placeholder="列宽"
                      class="w-full"
                    />
                    <InputNumber
                      v-model:value="
                        (row as CrudPageDisplayHeaderConfig).minWidth
                      "
                      :min="40"
                      :precision="0"
                      addon-after="px"
                      placeholder="不限制"
                      class="w-full"
                    />
                    <InputNumber
                      v-model:value="
                        (row as CrudPageDisplayHeaderConfig).maxWidth
                      "
                      :min="40"
                      :precision="0"
                      addon-after="px"
                      placeholder="默认"
                      class="w-full"
                    />
                    <Switch
                      :checked="
                        (row as CrudPageDisplayHeaderConfig).visible!.mode !==
                        'hidden'
                      "
                      checked-children="展示"
                      un-checked-children="不展示"
                      class="w-[57px] min-w-[57px]"
                      @change="
                        (value) =>
                          ((row as CrudPageDisplayHeaderConfig).visible!.mode =
                            value ? 'always' : 'hidden')
                      "
                    />
                    <Radio.Group
                      v-model:value="
                        (row as CrudPageDisplayHeaderConfig).overflowStrategy
                      "
                      button-style="solid"
                      option-type="button"
                      :options="[
                        { label: '默认', value: undefined },
                        { label: '截断', value: 'ellipsis' },
                        { label: '换行', value: 'wrap' },
                      ]"
                    />
                    <Select
                      v-model:value="
                        (row as CrudPageDisplayHeaderConfig).visibleRoleCodes
                      "
                      mode="multiple"
                      :loading="roleVisibilityLoading"
                      :options="roleVisibilityOptions"
                      placeholder="可见角色"
                      class="w-full"
                      @focus="loadRoleVisibilityOptions"
                      @dropdown-visible-change="
                        (open) => open && loadRoleVisibilityOptions()
                      "
                    />
                    <Tooltip title="编写脚本决定当前列是否展示。"
                      ><Button
                        size="small"
                        :aria-label="
                          getScriptButtonLabel(
                            (row as CrudPageDisplayHeaderConfig).visible
                              ?.expression,
                          )
                        "
                        @click="
                          editHeaderScript(row as CrudPageDisplayHeaderConfig)
                        "
                        ><IconifyIcon
                          class="size-3.5"
                          :icon="
                            getScriptButtonIcon(
                              (row as CrudPageDisplayHeaderConfig).visible
                                ?.expression,
                            )
                          " /></Button
                    ></Tooltip>
                  </template>
                  <template v-else>
                    <Radio.Group
                      v-if="view === 'query'"
                      v-model:value="row.titleVisibility"
                      button-style="solid"
                    >
                      <Radio.Button value="default">默认</Radio.Button>
                      <Radio.Button value="visible">展示</Radio.Button>
                      <Radio.Button value="hidden">不展示</Radio.Button>
                    </Radio.Group>
                    <Select
                      v-model:value="row.inputDisplay"
                      :options="getInputDisplayOptions(row)"
                      placeholder="展示方式"
                    />
                    <Select
                      v-model:value="row.visibleRoleCodes"
                      mode="multiple"
                      :loading="roleVisibilityLoading"
                      :options="roleVisibilityOptions"
                      placeholder="可见角色"
                      class="w-full"
                      @focus="loadRoleVisibilityOptions"
                      @dropdown-visible-change="
                        (open) => open && loadRoleVisibilityOptions()
                      "
                    />
                    <Radio.Group
                      v-if="view !== 'detail'"
                      :value="getDisplaySubmitMode(row)"
                      :aria-label="`${row.label || getSourceFieldTitle(row.key)}展示与提交`"
                      button-style="solid"
                      class="flex whitespace-nowrap"
                      @update:value="
                        (value) => setDisplaySubmitMode(row, value)
                      "
                    >
                      <Radio.Button value="display-submit">
                        <Tooltip title="展示控件并参与提交"
                          ><span>展提</span></Tooltip
                        >
                      </Radio.Button>
                      <Radio.Button value="hidden-submit">
                        <Tooltip title="不展示控件仍参与提交"
                          ><span>隐提</span></Tooltip
                        >
                      </Radio.Button>
                      <Radio.Button value="disabled-submit">
                        <Tooltip title="展示控件但不可修改仍参与提交"
                          ><span>禁提</span></Tooltip
                        >
                      </Radio.Button>
                      <Radio.Button value="hidden-omit">
                        <Tooltip title="不展示控件也不参与校验和提交"
                          ><span>不提</span></Tooltip
                        >
                      </Radio.Button>
                    </Radio.Group>
                    <Switch
                      v-else
                      :checked="!row.hidden"
                      checked-children="展示"
                      un-checked-children="不展示"
                      class="w-[57px] min-w-[57px]"
                      @change="(value) => (row.hidden = !value)"
                    />
                    <Tooltip title="编写脚本决定字段是否展示。"
                      ><Button
                        size="small"
                        :aria-label="
                          getScriptButtonLabel(row.visibility?.expression)
                        "
                        @click="editVisibilityScript(row)"
                        ><IconifyIcon
                          class="size-3.5"
                          :icon="
                            getScriptButtonIcon(row.visibility?.expression)
                          " /></Button
                    ></Tooltip>
                    <Select
                      :value="getDependencyKeys(row)"
                      mode="multiple"
                      :options="fieldOptions"
                      placeholder="依赖显示项"
                      class="min-w-[160px]"
                      @update:value="
                        (value) => setDependencyKeys(row, value as string[])
                      "
                    />
                    <Select
                      :value="getExclusiveKeys(row)"
                      mode="multiple"
                      :options="fieldOptions"
                      placeholder="互斥项"
                      class="min-w-[140px]"
                      @update:value="
                        (value) => setExclusiveKeys(row, value as string[])
                      "
                    />
                  </template>
                </div>
              </div>
            </template>
            <div
              v-if="
                view === 'list' && fieldRenderLimits.list < filteredRows.length
              "
              class="border-border border-x border-b px-3 py-2 text-center"
            >
              <Button @click="loadMoreListFields">
                加载更多字段（{{
                  filteredRows.length - fieldRenderLimits.list
                }}）
              </Button>
            </div>
            <template v-if="view === 'list' && filteredActionRows.length">
              <div
                v-for="action in filteredActionRows"
                :key="action.key"
                data-test="page-display-settings-action-row"
                class="page-display-settings-field-row border-border grid w-full items-center gap-x-5 gap-y-3 border-x border-b p-3"
                :style="{
                  gridTemplateColumns: getFieldConfigGridTemplate(view),
                }"
              >
                <div
                  class="page-display-settings-fixed-body-cell page-display-settings-fixed-control-cell page-display-settings-fixed-cell sticky left-0 z-10 flex gap-1"
                >
                  <Tooltip title="上移操作属性">
                    <Button
                      size="small"
                      :disabled="actionRows.indexOf(action) === 0"
                      @click="moveAction(action, -1)"
                    >
                      ↑
                    </Button>
                  </Tooltip>
                  <Tooltip title="下移操作属性">
                    <Button
                      size="small"
                      :disabled="
                        actionRows.indexOf(action) === actionRows.length - 1
                      "
                      @click="moveAction(action, 1)"
                    >
                      ↓
                    </Button>
                  </Tooltip>
                </div>
                <div
                  class="page-display-settings-fixed-body-cell page-display-settings-fixed-cell sticky left-[86px] z-10 flex items-center"
                >
                  <Tag color="blue">{{ action.label }}</Tag>
                </div>
                <Input
                  v-model:value="action.title"
                  :placeholder="action.label"
                />
                <Tooltip title="返回非空文本时，它会以最高优先级作为按钮名称。">
                  <Button
                    size="small"
                    :aria-label="
                      getScriptButtonLabel(action.valueDisplay?.expression)
                    "
                    @click="editActionValueScript(action)"
                  >
                    <IconifyIcon
                      class="size-3.5"
                      :icon="
                        getScriptButtonIcon(action.valueDisplay?.expression)
                      "
                    />
                  </Button>
                </Tooltip>
                <InputNumber
                  v-model:value="action.width"
                  :precision="0"
                  addon-after="px"
                  placeholder="默认"
                  class="w-full"
                />
                <InputNumber
                  v-model:value="action.minWidth"
                  :min="-1"
                  :precision="0"
                  addon-after="px"
                  placeholder="不限制"
                  class="w-full"
                />
                <InputNumber
                  v-model:value="action.maxWidth"
                  :min="-1"
                  :precision="0"
                  addon-after="px"
                  placeholder="默认"
                  class="w-full"
                />
                <Switch
                  :checked="action.visible?.mode !== 'hidden'"
                  checked-children="展示"
                  un-checked-children="隐藏"
                  class="w-[57px] min-w-[57px]"
                  @update:checked="
                    (value) =>
                      (action.visible = {
                        ...action.visible,
                        mode: value ? 'always' : 'hidden',
                      })
                  "
                />
                <Radio.Group
                  v-model:value="action.overflowStrategy"
                  button-style="solid"
                  option-type="button"
                  :options="[
                    { label: '默认', value: undefined },
                    { label: '截断', value: 'ellipsis' },
                    { label: '换行', value: 'wrap' },
                  ]"
                />
                <Select
                  v-model:value="action.visibleRoleCodes"
                  mode="multiple"
                  :loading="roleVisibilityLoading"
                  :options="roleVisibilityOptions"
                  placeholder="可见角色"
                  class="min-w-[200px]"
                  @focus="loadRoleVisibilityOptions"
                  @dropdown-visible-change="
                    (open) => open && loadRoleVisibilityOptions()
                  "
                />
                <Tooltip
                  title="使用当前行数据、当前用户、组织和租户设置附加显示条件；表达式失败时隐藏该操作。"
                >
                  <Button
                    size="small"
                    :aria-label="
                      getScriptButtonLabel(action.visible?.expression)
                    "
                    @click="editActionScript(action)"
                  >
                    <IconifyIcon
                      class="size-3.5"
                      :icon="getScriptButtonIcon(action.visible?.expression)"
                    />
                  </Button>
                </Tooltip>
              </div>
            </template>
          </div>
        </div>
      </template>
    </PageDisplaySettingsTabContent>
    <ScriptWorkbenchDialog
      v-model:open="scriptOpen"
      :model-value="scriptText"
      :test-context="scriptTestContext"
      :title="scriptTitle"
      :variable-groups="scriptGroups"
      @update:model-value="(value) => applyScript?.(value)"
    />
  </Drawer>
</template>

<style scoped>
.page-display-settings-field-row {
  isolation: isolate;
  /* 字段配置保持单行；宽度不足时由外层横向滚动承载，不拆分为第二行。 */
}

.page-display-settings-grid-header {
  isolation: isolate;
}

.page-display-settings-field-row > :not(.page-display-settings-fixed-cell),
.page-display-settings-grid-header > :not(.page-display-settings-fixed-cell) {
  position: relative;
  z-index: 0;
}

.page-display-settings-fixed-cell {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  align-self: stretch;
  width: 100%;
  min-height: 100%;
}

.page-display-settings-fixed-body-cell {
  height: 100%;
  isolation: isolate;
  z-index: 1000 !important;
}

.page-display-settings-fixed-field-cell {
  z-index: 1001 !important;
}

.page-display-settings-fixed-control-cell::before {
  position: absolute;
  z-index: 0;
  top: -0.75rem;
  bottom: -0.75rem;
  left: 0;
  width: 13.5rem;
  pointer-events: none;
  content: '';
  background-color: hsl(var(--background));
}

.page-display-settings-fixed-control-cell--list::before {
  width: 13.5rem;
}

.page-display-settings-fixed-header-cell {
  isolation: isolate;
  z-index: 1010 !important;
}

.page-display-settings-fixed-header-control-cell::before {
  position: absolute;
  z-index: 0;
  top: -0.5rem;
  bottom: -0.5rem;
  left: 0;
  width: 13.5rem;
  pointer-events: none;
  content: '';
  background-color: inherit;
}

.page-display-settings-fixed-cell > * {
  position: relative;
  z-index: 1;
}

.page-display-settings-field-row :deep(.ant-input),
.page-display-settings-field-row :deep(.ant-input-number),
.page-display-settings-field-row :deep(.ant-select) {
  width: 100%;
}

.page-display-settings-field-row :deep(.ant-radio-group) {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
}

.page-display-settings-field-row :deep(.ant-radio-button-wrapper) {
  min-width: 0;
  padding-inline: 8px;
  text-align: center;
  white-space: nowrap;
}

.page-display-settings-scroll {
  box-sizing: border-box;
}

.page-display-settings-scroll > .border-border {
  box-sizing: border-box;
  min-width: max-content;
}
</style>
