<script lang="ts" setup>
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Select,
  Switch,
  Tabs,
  Tooltip,
} from 'ant-design-vue';
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
import { OAK_BASE_API_MODULE, roleOptionsLoader } from './config-helpers';
import { normalizeCrudGroupDisplayStyle } from './crud-group-display';
import {
  findDisplayRuleCycle,
  getDisplaySubmitMode,
  setDisplaySubmitMode,
  getDefaultFieldHidden,
  getDefaultVisibleRoleCodes,
  initializeVisibleRoleCodes,
  initializeFieldHidden,
  initializeHeaderVisibility,
  moveDisplayFieldToGroupEnd,
  reconcileCrudPageDisplayHeaders,
  releaseDisplayGroupFields,
  resolveDefaultTableColumnWidth,
  sortDisplayGroups,
  supportsInlineChoiceOptions,
} from './crud-page-display';
import type {
  CrudFieldConfig,
  CrudPageDisplayConfig,
  CrudPageDisplayFieldConfig,
  CrudPageDisplayGroupedViewConfig,
  CrudPageDisplayGroupConfig,
  CrudPageDisplayHeaderConfig,
} from './types';

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
  code: string;
  domainObject?: boolean;
  initialScope?: Scope;
  fields: CrudFieldConfig[];
  detailFields?: CrudFieldConfig[];
  modelValue?: CrudPageDisplayConfig;
  open: boolean;
  saving?: boolean;
  showOperationColumn?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  save: [value: { config: CrudPageDisplayConfig; scope: Scope }];
}>();

const activeKey = ref<View>('query');
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
const draft = ref<CrudPageDisplayConfig>({ version: 1 });
const scope = ref<Scope>({});
const initialSnapshot = ref('');
const scriptOpen = ref(false);
const scriptText = ref('');
const scriptTitle = ref('脚本工作台');
const scriptGroups = ref<ScriptWorkbenchVariableGroup[]>([]);
const applyScript = ref<(value: string) => void>();
const draggedRowIndex = ref<number>();
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
let cachedRoleVisibilityOptions:
  | Array<{ label: string; value: string }>
  | undefined;
const roleVisibilityOptions = ref<Array<{ label: string; value: string }>>([]);
const roleVisibilityLoading = ref(false);
const groupRenderVersion = ref(0);
const previewContentRef = ref<HTMLElement | null>(null);
const previewExpanded = ref(false);
const previewOverflowing = ref(false);
let previewResizeObserver: null | ResizeObserver = null;
let observedPreviewElement: HTMLElement | null = null;

function currentSnapshot() {
  return JSON.stringify({ config: draft.value, scope: scope.value });
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
    domain: value.domain,
    orgCategory: value.orgCategory,
    orgType: value.orgType,
    tenantId: value.tenantId,
    userCategory: value.userCategory,
    userType: value.userType,
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

function getFieldConfigGridClass(view: View) {
  return view === 'list'
    ? 'grid-cols-[66px_160px_190px_124px_124px_124px_120px_220px_220px_600px]'
    : view === 'detail'
      ? 'grid-cols-[66px_160px_190px_190px_150px_220px_150px_170px_424px]'
      : 'grid-cols-[52px_120px_150px_130px_110px_180px_250px_150px_360px]';
}

function getFieldConfigMinWidthClass(view: View) {
  return view === 'list'
    ? 'min-w-[1704px]'
    : view === 'detail'
      ? 'min-w-[1830px]'
      : 'min-w-[1600px]';
}

function getAllowedFields(view: Exclude<View, 'list'>) {
  return (view === 'detail' ? props.detailFields || [] : props.fields).filter(
    (field) => {
      if (view === 'query') return field.search;
      if (view === 'create')
        return field.form !== false && field.formCreate !== false;
      if (view === 'edit')
        return field.form !== false && field.formEdit !== false;
      return true;
    },
  );
}

function ensureFields(view: Exclude<View, 'list'>) {
  const holder = (draft.value[view] ||= { fields: [] });
  if (view === 'query') {
    holder.autoSearch ??= false;
  }
  if (view === 'edit') {
    holder.autoForceUpdateField ??= true;
  }
  const allowed = getAllowedFields(view);
  const existing = new Map(holder.fields.map((item) => [item.key, item]));
  const nextFields: CrudPageDisplayFieldConfig[] = allowed.map(
    (field, index) =>
      existing.get(field.key) || {
        inputDisplay: 'default',
        hidden: getDefaultFieldHidden(field, {
          hideDomainId: props.domainObject === true,
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
    field.hidden = initializeFieldHidden(field);
    field.inputDisplay ??= 'default';
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
  holder.showEmptyValues ??= true;
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
  holder.defaultMinColumnWidth ??= 60;
  holder.defaultMaxColumnWidth ??= 360;
  holder.defaultOverflowStrategy ??= 'ellipsis';
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

function addVirtualHeader() {
  const holder = (draft.value.list ||= { headers: [] });
  const headers = ensureHeaders();
  const key = `virtual_${crypto.randomUUID().replaceAll('-', '')}`;
  headers.push({
    key,
    label: `虚拟字段 ${headers.filter((header) => header.virtual === true).length + 1}`,
    order: Math.max(-1, ...headers.map((header) => header.order ?? -1)) + 1,
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
    .filter(([, groupFields]) => groupFields.length >= 3)
    .map(([key, groupFields], index) => ({
      developmentDefault: true,
      key,
      order: Math.min(
        ...groupFields.map(
          (field) => field.layoutOrder ?? Number.MAX_SAFE_INTEGER,
        ),
        index,
      ),
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
  const groups = resolveGroups(view).map((group) => ({
    group,
    key: group.key,
    order: group.order ?? Number.MAX_SAFE_INTEGER,
    rows: sortRows(
      (rowsForView as CrudPageDisplayFieldConfig[]).filter(
        (row) => getRowGroupKey(row, view) === group.key,
      ),
    ),
  }));
  const unassignedRows = sortRows(
    (rowsForView as CrudPageDisplayFieldConfig[]).filter(
      (row) =>
        !getRowGroupKey(row, view) ||
        !groups.some((group) => group.key === getRowGroupKey(row, view)),
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

function getRenderedRows<T>(rows: T[], view: View) {
  return rows.slice(0, fieldRenderLimits[view]);
}

function loadMoreFieldRows(event: Event, view: View) {
  const target = event.currentTarget as HTMLElement;
  const isNearBottom =
    target.scrollTop + target.clientHeight >= target.scrollHeight - 160;
  if (!isNearBottom) return;
  const totalRows = getRowsForView(view).length;
  if (fieldRenderLimits[view] >= totalRows) return;
  fieldRenderLimits[view] = Math.min(
    fieldRenderLimits[view] + FIELD_RENDER_STEP,
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
  const groupRows = getRowGroupRows(row);
  return (
    groupRows.indexOf(row) + offset >= 0 &&
    groupRows.indexOf(row) + offset < groupRows.length
  );
}

function moveRow(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
  offset: -1 | 1,
) {
  const groupRows = getRowGroupRows(row);
  const index = groupRows.indexOf(row);
  const target = groupRows[index + offset];
  if (!target) return;
  [row.order, target.order] = [target.order, row.order];
}

function startDrag(
  row: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
) {
  draggedRowIndex.value = rows.value.indexOf(row);
}

function dropAt(
  target: CrudPageDisplayFieldConfig | CrudPageDisplayHeaderConfig,
) {
  const source = rows.value[draggedRowIndex.value ?? -1];
  draggedRowIndex.value = undefined;
  if (!source || source === target) return;
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

function ensureDefaultValue(row: CrudPageDisplayFieldConfig) {
  return (row.defaultValue ||= {});
}

function getDependencyKeys(row: CrudPageDisplayFieldConfig) {
  return row.visibility?.dependsOn?.fieldKeys || [];
}

function setDependencyKeys(row: CrudPageDisplayFieldConfig, value: string[]) {
  row.visibility ||= {};
  row.visibility.dependsOn ||= { fieldKeys: [] };
  row.visibility.dependsOn.fieldKeys = value;
}

function getExclusiveKeys(row: CrudPageDisplayFieldConfig) {
  return row.visibility?.exclusiveWith?.fieldKeys || [];
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

function getInputDisplayOptions(row: CrudPageDisplayFieldConfig) {
  const field = props.fields.find((item) => item.key === row.key);
  const options = [{ label: '默认', value: 'default' }];
  if (field && supportsInlineChoiceOptions(field)) {
    options.push({ label: '平铺选项', value: 'inline-options' });
  }
  return options;
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

function validateDisplayConfig(): { message: string; view: View } | undefined {
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
  const validationError = validateDisplayConfig();
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
    if (!open) return;
    resetFieldRenderLimits();
    draft.value = clone(props.modelValue);
    scope.value = normalizeScope(props.initialScope);
    void loadScopeOptions();
    void loadRoleVisibilityOptions();
    ensureHeaders();
    for (const view of ['query', 'create', 'edit', 'detail'] as const) {
      ensureFields(view);
      ensureGroups(view);
    }
    initialSnapshot.value = currentSnapshot();
    previewExpanded.value = false;
    void refreshPreviewOverflow();
  },
);

watch(
  () => props.modelValue,
  (modelValue) => {
    if (!props.open) return;
    const savedSnapshot = JSON.stringify({
      config: modelValue || { version: 1 },
      scope: normalizeScope(props.initialScope),
    });
    if (savedSnapshot === currentSnapshot()) {
      initialSnapshot.value = savedSnapshot;
    }
  },
  { deep: true },
);

watch([activeKey, previewSignature], () => {
  if (!props.open) return;
  previewExpanded.value = false;
  void refreshPreviewOverflow();
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
    :title="`页面展示设置 · ${code}`"
    :width="'min(90vw, 1800px)'"
    :body-style="{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }"
    :mask-closable="false"
    @close="requestClose"
  >
    <div class="border-border mb-4 grid grid-cols-4 gap-3 rounded border p-3">
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
          >上传当前配置</Button
        >
      </Tooltip>
    </div>
    <Tabs v-model:active-key="activeKey">
      <Tabs.TabPane key="query" tab="查询表单" />
      <Tabs.TabPane key="create" tab="新增表单" />
      <Tabs.TabPane key="edit" tab="编辑表单" />
      <Tabs.TabPane key="detail" tab="详情表单" />
      <Tabs.TabPane key="list" tab="展示列表" />
    </Tabs>

    <KeepAlive>
      <PageDisplaySettingsTabContent :key="activeKey" :view="activeKey">
        <template #default="{ view }">
          <section
            v-if="view === 'query'"
            class="border-border mb-4 rounded border p-3"
          >
            <Form layout="inline" class="flex flex-wrap gap-x-6 gap-y-2">
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

          <section
            v-if="view === 'list'"
            class="border-border mb-4 rounded border p-3"
          >
            <Form layout="inline" class="flex flex-wrap gap-x-6 gap-y-2">
              <Tooltip
                title="新增前端虚拟列。其值由当前行的值展示脚本计算，不对应后端实体字段。"
              >
                <Button @click="addVirtualHeader">+ 添加虚拟字段</Button>
              </Tooltip>
              <Tooltip title="列表列未单独配置最小列宽时使用。">
                <Form.Item label="默认最小列宽" class="mb-0">
                  <InputNumber
                    v-model:value="draft.list!.defaultMinColumnWidth"
                    :min="40"
                    :precision="0"
                    addon-after="px"
                    class="w-40"
                    placeholder="60"
                  />
                </Form.Item>
              </Tooltip>
              <Tooltip title="列表列未单独配置最大宽度时使用；留空表示不限制。">
                <Form.Item label="默认最大列宽" class="mb-0">
                  <InputNumber
                    v-model:value="draft.list!.defaultMaxColumnWidth"
                    :min="40"
                    :precision="0"
                    addon-after="px"
                    class="w-40"
                    placeholder="不限制"
                  />
                </Form.Item>
              </Tooltip>
              <Tooltip
                title="列表列超出默认最大列宽时的展示方式；字段代码显式策略优先。"
              >
                <Form.Item label="默认超宽展示" class="mb-0">
                  <Radio.Group
                    v-model:value="draft.list!.defaultOverflowStrategy"
                    button-style="solid"
                    option-type="button"
                    :options="[
                      { label: '截断', value: 'ellipsis' },
                      { label: '换行', value: 'wrap' },
                    ]"
                  />
                </Form.Item>
              </Tooltip>
            </Form>
          </section>

          <section
            v-if="['create', 'edit', 'detail'].includes(view)"
            class="border-border mb-4 rounded border p-3"
          >
            <Form layout="inline" class="flex flex-wrap gap-x-6 gap-y-2">
              <Tooltip
                title="留空沿用当前页面配置；支持 960px、80vw 等 CSS 长度。"
              >
                <Form.Item label="弹窗最大宽度" class="mb-0">
                  <Input
                    v-model:value="formHolder(view as FormView).modalMaxWidth"
                    placeholder="例如 80vw 或 960px"
                  />
                </Form.Item>
              </Tooltip>
              <Tooltip
                title="留空沿用当前页面配置；支持 70vh、720px 等 CSS 长度。"
              >
                <Form.Item label="弹窗最大高度" class="mb-0">
                  <Input
                    v-model:value="formHolder(view as FormView).modalMaxHeight"
                    placeholder="例如 70vh 或 720px"
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
              <Form.Item v-if="view === 'detail'" label="展示空值" class="mb-0">
                <Switch
                  v-model:checked="detailHolder().showEmptyValues"
                  aria-label="展示空值"
                  checked-children="展示"
                  un-checked-children="隐藏"
                />
              </Form.Item>
            </Form>
          </section>

          <section
            v-if="view === 'edit'"
            class="border-border mb-4 rounded border p-3"
          >
            <Form layout="inline" class="flex flex-wrap gap-x-6 gap-y-2">
              <Tooltip
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

          <section
            class="bg-muted/25 mb-4 rounded-lg p-3"
            aria-label="实时预览"
          >
            <div class="text-muted-foreground mb-2 text-xs font-medium">
              实时预览
            </div>
            <div
              ref="previewContentRef"
              class="flex flex-wrap items-center gap-2"
              :class="previewExpanded ? '' : 'max-h-[72px] overflow-hidden'"
            >
              <template
                v-for="row in getRowsForView(view)"
                :key="`preview-${row.key}`"
              >
                <span
                  class="rounded border px-2 py-1 text-sm"
                  :class="
                    row.hidden ||
                    (view === 'list' &&
                      (row as CrudPageDisplayHeaderConfig).visible?.mode ===
                        'hidden')
                      ? 'text-muted-foreground border-dashed line-through'
                      : 'bg-background border-border'
                  "
                >
                  {{ previewLabel(row) }}
                </span>
              </template>
            </div>
            <Button
              v-if="previewOverflowing"
              type="link"
              size="small"
              class="mt-2 px-0"
              @click="previewExpanded = !previewExpanded"
            >
              {{ previewExpanded ? '收起预览' : '展开预览' }}
            </Button>
          </section>

          <div
            data-test="page-display-settings-scroll"
            class="min-h-0 flex-1 overflow-auto pr-1"
            @scroll.passive="(event) => loadMoreFieldRows(event, view)"
          >
            <div
              v-if="isGroupableView(view)"
              class="mb-3 flex items-center gap-3"
            >
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
            </div>

            <div
              class="border-border rounded border"
              :class="getFieldConfigMinWidthClass(view)"
            >
              <div
                class="border-border bg-background sticky top-0 z-20 grid gap-3 border-b px-3 py-2 text-sm font-medium shadow-sm"
                :class="getFieldConfigGridClass(view)"
              >
                <template v-if="view === 'list'">
                  <Tooltip title="调整字段在当前展示列表中的前后顺序。"
                    ><span>调整</span></Tooltip
                  >
                  <Tooltip title="当前配置所对应的数据字段。"
                    ><span>字段</span></Tooltip
                  >
                  <Tooltip title="当前列表列的标题别名；留空时沿用字段名称。"
                    ><span>标题别名</span></Tooltip
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
                  <Tooltip
                    title="表头脚本控制列标题是否显示；值展示脚本用于转换每行单元格显示内容。"
                    ><span>展示/值脚本</span></Tooltip
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
                  <Tooltip title="初始化表单时为字段预填的值。"
                    ><span>默认值</span></Tooltip
                  >
                  <Tooltip
                    title="显示脚本、依赖显示项和互斥项均需满足，字段才会展示。"
                    ><span>显示条件</span></Tooltip
                  >
                </template>
              </div>
              <template
                v-for="(rowGroup, groupIndex) in getRowGroupsForView(view)"
                :key="rowGroup.key"
              >
                <div
                  class="w-full"
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
                        >{{ groupIndex + 1 }}.</span
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
                            @click="editGroupVisibilityScript(rowGroup.group)"
                            >展示脚本</Button
                          >
                        </Tooltip>
                        <template v-if="view === 'create' || view === 'edit'">
                          <span class="text-sm">显示提交勾选</span>
                          <Switch
                            :checked="
                              rowGroup.group.showSubmitCheckbox === true
                            "
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
                    v-for="row in getRenderedRows(rowGroup.rows, view)"
                    :key="row.key"
                    draggable="true"
                    class="page-display-settings-field-row border-border grid w-full items-center gap-3 border-b p-3 last:border-b-0"
                    :class="getFieldConfigGridClass(view)"
                    @dragstart="startDrag(row)"
                    @dragover.prevent
                    @drop="dropAt(row)"
                  >
                    <div class="flex gap-1">
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
                    <Input
                      v-if="view === 'list'"
                      v-model:value="(row as CrudPageDisplayHeaderConfig).title"
                      :placeholder="getSourceFieldTitle(row.key)"
                    />
                    <Input
                      v-else
                      v-model:value="row.label"
                      :placeholder="getSourceFieldTitle(row.key)"
                    />
                    <Select
                      v-if="view !== 'list' && isGroupableView(view)"
                      :value="getRowGroupKey(row, view)"
                      :options="groupOptions"
                      placeholder="选择分组"
                      allow-clear
                      class="w-[95px]"
                      @update:value="(value) => assignRowToGroup(row, value)"
                    />
                    <Input
                      v-else-if="view !== 'list'"
                      v-model:value="row.layoutGroup"
                      placeholder="分组 / 换行标识"
                    />
                    <template v-if="view === 'list'">
                      <InputNumber
                        v-model:value="
                          (row as CrudPageDisplayHeaderConfig).width
                        "
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
                            ((
                              row as CrudPageDisplayHeaderConfig
                            ).visible!.mode = value ? 'always' : 'hidden')
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
                        class="min-w-[200px]"
                        @focus="loadRoleVisibilityOptions"
                        @dropdown-visible-change="
                          (open) => open && loadRoleVisibilityOptions()
                        "
                      />
                      <div class="flex gap-2">
                        <Tooltip title="编写脚本决定当前列是否展示。"
                          ><Button
                            size="small"
                            @click="
                              editHeaderScript(
                                row as CrudPageDisplayHeaderConfig,
                              )
                            "
                            >显示脚本</Button
                          ></Tooltip
                        ><Tooltip
                          v-if="
                            !isOperationHeader(
                              row as CrudPageDisplayHeaderConfig,
                            )
                          "
                          title="编写脚本转换当前字段在每一行中的展示内容。"
                          ><Button
                            size="small"
                            @click="
                              editCellScript(row as CrudPageDisplayHeaderConfig)
                            "
                            >值展示脚本</Button
                          ></Tooltip
                        >
                      </div>
                    </template>
                    <template v-else>
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
                        class="min-w-[200px]"
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
                      <InputNumber
                        v-model:value="ensureDefaultValue(row).value"
                        placeholder="默认值"
                        class="w-full"
                      />
                      <div class="flex gap-2">
                        <Tooltip title="编写脚本决定字段是否展示。"
                          ><Button
                            size="small"
                            @click="editVisibilityScript(row)"
                            >显示脚本</Button
                          ></Tooltip
                        ><Select
                          :value="getDependencyKeys(row)"
                          mode="multiple"
                          :options="fieldOptions"
                          placeholder="依赖显示项"
                          class="min-w-[160px]"
                          @update:value="
                            (value) => setDependencyKeys(row, value as string[])
                          "
                        /><Select
                          :value="getExclusiveKeys(row)"
                          mode="multiple"
                          :options="fieldOptions"
                          placeholder="互斥项"
                          class="min-w-[140px]"
                          @update:value="
                            (value) => setExclusiveKeys(row, value as string[])
                          "
                        />
                      </div>
                    </template>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
      </PageDisplaySettingsTabContent>
    </KeepAlive>
    <ScriptWorkbenchDialog
      v-model:open="scriptOpen"
      :model-value="scriptText"
      :title="scriptTitle"
      :variable-groups="scriptGroups"
      @update:model-value="(value) => applyScript?.(value)"
    />
  </Drawer>
</template>

<style scoped>
.page-display-settings-field-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 72px;
}
</style>
