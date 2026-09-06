<script lang="ts" setup>
import type { TableColumnsType, UploadFile } from 'ant-design-vue';

import type { NormalizedCrudAction } from './crud-action-model';
import type {
  CrudExportTemplateConfig,
  CrudExportTemplateContext,
  CrudExportTemplateRecord,
  CrudDynamicText,
  CrudFieldConfig,
  CrudListTableConfig,
  CrudPageConfig,
  CrudPageDisplayConfig,
  CrudPageDisplayFieldConfig,
  CrudPageDisplayHeaderConfig,
  CrudPageDisplayQueryCollapsedRows,
  CrudPathConfig,
  CrudRowAction,
} from './types';

import {
  computed,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  readonly,
  ref,
  render,
  useSlots,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { Page, VCropper } from '@vben/common-ui';
import { ChevronDown, IconifyIcon, Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  AutoComplete,
  Button,
  Cascader,
  Checkbox,
  DatePicker,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Popover,
  QRCode,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Tooltip,
  TreeSelect,
  Upload,
} from 'ant-design-vue';

import {
  buildModuleRequestPath,
  createCrudRecord,
  deleteCrudRecord,
  fetchCrudList,
  fetchOptions,
  updateCrudRecord,
} from '../api';
import {
  FILE_STORAGE_MULTI_UPLOAD_PATH,
  FILE_STORAGE_SINGLE_UPLOAD_PATH,
  uploadFileByFileStorageController,
} from '../app/api/file-storage-service';
import { rbacService } from '../app/api/rbac-service';
import { getCurrentTenantSiteInfo } from '../app/tenant-site-admin-ui-base-setting';
import {
  replaceUiSettingRuntimeCache,
  resolveUiSettingRuntimeWithScope,
  UI_SETTING_RETRIEVE_PATH,
  type UiSettingRuntimeRecord,
} from '../app/api/ui-setting-runtime';
import { useRbacAccess } from '../rbac-access';
import { requestClient } from '../runtime';

import {
  applyAreaCascaderValueToRecord,
  getAreaCascaderValueFromRecord,
} from './area-cascader';
import {
  formatAdministrativeArea,
  filterAdministrativeAreaOptions,
  getAdministrativeAreaCascaderOptions,
  getCurrentOpenAreaCodes,
  hasOpenAreaContext,
  restrictAdministrativeAreaOptionsByLevels,
  resolveAdministrativeAreaSelectableLevels,
} from './administrative-area-data';
import CodeEditorField from './code-editor-field.vue';
import {
  pickCrudActionResultData,
  resolveCrudActionAfterSuccess,
  shouldReloadDataListAfterAction,
} from './crud-action-model';
import { buildCrudConfirmConfig } from './crud-confirm';
import { resolvePageDisplayContextKey } from './crud-page-display';
import CrudExportPanel from './crud-export-panel.vue';
import CrudImportPanel from './crud-import-panel.vue';
import {
  buildCrudExportTemplateTargetTypeVariants,
  CRUD_EXPORT_TEMPLATE_APPLICABLE_TYPES,
  CRUD_EXPORT_TEMPLATE_CATEGORY as EXPORT_TEMPLATE_CATEGORY,
  CRUD_EXPORT_TEMPLATE_FILE_TYPE as EXPORT_TEMPLATE_FILE_TYPE,
  CRUD_EXPORT_TEMPLATE_SAVE_TYPE as EXPORT_TEMPLATE_TYPE,
  CRUD_IMPORT_TEMPLATE_CATEGORY,
  CRUD_IMPORT_TEMPLATE_APPLICABLE_TYPES,
  CRUD_IMPORT_TEMPLATE_SAVE_TYPE as IMPORT_TEMPLATE_TYPE,
} from './crud-export-template';
import {
  buildDefaultImportMappings,
  buildImportRecords,
  chunkImportRecords,
  CRUD_IMPORT_BATCH_SIZE,
  normalizeImportTemplateConfig,
  parseImportFile,
  type CrudImportMapping,
  type ParsedImportSheet,
} from './crud-import';
import { buildExcelXml, downloadExcelXml } from './crud-file-export';
import {
  formatCrudExportValue,
  type CrudExportConverter,
} from './crud-value-converter';
import {
  buildCrudTemplateCode,
  buildCrudTemplateScopeQueryVariants,
  buildCrudTemplateScopePayload,
  canShowCrudTemplateDelete,
  dedupeCrudTemplates,
  getCrudTemplateDeleteParams,
  getCrudTemplateValue,
  isSameCrudTemplate,
  normalizeCreatedCrudTemplate,
  normalizeCrudTemplateConfig,
  normalizeCrudTemplateList,
  removeCrudTemplateFromList,
  type CrudTemplateSaveScope,
} from './crud-template-service';
import {
  buildActionLogTooltipItems,
  hasDisplayableActionLog,
} from './crud-action-log-tooltip';
import {
  getCrudBooleanDisplayText,
  getCrudBooleanTagColor,
  isCrudBooleanField,
  isCrudEnableBooleanField,
} from './crud-boolean-display';
import {
  canMutateCrudRecord as canMutateEditableCrudRecord,
  shouldApplyEditableSearchDefault,
} from './crud-editable-access';
import {
  shouldShowCrudFormField,
  shouldSubmitCrudFormField,
} from './crud-form-field-visibility';
import {
  buildCrudDeleteParams,
  buildCrudRetrieveParams,
  omitNonPlatformTenantId,
} from './crud-retrieve-context';
import { resolveCrudFormGroupCollapse } from './crud-form-group-collapse';
import {
  getContainerColumnCount,
  getFormFieldColumnSpan,
  getFormGridContentMaxWidth,
  getFormModalRecommendedMaxWidth,
  MAX_SEARCH_COLUMN_COUNT,
  MIN_SEARCH_COLUMN_WIDTH,
  resolveFormColumnCount,
  shouldFormFieldSpanFullRow,
  sortFormLayoutFields,
} from './crud-form-layout';
import { getCrudGroupTitleClass } from './crud-group-display';
import {
  buildGroupSubmitConfirmation,
  getUnsubmittedCrudGroupFields,
} from './crud-group-submit';
import {
  filterCrudOperationsByListTable,
  groupCrudOperationsByRecordRef,
} from './crud-operation-placement';
import { shouldShowCrudOperationColumn } from './crud-operation-column-visibility';
import {
  buildApiMethodPermissions,
  buildCrudOperationPermissions,
} from './crud-permissions';
import { resolveCrudQuickFill } from './crud-quick-fill';
import {
  shouldApplyFieldOptionsRequest,
  shouldLoadFieldOptions,
  shouldReloadRemoteOptionsOnDropdownOpen,
} from './crud-select-options';
import { normalizeLeftFixedTableColumns } from './crud-table-columns';
import {
  buildTableColumnPreference,
  getTableColumnPreferenceStorageKey,
  readTableColumnPreference,
} from './crud-table-column-preference';
import {
  findMatchingCrudChoiceOption,
  normalizeCrudChoiceFormValue,
  normalizeCrudChoiceOptions,
  shouldPreserveUnmatchedCrudChoiceValue,
} from './crud-choice-value';
import { evaluateJavaScriptExpression } from './javascript-expression';
import {
  buildOrganizationScriptContext,
  buildTenantScriptContext,
  canUseLocalTableColumnSettings,
  CRUD_OPERATION_COLUMN_KEY,
  DEFAULT_CRUD_OPERATION_COLUMN_WIDTH,
  distributeExtraTableWidth,
  getDefaultFieldHidden,
  isDisplayGroupVisible,
  isRoleVisibilitySatisfied,
  resolveDefaultTableColumnWidth,
  resolveDisplayGroupOrder,
  resolveDisplayStates,
  resolveDisplaySubmitKeys,
  resolvePageDisplayViewTitle,
  resolveRuntimeDisplayField,
  resolveRuntimeDisplayHeader,
  resolvePageDisplaySettingCode,
  resolveQueryCollapsedRows,
  resolveQueryCollapsedFieldCount,
  resolveDisplayGroupExpandedFieldCount,
  shouldAutoQuery,
  shouldAutoForceUpdateField,
  shouldUseSingleTextQueryAutoSearch,
  shouldStartQueryGroupOnNewLine,
  shouldShowManualQueryButton,
  supportsInlineChoiceOptions,
} from './crud-page-display';
import { serializeCrudFieldValue } from './crud-field-value';
import { omitExcludedCrudFields } from './crud-submit-fields';
import { updateCrudFieldInput } from './crud-field-interaction';
import {
  buildCrudComplexGroupInitialState,
  buildCrudComplexGroupPayload,
} from './crud-complex-groups';
import {
  buildCrudCollectionTooltipText,
  buildCrudTooltipText,
  CRUD_TOOLTIP_MOUSE_ENTER_DELAY,
} from './crud-tooltip-preview';
import { evaluateCrudVisibleOn } from './crud-visible-on';
import {
  collectUserRoleIdentityValues,
  isSuperAdminUser,
} from './user-identity';
import CronExpressionField from './cron-expression-field.vue';
import {
  buildDetailDisplayEntries,
  resolveDetailFields,
  type DetailDisplayEntry,
} from './detail-display';
import DetailDisplayPanel from './detail-display-panel.vue';
import {
  DEFAULT_CONTENT_MODAL_BODY_STYLE,
  DEFAULT_CONTENT_MODAL_MAX_HEIGHT,
} from './config-helpers';
import JsonEditorField from './json-editor-field.vue';
import JsonSchemaEditorField from './json-schema-editor-field.vue';
import PageDisplaySettingsDrawer from './page-display-settings-drawer.vue';
import {
  getJsonSchemaSourceInput,
  hasCrudFieldJsonSchema,
  isCrudFieldJsonSchemaInline,
} from './json-schema-source';

import './crud-group-display.css';

const props = defineProps<{
  config: CrudPageConfig;
  /**
   * Render inside a parent page that owns the available height.
   */
  embedded?: boolean;
}>();
const slots = useSlots();

type GenericRecord = Record<string, any>;
type TableSortOrder = 'ascend' | 'descend';
type CrudBuiltinAction = 'create' | 'delete' | 'edit' | 'retrieve';
interface TableColumnSettingsSnapshot {
  hiddenKeys: string[];
}
function getCrudErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const data = (error as any)?.response?.data;
  return data?.msg || data?.detailMsg || data?.message || fallback;
}
type SearchFieldItem =
  | {
      endKey: string;
      format: 'date' | 'datetime' | 'time';
      key: string;
      kind: 'range';
      label: string;
      startKey: string;
    }
  | {
      field: CrudFieldConfig;
      key: string;
      kind: 'field';
    };
interface ListTableRuntimeState {
  dataSource: GenericRecord[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
  };
  searchState: GenericRecord;
  selectedRowKeys: Array<number | string>;
  selectedRows: GenericRecord[];
  sorter: TableSorterState;
}
interface TableSorterState {
  field?: string;
  order?: TableSortOrder;
}

const DEFAULT_CRUD_MODAL_WIDTH = 'min(80vw, 1280px)';
const EXPORT_LIMIT_ERROR_MESSAGE = 'EXPORT_LIMIT_EXCEEDED';
const EXPORT_MAX_RECORDS = 50_000;
const EXPORT_PAGE_SIZE = 2000;
const EXPORT_TEMPLATE_SCOPE_OPTIONS = [
  { label: '个人模板', value: 'personal' },
  { label: '平台共享', value: 'platform' },
  { label: '租户共享', value: 'tenant' },
  { label: '组织共享', value: 'org' },
] as const;
const TABLE_MIN_SCROLL_Y = 160;
const TABLE_SECTION_HORIZONTAL_PADDING = 32;
const TABLE_SECTION_VERTICAL_PADDING = 32;
const TABLE_TOOLBAR_GAP = 12;
const TABLE_HEADER_HEIGHT = 56;
const TABLE_PAGINATION_HEIGHT = 64;
const LIST_TABLE_TABS_INITIAL_LEFT = 20;
const LIST_TABLE_TABS_INITIAL_TOP = 20;
const LIST_TABLE_TABS_DRAG_THRESHOLD = 4;
const LIST_TABLE_TABS_EDGE_PADDING = 8;
const { hasPermission } = useRbacAccess();
const userStore = useUserStore();
const route = useRoute();

type ExportTemplateSaveScope =
  (typeof EXPORT_TEMPLATE_SCOPE_OPTIONS)[number]['value'] &
    CrudTemplateSaveScope;

const dataSource = ref<GenericRecord[]>([]);
const editingRecord = ref<GenericRecord | null>(null);
const loading = ref(false);
const modalOpen = ref(false);
const searchExpanded = ref(false);
const selectedRowKeys = ref<Array<number | string>>([]);
const selectedRows = ref<GenericRecord[]>([]);
const actionResultOpen = ref(false);
const actionResultTitle = ref('');
const actionResultData = ref<any>(null);
const latestDetailRecord = ref<{source: string; record: GenericRecord}>();
const actionResultMode = ref<NormalizedCrudAction>('showSchema');
const exportModalOpen = ref(false);
const exporting = ref(false);
const exportLimitChecking = ref(false);
const exportSelectedFieldKeys = ref<string[]>([]);
const exportFieldOrderKeys = ref<string[]>([]);
const exportFieldAliases = ref<Record<string, string>>({});
const exportFieldConverters = ref<Record<string, CrudExportConverter>>({});
const exportTemplates = ref<CrudExportTemplateRecord[]>([]);
const exportTemplateLoading = ref(false);
const exportTemplateSaving = ref(false);
const selectedExportTemplateId = ref<string | undefined>();
const importModalOpen = ref(false);
const importConsoleOpen = ref(false);
const importing = ref(false);
const importStopRequested = ref(false);
const importTemplateLoading = ref(false);
const importTemplateSaving = ref(false);
const importTemplates = ref<CrudExportTemplateRecord[]>([]);
const selectedImportTemplateId = ref<string | undefined>();
const importSheet = ref<ParsedImportSheet | null>(null);
const importMappings = ref<CrudImportMapping[]>([]);
const importFileName = ref('');
const importConsoleLines = ref<string[]>([]);
const uploadPreviewOpen = ref(false);
const uploadPreviewUrl = ref('');
const optionState = reactive<Record<string, any[]>>({});
const optionLoadingState = reactive<Record<string, boolean>>({});
const areaCascaderRestrictedOptions = reactive<Record<string, any[]>>({});
const optionRequestVersions = reactive<Record<string, number>>({});
const quickSwitchLoadingState = reactive<Record<string, boolean>>({});
const searchState = reactive<GenericRecord>({});
const formState = reactive<GenericRecord>({});
const complexGroupEnabled = reactive<Record<string, boolean>>({});
const groupSubmitChecked = reactive<Record<string, boolean>>({});
const complexGroupCollapsed = reactive<Record<string, boolean>>({});
const pageDisplayGroupExpandedRows = reactive<
  Record<string, 0 | CrudPageDisplayQueryCollapsedRows>
>({});
const submitting = ref(false);
const crudPageRef = ref<HTMLElement | null>(null);
const listTableTabsRef = ref<HTMLElement | null>(null);
const listSectionRef = ref<HTMLElement | null>(null);
const listToolbarRef = ref<HTMLElement | null>(null);
const tableScrollY = ref(360);
const tableAvailableWidth = ref(0);
const tableFullscreen = ref(false);
const activeListTableKey = ref('');
const listTableTabsCollapsed = ref(true);
const isDraggingListTableTabs = ref(false);
const listTableTabsHandleTooltipOpen = ref(false);
const hiddenTableColumnKeys = ref<string[]>([]);
const columnSettingsOpen = ref(false);
const pageDisplaySettingsOpen = ref(false);
const pageDisplaySettingSaving = ref(false);
const pageDisplayConfig = ref<CrudPageDisplayConfig>({ version: 1 });
const pageDisplayHeaderMap = computed(
  () =>
    new Map(
      (pageDisplayConfig.value.list?.headers || []).map((header) => [
        header.key,
        header,
      ]),
    ),
);
const autoSearchReady = ref(false);
const pageDisplaySettingRecord = ref<null | UiSettingRuntimeRecord>(null);
const pageDisplayScope = ref<{
  domain?: string;
  orgCategory?: string;
  orgType?: string;
  tenantId?: string;
  userCategory?: string;
  userType?: string;
}>({
  domain: typeof window === 'undefined' ? undefined : window.location.hostname,
  tenantId: (userStore.userInfo as Record<string, any> | undefined)?.tenantId,
});
const pageDisplayInitialScope = computed(() => {
  const setting = pageDisplaySettingRecord.value;
  return {
    domain: setting?.domain || undefined,
    orgCategory: setting?.orgCategory || undefined,
    orgType: setting?.orgType || undefined,
    tenantId: setting?.tenantId || undefined,
    userCategory: setting?.userCategory || undefined,
    userType: setting?.userType || undefined,
  };
});
const pageDisplayContextKey = computed(() => {
  const userInfo = userStore.userInfo as Record<string, any> | undefined;
  return resolvePageDisplayContextKey(
    userInfo,
    typeof window === 'undefined' ? '' : window.location.hostname,
  );
});

async function loadPageDisplaySettings() {
  try {
    const resolution = await resolveUiSettingRuntimeWithScope(
      pageDisplaySettingCode.value,
      pageDisplayContextKey.value,
    );
    const setting = resolution.setting;
    pageDisplaySettingRecord.value = setting;
    pageDisplayScope.value = { ...pageDisplayScope.value, ...resolution.scope };
    pageDisplayConfig.value = (setting?.valueContent?.pageDisplay as
      | CrudPageDisplayConfig
      | undefined) || { version: 1 };
  } catch (error) {
    console.warn('加载页面展示设置失败，将使用页面默认配置。', error);
  }
}

async function savePageDisplaySettings(payload: {
  config: CrudPageDisplayConfig;
  scope: Record<string, any>;
}) {
  if (pageDisplaySettingSaving.value) return;

  pageDisplaySettingSaving.value = true;
  try {
    const current = pageDisplaySettingRecord.value;
    const data = {
      code: pageDisplaySettingCode.value,
      domain: payload.scope.domain || null,
      name: `${props.config.title}页面展示设置`,
      orgCategory: payload.scope.orgCategory || null,
      orgType: payload.scope.orgType || null,
      userCategory: payload.scope.userCategory || null,
      tenantId: payload.scope.tenantId || null,
      type: 'PageDisplay',
      userType: payload.scope.userType || null,
      valueContent: { pageDisplay: payload.config },
    };
    if (current?.id) {
      const latest = await requestClient.get<UiSettingRuntimeRecord>(
        UI_SETTING_RETRIEVE_PATH,
        {
          params: { id: current.id },
        },
      );
      const optimisticLock =
        latest?.optimisticLock ?? current.optimisticLock ?? 0;
      await requestClient.put('/UiSetting/update', {
        ...data,
        id: current.id,
        optimisticLock,
      });
      pageDisplaySettingRecord.value = {
        ...current,
        ...data,
        optimisticLock: optimisticLock + 1,
      };
    } else {
      const id = await requestClient.post<string>('/UiSetting/create', data);
      pageDisplaySettingRecord.value = { ...data, id };
    }
    pageDisplayConfig.value = payload.config;
    replaceUiSettingRuntimeCache(
      pageDisplaySettingCode.value,
      pageDisplayContextKey.value,
      pageDisplaySettingRecord.value,
    );
    message.success('当前配置已上传');
  } catch (error) {
    console.error('上传当前页面展示配置失败。', error);
    message.error('上传当前配置失败，请稍后重试');
  } finally {
    pageDisplaySettingSaving.value = false;
  }
}
const columnSettingsSnapshot = ref<null | TableColumnSettingsSnapshot>(null);
const draftHiddenTableColumnKeys = ref<string[]>([]);
const hasStoredTableColumnPreference = ref(false);
const hoveredImageUploadTarget = ref<null | {
  field: CrudFieldConfig;
  mode: 'append' | 'replace';
  url?: string;
}>(null);
const uploadPasteTipPosition = reactive({
  x: 0,
  y: 0,
});
const listTableTabsPosition = reactive({
  x: LIST_TABLE_TABS_INITIAL_LEFT,
  y: LIST_TABLE_TABS_INITIAL_TOP,
});
const listTableStates = reactive<Record<string, ListTableRuntimeState>>({});

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});
const tableSorterState = reactive<TableSorterState>({});
const searchPanelRef = ref<HTMLElement | null>(null);
const searchPanelWidth = ref(
  typeof window === 'undefined' ? 1440 : window.innerWidth,
);
const viewportWidth = ref(
  typeof window === 'undefined' ? 1440 : window.innerWidth,
);
const viewportHeight = ref(
  typeof window === 'undefined' ? 900 : window.innerHeight,
);
const recordKey = computed(() => props.config.recordKey || 'id');
const listTables = computed(() => props.config.listTables || []);
const hasListTableTabs = computed(() => listTables.value.length > 1);
const activeListTableStateKey = computed(
  () => activeListTableKey.value || listTables.value[0]?.key || 'default',
);
const activeListTable = computed(() =>
  listTables.value.find((table) => table.key === activeListTableStateKey.value),
);
const activeListPath = computed(
  () =>
    activeListTable.value?.listPath ||
    props.config.listPath ||
    `${props.config.apiBase}/list`,
);
const activeListTableName = computed(() => {
  const tableName =
    activeListTable.value?.tableName || props.config.tableName || 'default';

  return String(tableName || 'default').trim() || 'default';
});
const listTableTabsFloatStyle = computed(() => ({
  left: `${listTableTabsPosition.x}px`,
  top: `${listTableTabsPosition.y}px`,
}));
const listTableTabsPositionStorageKey = computed(() => {
  const routeKey = route.path || route.name || 'crud-page';
  const tableKeys = listTables.value.map((table) => table.key).join(',');

  return [
    'levin',
    'crud-list-tabs-position',
    String(routeKey),
    props.config.apiBase,
    tableKeys,
  ].join(':');
});
const listTableTabsHandleName = computed(() =>
  listTables.value.length > 0
    ? getListTableTitle(listTables.value[0], 0)
    : '列表切换',
);
const listTableTabsHandleActionLabel = computed(() =>
  listTableTabsCollapsed.value
    ? '点击可展开，按住可拖动'
    : '点击可收缩，按住可拖动',
);
const listTableTabsHandleLabel = computed(
  () =>
    `${listTableTabsHandleName.value}：${listTableTabsHandleActionLabel.value}`,
);

let listTableTabsDragState: null | {
  moved: boolean;
  startLeft: number;
  startTop: number;
  startX: number;
  startY: number;
} = null;

const isPlatformUser = computed(() => {
  const userInfo = userStore.userInfo as Record<string, any>;
  let roles: any[] = [];

  if (Array.isArray(userInfo?.roles)) {
    roles = userInfo.roles;
  } else if (Array.isArray(userInfo?.roleList)) {
    roles = userInfo.roleList;
  }

  return (
    userInfo?.platformUser === true ||
    userInfo?.isPlatformUser === true ||
    userInfo?.saasAdmin === true ||
    userInfo?.isSaasAdmin === true ||
    roles.some((role) => String(role || '').startsWith('R_SAAS'))
  );
});

function isFieldVisible(field: CrudFieldConfig) {
  if (field.visibleForPlatformUser) {
    return isPlatformUser.value;
  }

  return true;
}

function isFieldDisabledOnEdit(field: CrudFieldConfig) {
  if (!editingRecord.value) {
    return false;
  }

  if (typeof field.disabledOnEdit === 'function') {
    return field.disabledOnEdit({ userInfo: userStore.userInfo });
  }

  return field.disabledOnEdit === true;
}

function isFormFieldInteractionDisabled(field: CrudFieldConfig) {
  return (
    isFieldDisabledOnEdit(field) ||
    getPageDisplayField(editingRecord.value ? 'edit' : 'create', field.key)
      .disabled === true
  );
}

function isSearchFieldInteractionDisabled(field: Pick<CrudFieldConfig, 'key'>) {
  return getPageDisplayField('query', field.key).disabled === true;
}

function getInteractionModelValue(value: any, disabled: boolean) {
  return disabled && value !== null && typeof value === 'object'
    ? readonly(value)
    : value;
}

function updateFormFieldInput(field: CrudFieldConfig, value: any) {
  updateCrudFieldInput(
    formState,
    field.key,
    value,
    isFormFieldInteractionDisabled(field),
  );
}

function updateSearchFieldInput(field: CrudFieldConfig, value: any) {
  updateCrudFieldInput(
    searchState,
    field.key,
    value,
    isSearchFieldInteractionDisabled(field),
  );
}

function getSearchRangeDisabled(
  item: Extract<SearchFieldItem, { kind: 'range' }>,
): [boolean, boolean] {
  return [
    isSearchFieldInteractionDisabled({ key: item.startKey }),
    isSearchFieldInteractionDisabled({ key: item.endKey }),
  ];
}

function updateSearchRangeInput(
  item: Extract<SearchFieldItem, { kind: 'range' }>,
  value: any,
) {
  const previous = searchState[item.key] || [];
  const next = Array.isArray(value) ? value : [];
  searchState[item.key] = getSearchRangeDisabled(item).map((disabled, index) =>
    disabled ? previous[index] : next[index],
  );
}

function shouldUseJsonSchemaEditor(field: CrudFieldConfig, value?: any) {
  return field.type === 'json' && hasCrudFieldJsonSchema(field, value);
}

function getPageDisplayField(
  view: 'create' | 'detail' | 'edit' | 'query',
  key: string,
): CrudPageDisplayFieldConfig {
  const configured = pageDisplayConfig.value[view]?.fields.find(
    (item) => item.key === key,
  );
  if (configured) {
    return resolveRuntimeDisplayField(configured);
  }

  return resolveRuntimeDisplayField({
    hidden: getDefaultFieldHidden(
      props.config.fields.find((item) => item.key === key) || { key },
    ),
    inputDisplay: 'default',
    key,
    order: props.config.fields.findIndex((item) => item.key === key),
  });
}

function getPageDisplayGroup(
  view: 'create' | 'detail' | 'edit' | 'query',
  key?: string,
) {
  if (!key) return undefined;
  return pageDisplayConfig.value[view]?.groups?.find(
    (item) => item.key === key,
  );
}

function isPageDisplayGroupVisible(
  group: CrudPageDisplayGroupConfig | undefined,
  values: GenericRecord,
) {
  if (!group) return true;
  let expressionResult = true;
  const expression = group.visibility?.expression?.trim();
  if (expression) {
    try {
      expressionResult = Boolean(
        evaluateJavaScriptExpression(expression, {
          form: values,
          org: buildOrganizationScriptContext(
            userStore.userInfo as Record<string, any> | undefined,
          ),
          tenant: getTenantScriptContext(),
          user: userStore.userInfo || {},
        }),
      );
    } catch {
      expressionResult = false;
    }
  }
  return isDisplayGroupVisible(
    group,
    expressionResult,
    collectUserRoleIdentityValues(
      (userStore.userInfo as Record<string, unknown> | undefined) || {},
    ),
  );
}

function getTenantScriptContext() {
  return buildTenantScriptContext(
    getCurrentTenantSiteInfo() as Record<string, any> | undefined,
    userStore.userInfo as Record<string, any> | undefined,
  );
}

function getPageDisplayHeader(
  key: string,
): CrudPageDisplayHeaderConfig | undefined {
  const configured = pageDisplayHeaderMap.value.get(key);
  if (configured) {
    return resolveRuntimeDisplayHeader(configured);
  }

  if (key === CRUD_OPERATION_COLUMN_KEY) {
    return resolveRuntimeDisplayHeader({
      key,
      label: '操作',
      order: Number.MAX_SAFE_INTEGER,
      valueDisplay: { mode: 'default' },
      width: DEFAULT_CRUD_OPERATION_COLUMN_WIDTH,
    });
  }

  const field = props.config.fields.find((item) => item.key === key);
  if (!field) return undefined;

  return resolveRuntimeDisplayHeader({
    key,
    label: field.label,
    order: props.config.fields
      .filter((item) => item.table && isFieldVisible(item))
      .findIndex((item) => item.key === key),
    valueDisplay: { mode: 'default' },
    width: resolveDefaultTableColumnWidth(field),
  });
}

function getPageDisplayInputDisplay(
  view: 'create' | 'edit' | 'query',
  key: string,
) {
  return getPageDisplayField(view, key)?.inputDisplay || 'default';
}

function isPageDisplayRoleVisible(
  view: 'create' | 'detail' | 'edit' | 'query',
  key: string,
) {
  if (view === 'detail') return true;
  const userInfo = userStore.userInfo as Record<string, unknown> | undefined;
  return isRoleVisibilitySatisfied(
    getPageDisplayField(view, key)?.visibleRoleCodes,
    collectUserRoleIdentityValues(userInfo || {}),
  );
}

function shouldUseInlineChoiceOptions(
  field: CrudFieldConfig,
  view: 'create' | 'edit' | 'query',
) {
  return (
    getPageDisplayInputDisplay(view, field.key) === 'inline-options' &&
    supportsInlineChoiceOptions(field)
  );
}

function getInlineChoiceOptions(
  field: CrudFieldConfig,
  view: 'create' | 'edit' | 'query',
) {
  if (isCrudBooleanField(field)) {
    return [
      {
        label: getCrudBooleanDisplayText(field, true) || '是',
        value: view === 'query' ? 'true' : true,
      },
      {
        label: getCrudBooleanDisplayText(field, false) || '否',
        value: view === 'query' ? 'false' : false,
      },
    ];
  }
  return getFieldOptions(field);
}

function isPageDisplayHeaderVisible(key: string) {
  const header = getPageDisplayHeader(key);
  const userInfo = userStore.userInfo as Record<string, unknown> | undefined;
  if (
    !isRoleVisibilitySatisfied(
      header?.visibleRoleCodes,
      collectUserRoleIdentityValues(userInfo || {}),
    )
  )
    return false;
  const visible = header?.visible;
  if (!visible || visible.mode === 'always') return true;
  if (visible.mode === 'hidden') return false;
  try {
    return Boolean(
      evaluateJavaScriptExpression(visible.expression || 'true', {
        org: buildOrganizationScriptContext(
          userStore.userInfo as Record<string, any> | undefined,
        ),
        tenant: getTenantScriptContext(),
        user: userStore.userInfo || {},
      }),
    );
  } catch {
    return false;
  }
}

function resolveStaticLayoutGroupTitle(field: CrudFieldConfig) {
  return field.layoutGroupTitle;
}

function applyPageDisplayFields(
  fields: CrudFieldConfig[],
  view: 'create' | 'detail' | 'edit' | 'query',
  includeHiddenSubmit = false,
): CrudFieldConfig[] {
  const configuredFields = fields.map((field) =>
    getPageDisplayField(view, field.key),
  );
  let values = formState;
  if (view === 'query') values = searchState;
  else if (view === 'detail') values = actionResultData.value ?? {};
  const expressionResults: Record<string, boolean> = {};
  for (const item of configuredFields) {
    if (!item.visibility?.expression?.trim()) {
      expressionResults[item.key] = true;
      continue;
    }
    try {
      expressionResults[item.key] = Boolean(
        evaluateJavaScriptExpression(item.visibility.expression, {
          form: values,
          org: buildOrganizationScriptContext(
            userStore.userInfo as Record<string, any> | undefined,
          ),
          tenant: getTenantScriptContext(),
          user: userStore.userInfo || {},
        }),
      );
    } catch {
      expressionResults[item.key] = false;
    }
  }
  const candidateKeys = new Set(fields.map((field) => field.key));
  const unavailableGroupKeys = new Set(
    (pageDisplayConfig.value[view]?.groups || [])
      .filter((group) => !isPageDisplayGroupVisible(group, values))
      .map((group) => group.key),
  );
  const excludedKeys = new Set([
    ...props.config.fields.filter((field) => !candidateKeys.has(field.key)).map((field) => field.key),
    ...fields.filter((field) => !isPageDisplayRoleVisible(view, field.key)).map((field) => field.key),
    ...fields
      .filter((field) =>
        unavailableGroupKeys.has(getPageDisplayField(view, field.key).layoutGroup || ''),
      )
      .map((field) => field.key),
  ]);
  const displayStates = resolveDisplayStates(configuredFields, expressionResults, excludedKeys);
  const submitKeys = resolveDisplaySubmitKeys(configuredFields, expressionResults, excludedKeys);
  const hasStoredFieldOrder =
    (pageDisplayConfig.value[view]?.fields?.length || 0) > 0;
  const staticFieldOrder = new Map(
    sortFormLayoutFields([...fields]).map((field, index) => [field.key, index]),
  );
  return [...fields]
    .filter((field) => includeHiddenSubmit ? submitKeys.has(field.key) : displayStates[field.key] !== 'HIDDEN')
    .filter((field) => isPageDisplayRoleVisible(view, field.key))
    .sort((left, right) => {
      if (!hasStoredFieldOrder) {
        return (
          (staticFieldOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
          (staticFieldOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER)
        );
      }
      const leftConfigured = getPageDisplayField(view, left.key);
      const rightConfigured = getPageDisplayField(view, right.key);
      const groupOrder =
        resolveDisplayGroupOrder(
          pageDisplayConfig.value[view]?.groups,
          leftConfigured?.layoutGroup,
          pageDisplayConfig.value[view]?.unassignedOrder,
        ) -
        resolveDisplayGroupOrder(
          pageDisplayConfig.value[view]?.groups,
          rightConfigured?.layoutGroup,
          pageDisplayConfig.value[view]?.unassignedOrder,
        );
      if (groupOrder) return groupOrder;
      return (
        (leftConfigured?.order ?? Number.MAX_SAFE_INTEGER) -
        (rightConfigured?.order ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map((field) => {
      const configured = getPageDisplayField(view, field.key);
      const group = getPageDisplayGroup(view, configured?.layoutGroup);
      return {
        ...field,
        label: resolvePageDisplayViewTitle(configured, field.label),
        displayGroup: group,
        layoutGroup: configured?.layoutGroup || field.layoutGroup,
        layoutGroupTitle: group?.title || resolveStaticLayoutGroupTitle(field),
        layoutOrder: configured?.order ?? field.layoutOrder,
      };
    });
}

const submittableSearchFields = computed(() =>
  applyPageDisplayFields(
    props.config.fields
      .map((field, index) => ({ field, index }))
      .filter(({ field }) => field.search && isFieldVisible(field))
      .sort(
        (left, right) =>
          (left.field.searchOrder ?? left.index) -
          (right.field.searchOrder ?? right.index),
      )
      .map(({ field }) => field),
    'query',
    true,
  ),
);

const searchFields = computed(() =>
  submittableSearchFields.value.filter((field) => !getPageDisplayField('query', field.key).hidden),
);

const RANGE_PREFIX_PAIRS: Array<[string, string]> = [
  ['gte', 'lte'],
  ['gt', 'lt'],
  ['start', 'end'],
  ['begin', 'end'],
  ['from', 'to'],
];

function getRangePrefixPair(key: string) {
  return RANGE_PREFIX_PAIRS.find(([startPrefix, endPrefix]) => {
    const prefixes = [startPrefix, endPrefix];
    return prefixes.some((prefix) => key.startsWith(prefix));
  });
}

function isRangeDateField(field: CrudFieldConfig) {
  return (
    (field.type === 'date' ||
      field.type === 'datetime' ||
      field.type === 'time') &&
    !!getRangePrefixPair(field.key)
  );
}

function getRangePartnerKey(key: string) {
  const pair = getRangePrefixPair(key);
  if (!pair) {
    return '';
  }

  const [startPrefix, endPrefix] = pair;
  if (key.startsWith(startPrefix)) {
    return `${endPrefix}${key.slice(startPrefix.length)}`;
  }

  if (key.startsWith(endPrefix)) {
    return `${startPrefix}${key.slice(endPrefix.length)}`;
  }

  return '';
}

function isRangeStartKey(key: string) {
  const pair = getRangePrefixPair(key);
  return !!pair && key.startsWith(pair[0]);
}

function getRangeBaseLabel(label: string) {
  return label
    .replace(/开始$/, '')
    .replace(/结束$/, '')
    .replace(/起始$/, '')
    .replace(/截止$/, '')
    .trim();
}

const searchFieldItems = computed<SearchFieldItem[]>(() => {
  const fieldMap = new Map(
    searchFields.value.map((field) => [field.key, field]),
  );
  const visited = new Set<string>();
  const items: SearchFieldItem[] = [];

  for (const field of searchFields.value) {
    if (visited.has(field.key)) {
      continue;
    }

    if (isRangeDateField(field)) {
      const partnerKey = getRangePartnerKey(field.key);
      const partnerField = fieldMap.get(partnerKey);

      if (
        partnerField &&
        partnerField.type === field.type &&
        isRangeDateField(partnerField)
      ) {
        const startKey = isRangeStartKey(field.key)
          ? field.key
          : partnerField.key;
        const endKey = isRangeStartKey(field.key)
          ? partnerField.key
          : field.key;
        const label = getRangeBaseLabel(field.label || partnerField.label);

        items.push({
          endKey,
          format: field.type as 'date' | 'datetime' | 'time',
          key: `${startKey}__${endKey}`,
          kind: 'range',
          label,
          startKey,
        });

        visited.add(startKey);
        visited.add(endKey);
        continue;
      }
    }

    items.push({
      field,
      key: field.key,
      kind: 'field',
    });
    visited.add(field.key);
  }

  return items;
});

const formFields = computed(() =>
  props.config.fields.filter(
    (field) => field.form !== false && isFieldVisible(field),
  ),
);

const initialFormFields = computed(() =>
  sortFormLayoutFields(
    formFields.value.filter((field) =>
      shouldShowCrudFormField(
        field,
        editingRecord.value ? 'edit' : 'create',
        userStore.userInfo,
      ),
    ),
  ),
);
const activeFormFields = computed(() =>
  applyPageDisplayFields(
    initialFormFields.value,
    editingRecord.value ? 'edit' : 'create',
    true,
  ),
);

const visibleFormFields = computed(() =>
  activeFormFields.value.filter(
    (field) =>
      !getPageDisplayField(editingRecord.value ? 'edit' : 'create', field.key)
        .hidden,
  ),
);
const submittableFormFields = computed(() =>
  activeFormFields.value.filter(
    (field) =>
      shouldSubmitCrudFormField(
        field,
        editingRecord.value ? 'edit' : 'create',
      ) &&
      !isFieldDisabledOnEdit(field) &&
      isComplexGroupEnabled(field) &&
      !unsubmittedGroupKeys.value.has(field.key),
  ),
);

const quickFillRequested = ref(false);
const quickFillMore = ref(false);
const quickFillPlan = computed(() =>
  resolveCrudQuickFill(
    visibleFormFields.value.filter((field) => !unsubmittedGroupKeys.value.has(field.key)),
    new Set(
      visibleFormFields.value
        .filter((field) => !isFormFieldInteractionDisabled(field))
        .map((field) => field.key),
    ),
    new Set(
      (props.config.complexGroups || []).flatMap((group) =>
        Object.keys(group.fieldMappings),
      ),
    ),
  ),
);
const quickFillActive = computed(
  () => quickFillRequested.value && quickFillPlan.value.eligible,
);
const displayedFormFields = computed(() =>
  quickFillActive.value
    ? quickFillPlan.value.orderedFields
    : visibleFormFields.value,
);
watch(quickFillActive, () => {
  quickFillMore.value = false;
});

const unsubmittedGroupFields = computed(() =>
  getUnsubmittedCrudGroupFields(activeFormFields.value, groupSubmitChecked),
);
const unsubmittedGroupKeys = computed(
  () => new Set(unsubmittedGroupFields.value.map((field) => field.key)),
);

function changeGroupSubmitChecked(field: CrudFieldConfig, checked: boolean) {
  const group = field.displayGroup;
  if (!group || submitting.value) return;
  if (checked) {
    groupSubmitChecked[group.key] = true;
    return;
  }
  Modal.confirm(
    buildGroupSubmitConfirmation(group.title || group.key, () => {
      groupSubmitChecked[group.key] = false;
      pageDisplayGroupExpandedRows[group.key] = 0;
    }),
  );
}

function getComplexGroup(key?: string) {
  return props.config.complexGroups?.find((group) => group.key === key);
}

function isComplexGroupFieldVisible(field: CrudFieldConfig) {
  return (
    !field.complexGroupKey || !complexGroupCollapsed[field.complexGroupKey]
  );
}

function isComplexGroupEnabled(field: CrudFieldConfig) {
  return !field.complexGroupKey || complexGroupEnabled[field.complexGroupKey];
}

function isFirstComplexGroupField(field: CrudFieldConfig) {
  if (!field.complexGroupKey) {
    return false;
  }
  return (
    visibleFormFields.value.find(
      (item) => item.complexGroupKey === field.complexGroupKey,
    ) === field
  );
}

function toggleComplexGroup(groupKey: string) {
  complexGroupCollapsed[groupKey] = !complexGroupCollapsed[groupKey];
}

function isPageDisplayGroupFieldVisible(field: CrudFieldConfig) {
  if (field.complexGroupKey) return true;
  const key = field.displayGroup?.key;
  const activeView = editingRecord.value ? 'edit' : 'create';
  const activeConfig = pageDisplayConfig.value[activeView];
  if (!key || !activeConfig) return true;
  const groupFields = visibleFormFields.value.filter(
    (item) => !item.complexGroupKey && item.displayGroup?.key === key,
  );
  const index = groupFields.indexOf(field as (typeof groupFields)[number]);
  const expandedRows = pageDisplayGroupExpandedRows[key] ?? 'all';
  return (
    index >= 0 &&
    index <
      resolveDisplayGroupExpandedFieldCount(
        groupFields.length,
        formColumnCount.value,
        expandedRows,
      )
  );
}

function togglePageDisplayGroup(groupKey: string) {
  pageDisplayGroupExpandedRows[groupKey] =
    pageDisplayGroupExpandedRows[groupKey] === 'all' ? 0 : 'all';
}

function getPageDisplayGroupToggleLabel(groupKey: string) {
  return pageDisplayGroupExpandedRows[groupKey] === 'all' ? '收起' : '展开全部';
}

function shouldShowFormGroupTitle(field: CrudFieldConfig) {
  if (
    field.complexGroupKey ||
    !field.layoutGroup ||
    !field.layoutGroupTitle
  ) {
    return false;
  }
  if (!field.displayGroup) {
    const staticFields = displayedFormFields.value.filter(
      (item) => !item.complexGroupKey,
    );
    const staticGroupFields = staticFields.filter(
      (item) =>
        !item.complexGroupKey && item.layoutGroup === field.layoutGroup,
    );
    if (staticFields.length < 7 || staticGroupFields.length < 3) return false;
  }
  return (
    visibleFormFields.value.findIndex(
      (item) => item.layoutGroup === field.layoutGroup && !item.complexGroupKey,
    ) ===
    visibleFormFields.value.indexOf(
      field as (typeof visibleFormFields.value)[number],
    )
  );
}

function getFormGroupTitleClass(field: CrudFieldConfig) {
  return getCrudGroupTitleClass(field.displayGroup?.displayStyle);
}

const tableFields = computed(() =>
  [...props.config.fields]
    .filter((field) => field.table && isFieldVisible(field))
    .filter((field) => isPageDisplayHeaderVisible(field.key))
    .sort(
      (left, right) =>
        (getPageDisplayHeader(left.key)?.order ?? Number.MAX_SAFE_INTEGER) -
        (getPageDisplayHeader(right.key)?.order ?? Number.MAX_SAFE_INTEGER),
    ),
);

const orderedTableFields = computed(() => tableFields.value);

const visibleTableFields = computed(() =>
  orderedTableFields.value.filter(
    (field) => !hiddenTableColumnKeys.value.includes(String(field.key)),
  ),
);

const effectiveTableColumnFixedMap = computed(() =>
  normalizeLeftFixedTableColumns(
    visibleTableFields.value,
    getDefaultTableColumnFixed,
    getTableFieldKey,
  ),
);

const orderedVisibleTableFields = computed(() => {
  const leftFixedFields: CrudFieldConfig[] = [];
  const normalFields: CrudFieldConfig[] = [];
  const rightFixedFields: CrudFieldConfig[] = [];

  for (const field of visibleTableFields.value) {
    const fixedMode = getEffectiveTableColumnFixed(field);

    if (fixedMode === 'left') {
      leftFixedFields.push(field);
      continue;
    }

    if (fixedMode === 'right') {
      rightFixedFields.push(field);
      continue;
    }

    normalFields.push(field);
  }

  return [...leftFixedFields, ...normalFields, ...rightFixedFields];
});

function isExportableField(field: CrudFieldConfig) {
  return (
    isFieldVisible(field) &&
    field.type !== 'password' &&
    field.export !== false &&
    (field.table || field.export === true)
  );
}

const exportableFields = computed(() => {
  const orderedKeys = new Set<string>();
  const fieldsInCurrentOrder: CrudFieldConfig[] = [];

  for (const field of [
    ...orderedVisibleTableFields.value,
    ...orderedTableFields.value,
  ]) {
    const key = String(field.key);
    if (isExportableField(field) && !orderedKeys.has(key)) {
      orderedKeys.add(key);
      fieldsInCurrentOrder.push(field);
    }
  }

  const remainingFields = props.config.fields.filter(
    (field) => isExportableField(field) && !orderedKeys.has(String(field.key)),
  );

  return [...fieldsInCurrentOrder, ...remainingFields];
});

const orderedExportFields = computed(() => {
  const fieldMap = new Map(
    exportableFields.value.map((field) => [String(field.key), field]),
  );
  const seenKeys = new Set<string>();
  const fields: CrudFieldConfig[] = [];

  for (const key of exportFieldOrderKeys.value.map(String)) {
    const field = fieldMap.get(key);
    if (field && !seenKeys.has(key)) {
      fields.push(field);
      seenKeys.add(key);
    }
  }

  for (const field of exportableFields.value) {
    const key = String(field.key);
    if (!seenKeys.has(key)) {
      fields.push(field);
      seenKeys.add(key);
    }
  }

  return fields;
});

const selectedExportFields = computed(() =>
  orderedExportFields.value.filter((field) =>
    exportSelectedFieldKeys.value.includes(String(field.key)),
  ),
);

const allExportFieldsSelected = computed(
  () =>
    exportableFields.value.length > 0 &&
    exportableFields.value.every((field) =>
      exportSelectedFieldKeys.value.includes(String(field.key)),
    ),
);

const exportFieldsIndeterminate = computed(
  () =>
    !allExportFieldsSelected.value &&
    exportableFields.value.some((field) =>
      exportSelectedFieldKeys.value.includes(String(field.key)),
    ),
);

const exportTemplateContext = computed<CrudExportTemplateContext>(() => {
  const activeIndex = activeListTable.value
    ? Math.max(0, listTables.value.indexOf(activeListTable.value))
    : 0;
  const listTitle = activeListTable.value
    ? getListTableTitle(activeListTable.value, activeIndex)
    : '列表';
  const targetParts = [
    props.config.apiModuleBase,
    props.config.apiBase,
    activeListPath.value,
    activeListTableName.value,
  ].filter(Boolean);

  return {
    apiBase: props.config.apiBase,
    apiModuleBase: props.config.apiModuleBase,
    listPath: activeListPath.value,
    listTableName: activeListTableName.value,
    listTitle,
    targetType: targetParts.join(':'),
    title: props.config.title,
  };
});

const exportTemplateOptions = computed(() =>
  exportTemplates.value
    .map((item) => ({
      label: item.name,
      value: getCrudTemplateValue(item),
    }))
    .filter((item) => item.value !== undefined),
);

const importTemplateOptions = computed(() =>
  importTemplates.value
    .map((item) => ({
      label: item.name,
      value: getCrudTemplateValue(item),
    }))
    .filter((item) => item.value !== undefined),
);

const selectedExportTemplate = computed(() =>
  exportTemplates.value.find(
    (item) => getCrudTemplateValue(item) === selectedExportTemplateId.value,
  ),
);

const selectedImportTemplate = computed(() =>
  importTemplates.value.find(
    (item) => getCrudTemplateValue(item) === selectedImportTemplateId.value,
  ),
);

const selectedExportTemplateCanDelete = computed(() =>
  selectedExportTemplate.value
    ? canShowTemplateDelete(selectedExportTemplate.value)
    : false,
);

const selectedImportTemplateCanDelete = computed(() =>
  selectedImportTemplate.value
    ? canShowTemplateDelete(selectedImportTemplate.value)
    : false,
);

const importableFields = computed(() =>
  props.config.fields.filter(
    (field) =>
      field.key &&
      field.form !== false &&
      field.formCreate !== false &&
      field.allowInput !== false &&
      field.type !== 'image' &&
      field.type !== 'file' &&
      shouldShowCrudFormField(field, 'create', userStore.userInfo),
  ),
);

const importHeaderOptions = computed(() =>
  (importSheet.value?.headers || []).map((header) => ({
    label: header,
    value: header,
  })),
);

const importPreviewResult = computed(() =>
  importSheet.value
    ? buildImportRecords(importSheet.value, importMappings.value)
    : { records: [], rowErrors: [] },
);

const importCanStart = computed(
  () =>
    Boolean(importSheet.value) && importPreviewResult.value.records.length > 0,
);

const importPreviewRows = computed(() =>
  importPreviewResult.value.records.slice(0, 20),
);

const importPreviewColumns = computed<TableColumnsType>(() =>
  importMappings.value
    .filter((mapping) => mapping.header)
    .map((mapping) => {
      const field = importableFields.value.find(
        (item) => String(item.key) === String(mapping.fieldKey),
      );

      return {
        dataIndex: mapping.fieldKey,
        key: mapping.fieldKey,
        title: field?.label || mapping.fieldKey,
        width: 140,
      };
    }),
);

const importTemplateDeletePermission = computed(() => {
  const methodPermissions = buildApiMethodPermissions(
    props.config.exportTemplateService,
    'delete',
  );

  return methodPermissions.length > 0
    ? methodPermissions
    : [
        'com.levin.oak.base:系统数据-导入导出模板::删除',
        '/ImportExportTemplate/delete',
      ];
});

const tableColumnPreferenceStorageKey = computed(() => {
  const routeKey =
    route.path ||
    `${props.config.apiModuleBase || ''}${props.config.apiBase || ''}`;

  return getTableColumnPreferenceStorageKey(
    routeKey,
    activeListTableName.value,
  );
});

const allDraftTableColumnsVisible = computed(
  () =>
    tableFields.value.length > 0 &&
    tableFields.value.every((field) =>
      isDraftTableColumnVisible(String(field.key)),
    ),
);

const draftTableColumnsIndeterminate = computed(
  () =>
    !allDraftTableColumnsVisible.value &&
    tableFields.value.some((field) =>
      isDraftTableColumnVisible(String(field.key)),
    ),
);

const canCustomizeTableColumnsLocally = computed(
  () =>
    !pageDisplaySettingRecord.value &&
    canUseLocalTableColumnSettings(
      pageDisplayConfig.value,
      tableFields.value.length,
      Boolean(pageDisplaySettingRecord.value),
    ),
);

const hasConfiguredRowActions = computed(() =>
  actionGroups.value.row.some(
    (action) =>
      (!action.permission || hasPermission(action.permission)) &&
      evaluateCrudVisibleOn(action.visibleOn, {}, userStore.userInfo),
  ),
);
const hasRowActionSlot = computed(() => Boolean(slots['row-actions']));
const canManagePageDisplaySettings = computed(() =>
  isSuperAdminUser(userStore.userInfo),
);
const pageDisplaySettingCode = computed(() =>
  resolvePageDisplaySettingCode(
    route.path,
    props.config.uiSettingCode || props.config.apiBase,
  ),
);

const hasAvailableOperationColumn = computed(() =>
  shouldShowCrudOperationColumn({
    hasBuiltinDelete: canDelete.value,
    hasBuiltinDetail: canRetrieve.value,
    hasBuiltinEdit: canEdit.value,
    hasRowActionSlot: hasRowActionSlot.value,
    hasRowActions: hasConfiguredRowActions.value,
  }),
);
const showActionColumn = computed(
  () =>
    hasAvailableOperationColumn.value &&
    isPageDisplayHeaderVisible(CRUD_OPERATION_COLUMN_KEY),
);

const tableColumns = computed<TableColumnsType>(() => {
  const defaultMaxColumnWidth = Number(
    pageDisplayConfig.value.list?.defaultMaxColumnWidth,
  );
  const defaultMinColumnWidth = Number(
    pageDisplayConfig.value.list?.defaultMinColumnWidth,
  );
  const minimumWidths = orderedVisibleTableFields.value.map((field) => {
    const header = getPageDisplayHeader(field.key);
    const configuredWidth = header?.width;
    const configuredMinWidth = header?.minWidth;
    return configuredWidth === 'auto' || !configuredWidth
      ? configuredMinWidth ||
          (Number.isFinite(defaultMinColumnWidth) && defaultMinColumnWidth > 0
            ? defaultMinColumnWidth
            : resolveDefaultTableColumnWidth(field))
      : Math.max(configuredWidth, configuredMinWidth || 0);
  });
  const actionHeader = getPageDisplayHeader(CRUD_OPERATION_COLUMN_KEY);
  const actionMaxWidth =
    actionHeader?.maxWidth ||
    (Number.isFinite(defaultMaxColumnWidth) && defaultMaxColumnWidth > 0
      ? defaultMaxColumnWidth
      : Number.POSITIVE_INFINITY);
  const actionConfiguredWidth = actionHeader?.width;
  const actionBaseWidth =
    actionConfiguredWidth === 'auto' || !actionConfiguredWidth
      ? DEFAULT_CRUD_OPERATION_COLUMN_WIDTH
      : actionConfiguredWidth;
  const actionWidth = showActionColumn.value
    ? Math.max(
        actionHeader?.minWidth || 0,
        Math.min(actionBaseWidth, actionMaxWidth),
      )
    : 0;
  const distributedWidths = distributeExtraTableWidth(
    minimumWidths,
    Math.max(tableAvailableWidth.value - actionWidth, 0),
  );
  const columns: TableColumnsType = orderedVisibleTableFields.value.map(
    (field, index) => ({
      align: isNumericField(field) ? 'right' : undefined,
      dataIndex: field.key,
      fixed: getEffectiveTableColumnFixed(field),
      key: field.key,
      sorter: isTableFieldSortable(field),
      sortOrder:
        tableSorterState.field === String(field.key)
          ? tableSorterState.order
          : undefined,
      title: () =>
        h(
          Tooltip,
          { title: field.label },
          {
            default: () =>
              h(
                'span',
                {
                  'aria-label': field.label,
                  class: 'vben-crud-table-header-title',
                  title: field.label,
                },
                getPageDisplayHeader(field.key)?.title || field.label,
              ),
          },
        ),
      width: Math.min(
        distributedWidths[index] ?? resolveDefaultTableColumnWidth(field),
        field.tableMaxWidth ||
          getPageDisplayHeader(field.key)?.maxWidth ||
          (Number.isFinite(defaultMaxColumnWidth) && defaultMaxColumnWidth > 0
            ? defaultMaxColumnWidth
            : Number.POSITIVE_INFINITY),
      ),
    }),
  );

  if (showActionColumn.value) {
    columns.push({
      fixed: 'right',
      key: CRUD_OPERATION_COLUMN_KEY,
      title: actionHeader?.title || '操作',
      width: actionWidth,
    });
  }

  return columns;
});

const tableFieldMap = computed(() =>
  Object.fromEntries(tableFields.value.map((field) => [field.key, field])),
);

const actionGroups = computed(() =>
  groupCrudOperationsByRecordRef(
    filterCrudOperationsByListTable(
      props.config.rowActions || [],
      activeListTableName.value,
    ),
  ),
);

const hasBatchActions = computed(() => actionGroups.value.batch.length > 0);

function getStaticCrudPath(path?: CrudPathConfig) {
  return typeof path === 'string' ? path : undefined;
}

function resolveCrudPath(
  path: CrudPathConfig | undefined,
  fallback: string,
  values: GenericRecord,
  editingRecordValue: GenericRecord | null,
) {
  return typeof path === 'function'
    ? path(values, editingRecordValue)
    : path || fallback;
}

function getCreatePermissionCandidates() {
  const createPath = getStaticCrudPath(props.config.createPath);

  return createPath
    ? [createPath, ...buildCrudOperationPermissions(props.config, 'create')]
    : buildCrudOperationPermissions(props.config, 'create');
}

const rowSelection = computed(() => {
  if (!hasBatchActions.value) {
    return undefined;
  }

  return {
    selectedRowKeys: selectedRowKeys.value,
    onChange: (
      nextSelectedRowKeys: Array<number | string>,
      nextSelectedRows: GenericRecord[],
    ) => {
      selectedRowKeys.value = nextSelectedRowKeys;
      selectedRows.value = nextSelectedRows;
      captureListTableState();
    },
  };
});

const canQuery = computed(() =>
  hasPermission(
    props.config.queryPermission ||
      buildCrudOperationPermissions(props.config, 'list'),
  ),
);

const canCreate = computed(
  () =>
    props.config.allowCreate !== false &&
    canShowActiveBuiltinAction('create') &&
    hasPermission(
      props.config.createPermission || getCreatePermissionCandidates(),
    ),
);

const canImport = computed(() => {
  const apiService = props.config.apiService;

  if (!apiService || typeof apiService.batchCreate !== 'function') {
    return false;
  }

  return hasPermission(buildApiMethodPermissions(apiService, 'batchCreate'));
});

const canRetrieve = computed(
  () =>
    props.config.allowRetrieve !== false &&
    canShowActiveBuiltinAction('retrieve') &&
    hasPermission(
      props.config.detailPermission ||
        (props.config.detailPath
          ? [
              props.config.detailPath,
              ...buildCrudOperationPermissions(props.config, 'retrieve'),
            ]
          : buildCrudOperationPermissions(props.config, 'retrieve')),
    ),
);

const canDelete = computed(
  () =>
    props.config.allowDelete !== false &&
    canShowActiveBuiltinAction('delete') &&
    hasPermission(
      props.config.deletePermission ||
        (props.config.deletePath
          ? [
              props.config.deletePath,
              ...buildCrudOperationPermissions(props.config, 'delete'),
            ]
          : buildCrudOperationPermissions(props.config, 'delete')),
    ),
);

const canEdit = computed(
  () =>
    props.config.allowEdit !== false &&
    canShowActiveBuiltinAction('edit') &&
    hasPermission(
      props.config.editPermission ||
        (props.config.updatePath
          ? [
              props.config.updatePath,
              ...buildCrudOperationPermissions(props.config, 'update'),
            ]
          : buildCrudOperationPermissions(props.config, 'update')),
    ),
);

const autoSearchEnabled = computed(() => {
  const value = pageDisplayConfig.value.query?.autoSearch as unknown;
  return value === true || value === 'true';
});
const singleTextQueryAutoSearchEnabled = computed(() =>
  shouldUseSingleTextQueryAutoSearch(
    searchFields.value,
    autoSearchEnabled.value,
  ),
);
const queryCollapsedRows = computed(() =>
  resolveQueryCollapsedRows(pageDisplayConfig.value),
);

const effectiveSearchCollapsedCount = computed(() => {
  return resolveQueryCollapsedFieldCount(
    searchFieldItems.value.length,
    searchColumnCount.value,
    queryCollapsedRows.value,
  );
});

const showAdvancedSearchToggle = computed(
  () =>
    queryCollapsedRows.value !== 'all' &&
    searchFieldItems.value.length > effectiveSearchCollapsedCount.value,
);

const visibleSearchFieldItems = computed(() => {
  if (searchExpanded.value || !showAdvancedSearchToggle.value) {
    return searchFieldItems.value;
  }

  return searchFieldItems.value.slice(0, effectiveSearchCollapsedCount.value);
});

function isTableFieldSortable(field: CrudFieldConfig) {
  return field.sortable !== false && field.key !== '__tenant';
}

function getModalAvailableWidth() {
  const configuredMaxWidth =
    getConfiguredModalMaxWidthPx(props.config.modalWidth) || 1280;

  return Math.min(viewportWidth.value * 0.8, configuredMaxWidth);
}

const searchColumnCount = computed(() =>
  getContainerColumnCount(
    searchPanelWidth.value,
    MIN_SEARCH_COLUMN_WIDTH,
    MAX_SEARCH_COLUMN_COUNT,
  ),
);

const searchGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${searchColumnCount.value}, minmax(0, 1fr))`,
}));

function getSearchItemStyle(item: SearchFieldItem) {
  if (item.kind !== 'field') return undefined;
  const group = getPageDisplayField('query', item.field.key)?.layoutGroup;
  if (!group) return undefined;
  const index = visibleSearchFieldItems.value.indexOf(item);
  const previous = visibleSearchFieldItems.value[index - 1];
  const previousGroup =
    previous?.kind === 'field'
      ? getPageDisplayField('query', previous.field.key)?.layoutGroup
      : undefined;
  return shouldStartQueryGroupOnNewLine(group, previousGroup)
    ? { gridColumnStart: 1 }
    : undefined;
}

const formColumnCount = computed(() => {
  return resolveFormColumnCount({
    configuredMaxColumns: props.config.formMaxColumns,
    fields: visibleFormFields.value,
    modalAvailableWidth: getModalAvailableWidth(),
    viewportHeight: viewportHeight.value,
    viewportWidth: viewportWidth.value,
  });
});

const formGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${formColumnCount.value}, minmax(0, 1fr))`,
  margin: '0 auto',
  maxWidth: `${getFormGridContentMaxWidth(formColumnCount.value)}px`,
  width: '100%',
}));

const formContainerStyle = computed(() => ({
  maxWidth: '100%',
  width: '100%',
}));

function getFormItemStyle(field: CrudFieldConfig) {
  const columns = formColumnCount.value;
  const span = getFormFieldColumnSpan(field, columns);
  const style: Record<string, number | string> = {};

  if (span > 1) {
    style.gridColumn = field.layoutNewRow
      ? `1 / span ${span}`
      : `span ${span} / span ${span}`;
  } else if (field.layoutNewRow) {
    style.gridColumnStart = 1;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function shouldFormItemSpanFullRow(field: CrudFieldConfig) {
  return shouldFormFieldSpanFullRow(field);
}

function shouldFormItemSpanTwoColumns(field: CrudFieldConfig) {
  return (
    getFormFieldColumnSpan(field, formColumnCount.value) === 2 &&
    !shouldFormFieldSpanFullRow(field)
  );
}

function getConfiguredModalMaxWidthPx(
  configuredWidth: CrudPageConfig['modalWidth'],
) {
  if (typeof configuredWidth === 'number' && Number.isFinite(configuredWidth)) {
    return configuredWidth;
  }

  if (typeof configuredWidth !== 'string') {
    return undefined;
  }

  const widthText = configuredWidth.trim();
  const pixelMatches = [...widthText.matchAll(/(\d+(?:\.\d+)?)px/g)];
  const lastPixelMatch = pixelMatches.at(-1);

  if (!lastPixelMatch) {
    return undefined;
  }

  const width = Number(lastPixelMatch[1]);
  return Number.isFinite(width) ? width : undefined;
}

function isDefaultCrudModalWidth(
  configuredWidth: CrudPageConfig['modalWidth'],
) {
  return (
    configuredWidth === undefined ||
    String(configuredWidth).trim() === DEFAULT_CRUD_MODAL_WIDTH
  );
}

const resolvedModalMaxWidthPx = computed(() => {
  const recommendedWidth = getFormModalRecommendedMaxWidth(
    formColumnCount.value,
  );

  if (isDefaultCrudModalWidth(props.config.modalWidth)) {
    return recommendedWidth;
  }

  const configuredWidth =
    getConfiguredModalMaxWidthPx(props.config.modalWidth) || recommendedWidth;

  return Math.max(configuredWidth, recommendedWidth);
});

const modalMaxWidth = computed(() => {
  return `min(80vw, ${resolvedModalMaxWidthPx.value}px)`;
});

const activeFormModalConfig = computed(
  () => pageDisplayConfig.value[editingRecord.value ? 'edit' : 'create'],
);

const modalStyle = computed(() => ({
  maxHeight:
    activeFormModalConfig.value?.modalMaxHeight ||
    DEFAULT_CONTENT_MODAL_MAX_HEIGHT,
  maxWidth: activeFormModalConfig.value?.modalMaxWidth || modalMaxWidth.value,
}));

const modalWidth = computed(
  () => activeFormModalConfig.value?.modalMaxWidth || modalMaxWidth.value,
);
const modalBodyStyle = DEFAULT_CONTENT_MODAL_BODY_STYLE;

function handleViewportResize() {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
  updateSearchPanelWidth();
  setListTableTabsPosition(listTableTabsPosition.x, listTableTabsPosition.y);
  updateTableScrollY();
}

let listSectionResizeObserver: null | ResizeObserver = null;
let searchPanelResizeObserver: null | ResizeObserver = null;

function updateSearchPanelWidth() {
  searchPanelWidth.value =
    searchPanelRef.value?.clientWidth || viewportWidth.value;
}

function getElementOuterHeight(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return 0;
  }

  const style = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(style.marginTop) || 0;
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;

  return element.getBoundingClientRect().height + marginTop + marginBottom;
}

function updateTableScrollY() {
  nextTick(() => {
    const section = listSectionRef.value;
    if (!section) {
      return;
    }

    const table = section.querySelector('.vben-crud-table');
    tableAvailableWidth.value = Math.max(
      section.clientWidth - TABLE_SECTION_HORIZONTAL_PADDING,
      0,
    );
    const toolbarHeight = listToolbarRef.value?.offsetHeight || 0;
    const toolbarGap = toolbarHeight > 0 ? TABLE_TOOLBAR_GAP : 0;
    const tableHeaderHeight =
      getElementOuterHeight(
        table?.querySelector('.ant-table-header') || null,
      ) ||
      getElementOuterHeight(table?.querySelector('.ant-table-thead') || null) ||
      TABLE_HEADER_HEIGHT;
    const paginationHeight =
      getElementOuterHeight(table?.querySelector('.ant-pagination') || null) ||
      TABLE_PAGINATION_HEIGHT;
    const availableHeight =
      section.clientHeight -
      toolbarHeight -
      toolbarGap -
      TABLE_SECTION_VERTICAL_PADDING -
      tableHeaderHeight -
      paginationHeight;

    tableScrollY.value = Math.max(TABLE_MIN_SCROLL_Y, availableHeight);
  });
}

function renderPaginationTotal(total: number, range: [number, number]) {
  if (total <= 0) {
    return '共 0 条';
  }

  return `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`;
}

function getListTableTitle(
  table: CrudListTableConfig | undefined,
  index: number,
) {
  const title =
    table?.title ||
    table?.name ||
    table?.label ||
    table?.key ||
    `列表${index + 1}`;

  return String(title).trim() || `列表${index + 1}`;
}

function getListTableBuiltinActionFlag(
  table: CrudListTableConfig | undefined,
  action: CrudBuiltinAction,
) {
  if (!table) {
    return undefined;
  }

  if (action === 'create') {
    return table.allowCreate;
  }

  if (action === 'retrieve') {
    return table.allowRetrieve;
  }

  if (action === 'edit') {
    return table.allowEdit;
  }

  return table.allowDelete;
}

function isDefaultListTable(table: CrudListTableConfig | undefined) {
  return (
    !table ||
    table.key === 'default' ||
    table.key === 'list' ||
    (table.tableName || 'default') === 'default'
  );
}

function canShowActiveBuiltinAction(action: CrudBuiltinAction) {
  if (!hasListTableTabs.value) {
    return true;
  }

  const configured = getListTableBuiltinActionFlag(
    activeListTable.value,
    action,
  );

  if (configured !== undefined) {
    return configured;
  }

  return isDefaultListTable(activeListTable.value);
}

function clampListTableTabsPosition(x: number, y: number) {
  const page = crudPageRef.value;
  const tabs = listTableTabsRef.value;

  if (!page || !tabs) {
    return {
      x: Math.max(LIST_TABLE_TABS_EDGE_PADDING, x),
      y: Math.max(LIST_TABLE_TABS_EDGE_PADDING, y),
    };
  }

  const pageRect = page.getBoundingClientRect();
  const tabsRect = tabs.getBoundingClientRect();
  const maxX = Math.max(
    LIST_TABLE_TABS_EDGE_PADDING,
    pageRect.width - tabsRect.width - LIST_TABLE_TABS_EDGE_PADDING,
  );
  const maxY = Math.max(
    LIST_TABLE_TABS_EDGE_PADDING,
    pageRect.height - tabsRect.height - LIST_TABLE_TABS_EDGE_PADDING,
  );

  return {
    x: Math.min(Math.max(LIST_TABLE_TABS_EDGE_PADDING, x), maxX),
    y: Math.min(Math.max(LIST_TABLE_TABS_EDGE_PADDING, y), maxY),
  };
}

function setListTableTabsPosition(x: number, y: number) {
  const nextPosition = clampListTableTabsPosition(x, y);

  listTableTabsPosition.x = nextPosition.x;
  listTableTabsPosition.y = nextPosition.y;
}

function getStoredListTableTabsPosition() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const parsed = JSON.parse(
      localStorage.getItem(listTableTabsPositionStorageKey.value) || '',
    );

    if (
      parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number'
    ) {
      return parsed as { x: number; y: number };
    }
  } catch {
    return null;
  }

  return null;
}

function saveListTableTabsPosition() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(
    listTableTabsPositionStorageKey.value,
    JSON.stringify({
      x: listTableTabsPosition.x,
      y: listTableTabsPosition.y,
    }),
  );
}

function restoreListTableTabsPosition() {
  const storedPosition = getStoredListTableTabsPosition();

  if (!storedPosition) {
    setListTableTabsPosition(
      LIST_TABLE_TABS_INITIAL_LEFT,
      LIST_TABLE_TABS_INITIAL_TOP,
    );
    return;
  }

  setListTableTabsPosition(storedPosition.x, storedPosition.y);
}

function handleListTableTabsPointerMove(event: PointerEvent) {
  if (!listTableTabsDragState) {
    return;
  }

  const deltaX = event.clientX - listTableTabsDragState.startX;
  const deltaY = event.clientY - listTableTabsDragState.startY;

  if (
    !listTableTabsDragState.moved &&
    Math.hypot(deltaX, deltaY) < LIST_TABLE_TABS_DRAG_THRESHOLD
  ) {
    return;
  }

  listTableTabsDragState.moved = true;
  isDraggingListTableTabs.value = true;
  setListTableTabsPosition(
    listTableTabsDragState.startLeft + deltaX,
    listTableTabsDragState.startTop + deltaY,
  );
  event.preventDefault();
}

function stopListTableTabsDrag() {
  window.removeEventListener('pointermove', handleListTableTabsPointerMove);
  window.removeEventListener('pointerup', handleListTableTabsPointerUp);
  window.removeEventListener('pointercancel', handleListTableTabsPointerUp);
}

function handleListTableTabsPointerUp() {
  const shouldToggleCollapsed = !listTableTabsDragState?.moved;

  listTableTabsDragState = null;
  isDraggingListTableTabs.value = false;
  stopListTableTabsDrag();
  saveListTableTabsPosition();

  if (shouldToggleCollapsed) {
    toggleListTableTabsCollapsed();
  }
}

function handleListTableTabsPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  listTableTabsDragState = {
    moved: false,
    startLeft: listTableTabsPosition.x,
    startTop: listTableTabsPosition.y,
    startX: event.clientX,
    startY: event.clientY,
  };
  listTableTabsHandleTooltipOpen.value = false;
  window.addEventListener('pointermove', handleListTableTabsPointerMove);
  window.addEventListener('pointerup', handleListTableTabsPointerUp);
  window.addEventListener('pointercancel', handleListTableTabsPointerUp);
  event.preventDefault();
}

function toggleListTableTabsCollapsed() {
  listTableTabsCollapsed.value = !listTableTabsCollapsed.value;
  nextTick(() => {
    setListTableTabsPosition(listTableTabsPosition.x, listTableTabsPosition.y);
  });
}

function handleListTableTabsTooltipOpenChange(open: boolean) {
  listTableTabsHandleTooltipOpen.value =
    listTableTabsDragState || isDraggingListTableTabs.value ? false : open;
}

function getInitialListTablePageSize() {
  const pageSize = Number(props.config.defaultQuery?.pageSize || 10);

  return Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10;
}

function ensureListTableState(key = activeListTableStateKey.value) {
  const normalizedKey = key || 'default';

  if (!listTableStates[normalizedKey]) {
    listTableStates[normalizedKey] = {
      dataSource: [],
      pagination: {
        current: 1,
        pageSize: getInitialListTablePageSize(),
        total: 0,
      },
      searchState: {},
      selectedRowKeys: [],
      selectedRows: [],
      sorter: {},
    };
  }

  return listTableStates[normalizedKey]!;
}

function captureListTableState(key = activeListTableStateKey.value) {
  const state = ensureListTableState(key);

  state.dataSource = [...dataSource.value];
  state.pagination = {
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: pagination.total,
  };
  state.searchState = { ...searchState };
  state.selectedRowKeys = [...selectedRowKeys.value];
  state.selectedRows = [...selectedRows.value];
  state.sorter = { ...tableSorterState };
}

function restoreListTableState(key = activeListTableStateKey.value) {
  const state = ensureListTableState(key);

  dataSource.value = [...state.dataSource];
  pagination.current = state.pagination.current;
  pagination.pageSize = state.pagination.pageSize;
  pagination.total = state.pagination.total;
  copyReactiveRecord(searchState, state.searchState);
  selectedRowKeys.value = [...state.selectedRowKeys];
  selectedRows.value = [...state.selectedRows];
  copyReactiveRecord<any>(tableSorterState, state.sorter || {});
}

function getBusinessTitle(title: string) {
  return (
    String(title || '')
      .replace(/管理$/, '')
      .trim() || String(title || '')
  );
}

function getDefaultValue(field: CrudFieldConfig) {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  if (field.type === 'switch') {
    return false;
  }

  if (
    field.type === 'area-cascader' ||
    field.multiple ||
    field.type === 'string-array' ||
    field.type === 'tags'
  ) {
    return [];
  }

  return undefined;
}

function getDefaultOptionsLoader(field: CrudFieldConfig) {
  if (field.type === 'org-tree-select') {
    return () =>
      rbacService.fetchAuthorizedOrgOptions({
        assembleTree: true,
      });
  }

  if (field.type === 'role-select') {
    return (keyword?: string) => {
      const params: Record<string, any> = {
        codeForKey: false,
        pageIndex: 1,
        pageSize: 500,
      };
      const normalizedKeyword = String(keyword || '').trim();

      if (normalizedKeyword) {
        params.containsName = normalizedKeyword;
      }

      return fetchOptions(
        '/Role/listUserRoleCode',
        'label',
        'value',
        params,
        props.config.apiModuleBase,
      );
    };
  }
}

function buildEmptyState() {
  const result: GenericRecord = {
    ...props.config.defaultFormValues,
  };

  for (const field of initialFormFields.value) {
    const configuredDefault = getPageDisplayField(
      editingRecord.value ? 'edit' : 'create',
      field.key,
    )?.defaultValue;
    result[field.key] =
      configuredDefault && 'value' in configuredDefault
        ? normalizeFormValue(field, configuredDefault.value)
        : field.key in result
          ? normalizeFormValue(field, result[field.key])
          : getDefaultValue(field);
  }

  return result;
}

function normalizeFormValue(field: CrudFieldConfig, value: any) {
  if (value === null || value === undefined) {
    return getDefaultValue(field);
  }

  if (field.type === 'area-cascader') {
    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
    return getAreaCascaderValueFromRecord(
      { ...field, areaCascader: { ...field.areaCascader, valueKey: field.key } },
      { [field.key]: value },
    );
  }

  if (field.type === 'json') {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return getDefaultValue(field);
    }

    try {
      return JSON.parse(trimmedValue);
    } catch {
      return value;
    }
  }

  if (field.type === 'tags') {
    return Array.isArray(value) ? value : getTagValues(value);
  }

  if (field.type === 'string-array') {
    return Array.isArray(value) ? value.join('\n') : value;
  }

  return normalizeCrudChoiceFormValue(field, value, getFieldOptions(field));
}

function serializeFormValue(
  field: CrudFieldConfig,
  value: any,
  preserveEmptyValue = false,
) {
  if (field.type === 'json') {
    if (value === null || value === undefined || value === '') {
      return preserveEmptyValue ? null : undefined;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return preserveEmptyValue ? null : undefined;
    }

    try {
      return JSON.parse(trimmedValue);
    } catch {
      throw new TypeError(`${field.label}不是有效的 JSON`);
    }
  }

  if (field.type === 'string-array' || field.type === 'tags') {
    if (Array.isArray(value)) {
      return value;
    }

    if (!value || !String(value).trim()) {
      return [];
    }

    return String(value)
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value === null || value === undefined) {
    return preserveEmptyValue ? null : undefined;
  }

  if (value === '' && preserveEmptyValue) {
    return '';
  }

  return serializeCrudFieldValue(field, value);
}

function isChoiceFormField(field: CrudFieldConfig) {
  return (
    field.type === 'area-cascader' ||
    field.type === 'org-tree-select' ||
    field.type === 'role-select' ||
    field.type === 'select' ||
    field.type === 'tags' ||
    field.type === 'tenant'
  );
}

function isEmptyChoiceValue(value: any) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function shouldOmitEmptyChoiceFormField(field: CrudFieldConfig, value: any) {
  return isChoiceFormField(field) && isEmptyChoiceValue(value);
}

function buildSearchParams() {
  const params: GenericRecord = { ...props.config.defaultQuery };
  const hiddenItems: SearchFieldItem[] = submittableSearchFields.value
    .filter((field) => getPageDisplayField('query', field.key).hidden)
    .map((field) => ({ key: field.key, kind: 'field', field }));

  for (const item of [...searchFieldItems.value, ...hiddenItems]) {
    if (item.kind === 'range') {
      const value = searchState[item.key];
      const [startValue, endValue] = Array.isArray(value) ? value : [];

      if (startValue) {
        params[item.startKey] = startValue;
      }

      if (endValue) {
        params[item.endKey] = endValue;
      }

      continue;
    }

    const { field } = item;
    if (field.type === 'area-cascader') {
      const value = searchState[field.key];
      if (Array.isArray(value) && value.length > 0) {
        applyAreaCascaderValueToRecord(
          params,
          field,
          value,
          getFieldOptions(field),
        );
      }
      continue;
    }

    const value =
      field.type === 'string-array' || field.type === 'tags'
        ? serializeFormValue(field, searchState[field.key])
        : serializeCrudFieldValue(field, searchState[field.key]);
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      continue;
    }

    params[field.key] = value;
  }

  const eligible = new Set(
    submittableSearchFields.value.map((field) => field.key),
  );
  return omitExcludedCrudFields(
    params,
    props.config.fields.filter(
      (field) => field.search && !eligible.has(field.key),
    ),
  );
}

const formFieldsContainer = ref<HTMLElement>();

async function revealInvalidFormField(field: CrudFieldConfig) {
  if (!visibleFormFields.value.some((item) => item.key === field.key) || isFormFieldInteractionDisabled(field)) return;
  if (quickFillActive.value) {
    quickFillMore.value = true;
  } else {
    if (field.displayGroup?.key)
      pageDisplayGroupExpandedRows[field.displayGroup.key] = 'all';
    if (field.complexGroupKey)
      complexGroupCollapsed[field.complexGroupKey] = false;
  }
  await nextTick();
  const element = [
    ...(formFieldsContainer.value?.querySelectorAll<HTMLElement>(
      '[data-crud-form-field]',
    ) || []),
  ].find((item) => item.dataset.crudFormField === field.key);
  element?.scrollIntoView({ block: 'nearest' });
  element
    ?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex="0"]',
    )
    ?.focus({ preventScroll: true });
}

function initializeFormGroupCollapse() {
  const state = resolveCrudFormGroupCollapse(
    visibleFormFields.value,
    complexGroupEnabled,
    { rows: pageDisplayGroupExpandedRows, collapsed: complexGroupCollapsed },
  );
  Object.assign(pageDisplayGroupExpandedRows, state.rows);
  Object.assign(complexGroupCollapsed, state.collapsed);
}

function getFormValidationMessage(field: CrudFieldConfig, reason: string) {
  if (!visibleFormFields.value.some((item) => item.key === field.key))
    return `隐藏提交字段“${getFormFieldLabel(field)}”：${reason}，请检查默认值或字段设置`;
  if (isFormFieldInteractionDisabled(field))
    return `禁提字段“${getFormFieldLabel(field)}”不可直接修改：${reason}，请检查默认值或字段设置`;
  return reason;
}

function serializeSubmittableFormValue(
  field: CrudFieldConfig,
  value: any,
  preserveEmptyValue: boolean,
) {
  try {
    return serializeFormValue(field, value, preserveEmptyValue);
  } catch (error) {
    throw new TypeError(
      getFormValidationMessage(
        field,
        getCrudErrorMessage(error, '字段格式不正确'),
      ),
    );
  }
}

function validateFormFields() {
  for (const field of submittableFormFields.value) {
    if (
      !isComplexGroupEnabled(field) ||
      unsubmittedGroupKeys.value.has(field.key)
    ) {
      continue;
    }

    const maxUploadCount = getUploadMaxCount(field);
    if (
      isFileUploadField(field) &&
      maxUploadCount !== undefined &&
      getUploadUrls(field).length > maxUploadCount
    ) {
      void revealInvalidFormField(field);
      message.warning(
        getFormValidationMessage(
          field,
          `${getFormFieldLabel(field)}最多上传${maxUploadCount}个文件`,
        ),
      );
      return false;
    }

    const validationMessage = field.validator?.(
      formState[field.key],
      formState,
    );
    if (validationMessage) {
      void revealInvalidFormField(field);
      message.warning(getFormValidationMessage(field, validationMessage));
      return false;
    }

    if (!field.required) {
      continue;
    }

    const value = formState[field.key];
    const isEmptyArray = Array.isArray(value) && value.length === 0;
    const isEmptyScalar =
      value === null || value === undefined || String(value).trim() === '';

    if (isEmptyArray || isEmptyScalar) {
      void revealInvalidFormField(field);
      message.warning(
        getFormValidationMessage(field, `请填写${getFormFieldLabel(field)}`),
      );
      return false;
    }
  }

  return true;
}

function initializeComplexFormValues(
  flatValues: GenericRecord,
  editing: boolean,
) {
  for (const field of initialFormFields.value) {
    if (!field.complexGroupKey) continue;
    const originalValue = flatValues[field.key];
    const configuredDefault = getPageDisplayField(
      editing ? 'edit' : 'create',
      field.key,
    ).defaultValue;
    const value =
      originalValue === undefined ||
      originalValue === null ||
      originalValue === ''
        ? configuredDefault && 'value' in configuredDefault
          ? configuredDefault.value
          : formState[field.key]
        : originalValue;
    formState[field.key] = normalizeFormValue(field, value);
  }
}

function resetForm(record?: GenericRecord) {
  quickFillRequested.value =
    pageDisplayConfig.value[record ? 'edit' : 'create']?.quickFill === true;
  quickFillMore.value = false;
  for (const key of Object.keys(groupSubmitChecked))
    delete groupSubmitChecked[key];
  const nextState = buildEmptyState();

  for (const key of Object.keys(formState)) {
    delete formState[key];
  }

  for (const [key, value] of Object.entries(nextState)) {
    formState[key] = value;
  }

  for (const key of Object.keys(pageDisplayGroupExpandedRows)) {
    delete pageDisplayGroupExpandedRows[key];
  }
  for (const group of pageDisplayConfig.value[record ? 'edit' : 'create']
    ?.groups || []) {
    pageDisplayGroupExpandedRows[group.key] =
      group.defaultExpandedRows ??
      (group.defaultExpanded === false ? 1 : 'all');
  }
  if (!record) {
    const groupState = buildCrudComplexGroupInitialState(
      props.config.complexGroups,
    );
    Object.assign(complexGroupEnabled, groupState.enabled);
    Object.assign(complexGroupCollapsed, groupState.collapsed);
    initializeComplexFormValues(groupState.flatValues, false);
    initializeFormGroupCollapse();
    return;
  }

  const groupState = buildCrudComplexGroupInitialState(
    props.config.complexGroups,
    record,
  );
  Object.assign(complexGroupEnabled, groupState.enabled);
  Object.assign(complexGroupCollapsed, groupState.collapsed);
  initializeComplexFormValues(groupState.flatValues, true);

  for (const field of initialFormFields.value) {
    if (field.complexGroupKey) {
      continue;
    }

    if (field.type === 'area-cascader') {
      const originalPath = getAreaCascaderValueFromRecord(field, record);
      if (originalPath.length > 0) formState[field.key] = originalPath;
      continue;
    }

    const originalValue = getRecordValue(record, field.key);
    const configuredDefault = getPageDisplayField(
      'edit',
      field.key,
    )?.defaultValue;
    formState[field.key] = normalizeFormValue(
      field,
      (originalValue === null ||
        originalValue === undefined ||
        originalValue === '') &&
        configuredDefault &&
        'value' in configuredDefault
        ? configuredDefault.value
        : originalValue,
    );
  }
  initializeFormGroupCollapse();
}

async function loadFieldOptions(field: CrudFieldConfig, keyword = '') {
  const loader = field.loadOptions || getDefaultOptionsLoader(field);

  if (!loader) {
    return;
  }

  const requestVersion = (optionRequestVersions[field.key] || 0) + 1;
  optionRequestVersions[field.key] = requestVersion;
  optionLoadingState[field.key] = true;

  try {
    const options = await loader(keyword);

    if (
      shouldApplyFieldOptionsRequest(
        requestVersion,
        optionRequestVersions[field.key],
      )
    ) {
      optionState[field.key] = normalizeCrudChoiceOptions(field, options);
    }
  } catch (error) {
    console.error(error);
    message.warning(`${field.label}选项加载失败`);
  } finally {
    if (
      shouldApplyFieldOptionsRequest(
        requestVersion,
        optionRequestVersions[field.key],
      )
    ) {
      optionLoadingState[field.key] = false;
    }
  }
}

async function loadOptions() {
  await Promise.all(
    props.config.fields
      .filter((field) =>
        shouldLoadFieldOptions(
          Boolean(field.loadOptions || getDefaultOptionsLoader(field)),
          isFieldVisible(field),
        ),
      )
      .map((field) => loadFieldOptions(field)),
  );
}

function buildSortParams() {
  if (!tableSorterState.field || !tableSorterState.order) {
    return {};
  }

  return {
    orderBy: tableSorterState.field,
    orderDir: tableSorterState.order === 'ascend' ? 'Asc' : 'Desc',
  };
}

function getDefaultExportFieldOrder() {
  return exportableFields.value.map((field) => String(field.key));
}

function getDefaultSelectedExportFieldKeys() {
  return orderedVisibleTableFields.value
    .filter(isExportableField)
    .map((field) => String(field.key));
}

function getDefaultExportFieldAliases() {
  return {};
}

function getDefaultExportFieldConverters() {
  return {};
}

function findExportTemplate(target: CrudExportTemplateRecord) {
  return exportTemplates.value.find((item) => isSameCrudTemplate(item, target));
}

function upsertExportTemplate(template: CrudExportTemplateRecord) {
  const existingIndex = exportTemplates.value.findIndex((item) =>
    isSameCrudTemplate(item, template),
  );

  if (existingIndex >= 0) {
    exportTemplates.value.splice(existingIndex, 1, {
      ...exportTemplates.value[existingIndex],
      ...template,
    });
    return;
  }

  exportTemplates.value = [template, ...exportTemplates.value];
}

function getExportTemplateNameSeed() {
  const context = exportTemplateContext.value;

  return `${context.title}${context.listTitle}导出模板`;
}

function buildExportTemplateConfig(): CrudExportTemplateConfig {
  const selectedKeys = exportSelectedFieldKeys.value.map(String);
  const aliasEntries = Object.entries(exportFieldAliases.value)
    .map(([key, value]) => [key, String(value || '').trim()] as const)
    .filter(([, value]) => value);
  const fieldAliases = Object.fromEntries(aliasEntries);
  const fieldConverters = exportFieldConverters.value;
  const orderedFields = orderedExportFields.value;

  return {
    fieldAliases,
    fieldOrderKeys: orderedFields.map((field) => String(field.key)),
    fields: orderedFields.map((field, index) => {
      const key = String(field.key);

      return {
        alias: fieldAliases[key] || '',
        converter: fieldConverters[key],
        key,
        label: field.label,
        order: index,
        selected: selectedKeys.includes(key),
      };
    }),
    selectedFieldKeys: selectedKeys,
    version: 2,
  };
}

function applyExportTemplateConfig(config: CrudExportTemplateConfig) {
  const availableKeys = new Set(
    exportableFields.value.map((field) => String(field.key)),
  );
  const templateFields = Array.isArray(config.fields) ? config.fields : [];
  const orderedFieldKeys = [...templateFields]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((field) => String(field.key));
  const orderKeys = (
    Array.isArray(config.fieldOrderKeys)
      ? config.fieldOrderKeys
      : orderedFieldKeys
  )
    .map(String)
    .filter((key) => availableKeys.has(key));
  const selectedKeys = (
    Array.isArray(config.selectedFieldKeys)
      ? config.selectedFieldKeys
      : templateFields
          .filter((field) => field.selected !== false)
          .map((field) => field.key)
  )
    .map(String)
    .filter((key) => availableKeys.has(key));
  const fieldAliases = templateFields.reduce<Record<string, string>>(
    (aliases, field) => {
      const key = String(field.key);
      const alias = String(field.alias || '').trim();

      if (availableKeys.has(key) && alias) {
        aliases[key] = alias;
      }

      return aliases;
    },
    {},
  );
  const aliases = {
    ...fieldAliases,
    ...(config.fieldAliases || {}),
  };
  const converters = templateFields.reduce<Record<string, CrudExportConverter>>(
    (result, field) => {
      const key = String(field.key);

      if (availableKeys.has(key) && field.converter) {
        result[key] = field.converter;
      }

      return result;
    },
    {},
  );

  exportFieldOrderKeys.value = orderKeys.length
    ? orderKeys
    : getDefaultExportFieldOrder();
  exportSelectedFieldKeys.value = selectedKeys;
  exportFieldAliases.value = Object.fromEntries(
    Object.entries(aliases)
      .map(([key, value]) => [key, String(value || '').trim()] as const)
      .filter(([key, value]) => availableKeys.has(key) && value),
  );
  exportFieldConverters.value = converters;
}

async function loadExportTemplates() {
  const list = props.config.exportTemplateService?.list;

  if (!list) {
    exportTemplates.value = [];
    return;
  }

  exportTemplateLoading.value = true;

  try {
    const context = exportTemplateContext.value;
    const targetTypes = buildCrudExportTemplateTargetTypeVariants(context);
    const resultList = await Promise.all(
      targetTypes.flatMap((targetType) =>
        buildCrudTemplateScopeQueryVariants({
          category: EXPORT_TEMPLATE_CATEGORY,
          enable: true,
          fileType: EXPORT_TEMPLATE_FILE_TYPE,
          inType: [...CRUD_EXPORT_TEMPLATE_APPLICABLE_TYPES],
          orderBy: 'lastUpdateTime',
          orderDir: 'Desc',
          pageIndex: 1,
          pageSize: 200,
          targetType,
        }).map((params) => list(params, context)),
      ),
    );

    exportTemplates.value = dedupeCrudTemplates(
      resultList.flatMap((result) => normalizeCrudTemplateList(result)),
    );
  } catch (error) {
    console.error(error);
    message.warning('导出模板加载失败');
  } finally {
    exportTemplateLoading.value = false;
  }
}

async function loadImportTemplates() {
  const list = props.config.exportTemplateService?.list;

  if (!list) {
    importTemplates.value = [];
    return;
  }

  importTemplateLoading.value = true;

  try {
    const context = exportTemplateContext.value;
    const targetTypes = buildCrudExportTemplateTargetTypeVariants(context);
    const resultList = await Promise.all(
      targetTypes.flatMap((targetType) =>
        buildCrudTemplateScopeQueryVariants({
          category: CRUD_IMPORT_TEMPLATE_CATEGORY,
          enable: true,
          fileType: EXPORT_TEMPLATE_FILE_TYPE,
          inType: [...CRUD_IMPORT_TEMPLATE_APPLICABLE_TYPES],
          orderBy: 'lastUpdateTime',
          orderDir: 'Desc',
          pageIndex: 1,
          pageSize: 200,
          targetType,
        }).map((params) => list(params, context)),
      ),
    );

    importTemplates.value = dedupeCrudTemplates(
      resultList.flatMap((result) => normalizeCrudTemplateList(result)),
    );
  } catch (error) {
    console.error(error);
    message.warning('导入模板加载失败');
  } finally {
    importTemplateLoading.value = false;
  }
}

function handleExportTemplateChange(value?: number | string) {
  selectedExportTemplateId.value =
    value === undefined || value === null ? undefined : String(value);

  if (!selectedExportTemplateId.value) {
    return;
  }

  const template = exportTemplates.value.find(
    (item) => getCrudTemplateValue(item) === selectedExportTemplateId.value,
  );

  if (!template) {
    return;
  }

  applyExportTemplateConfig(normalizeCrudTemplateConfig(template.config));
  message.success(`已应用导出模板：${template.name}`);
}

function canShowTemplateDelete(template: CrudExportTemplateRecord) {
  const deleteAction = props.config.exportTemplateService?.delete;
  const deleteParams = getCrudTemplateDeleteParams(template);

  return Boolean(
    deleteAction &&
    deleteParams &&
    canShowCrudTemplateDelete({
      hasDeletePermission: hasPermission(importTemplateDeletePermission.value),
      template,
      userInfo: userStore.userInfo as Record<string, any> | undefined,
    }),
  );
}

async function deleteTemplate(
  template: CrudExportTemplateRecord,
  kind: 'export' | 'import',
) {
  const deleteAction = props.config.exportTemplateService?.delete;

  if (!deleteAction || !canShowTemplateDelete(template)) {
    return;
  }

  const deleteParams = getCrudTemplateDeleteParams(template);

  if (!deleteParams) {
    return;
  }

  await deleteAction(deleteParams, exportTemplateContext.value);

  if (kind === 'export') {
    exportTemplates.value = removeCrudTemplateFromList(
      exportTemplates.value,
      template,
    );
    if (selectedExportTemplateId.value === getCrudTemplateValue(template)) {
      selectedExportTemplateId.value = undefined;
    }
  } else {
    importTemplates.value = removeCrudTemplateFromList(
      importTemplates.value,
      template,
    );
    if (selectedImportTemplateId.value === getCrudTemplateValue(template)) {
      selectedImportTemplateId.value = undefined;
    }
  }

  message.success('模板已删除');
}

async function saveExportTemplate(
  name: string,
  scope: ExportTemplateSaveScope,
) {
  const create = props.config.exportTemplateService?.create;

  if (!create) {
    message.warning('当前页面未配置导出模板保存接口');
    return;
  }

  if (selectedExportFields.value.length === 0) {
    message.warning('请至少选择一个导出字段');
    return;
  }

  exportTemplateSaving.value = true;

  try {
    const context = exportTemplateContext.value;
    const payload = {
      category: EXPORT_TEMPLATE_CATEGORY,
      code: buildCrudTemplateCode('crud-export', context, name),
      config: buildExportTemplateConfig(),
      editable: true,
      enable: true,
      fileType: EXPORT_TEMPLATE_FILE_TYPE,
      groupName: context.title,
      name,
      ...buildCrudTemplateScopePayload(
        scope,
        userStore.userInfo as Record<string, any> | undefined,
      ),
      targetType: context.targetType,
      type: EXPORT_TEMPLATE_TYPE,
    };
    const created = normalizeCreatedCrudTemplate(
      await create(payload, context),
    );
    const savedTemplate = {
      ...payload,
      ...created,
      config: payload.config,
      name: String(created.name || payload.name),
    } as CrudExportTemplateRecord;

    message.success('导出模板已保存');
    await loadExportTemplates();
    const refreshedTemplate =
      findExportTemplate(savedTemplate) || savedTemplate;

    upsertExportTemplate(refreshedTemplate);
    selectedExportTemplateId.value = getCrudTemplateValue(refreshedTemplate);
    applyExportTemplateConfig(
      normalizeCrudTemplateConfig(refreshedTemplate.config),
    );
  } catch (error) {
    console.error(error);
    message.error('导出模板保存失败');
    throw error;
  } finally {
    exportTemplateSaving.value = false;
  }
}

function promptSaveExportTemplate() {
  if (selectedExportFields.value.length === 0) {
    message.warning('请至少选择一个导出字段');
    return;
  }

  let templateName = getExportTemplateNameSeed();
  let templateScope: ExportTemplateSaveScope = 'personal';
  const templateScopeName = `export-template-scope-${Date.now()}`;

  Modal.confirm({
    bodyStyle: {
      minHeight: '300px',
    },
    class: 'vben-crud-export-save-template-modal',
    content: () =>
      h('div', { class: 'vben-crud-export-save-template-form' }, [
        h('label', { class: 'vben-crud-export-save-template-field' }, [
          h('span', { class: 'vben-crud-export-save-template-label' }, [
            h(
              'span',
              { class: 'vben-crud-export-save-template-required' },
              '*',
            ),
            '模板名称',
          ]),
          h(Input, {
            autofocus: true,
            maxlength: 128,
            placeholder: '请输入模板名称',
            value: templateName,
            'onUpdate:value': (value: string) => {
              templateName = value;
            },
            onChange: (event: Event) => {
              templateName = (event.target as HTMLInputElement).value;
            },
          }),
        ]),
        h(
          'div',
          { class: 'vben-crud-export-save-template-scope' },
          EXPORT_TEMPLATE_SCOPE_OPTIONS.map((option) =>
            h(
              'label',
              {
                class: 'vben-crud-export-save-template-scope-option',
                key: option.value,
              },
              [
                h('input', {
                  checked: option.value === templateScope,
                  name: templateScopeName,
                  type: 'radio',
                  value: option.value,
                  onChange: (event: Event) => {
                    const input = event.target as HTMLInputElement;

                    if (input.checked) {
                      templateScope =
                        (input.value as ExportTemplateSaveScope) || 'personal';
                    }
                  },
                }),
                h('span', option.label),
              ],
            ),
          ),
        ),
      ]),
    okText: '保存',
    onOk: async () => {
      const name = templateName.trim();

      if (!name) {
        message.warning('请输入模板名称');
        throw new Error('EMPTY_EXPORT_TEMPLATE_NAME');
      }

      await saveExportTemplate(name, templateScope);
    },
    title: '另存为导出模板',
    width: 750,
  });
}

function setExportFieldSelected(key: string, selected: boolean) {
  const fieldKey = String(key);
  const nextKeys = exportSelectedFieldKeys.value.filter(
    (selectedKey) => selectedKey !== fieldKey,
  );

  if (selected) {
    nextKeys.push(fieldKey);
  }

  exportSelectedFieldKeys.value = nextKeys;
}

function setAllExportFieldsSelected(selected: boolean) {
  exportSelectedFieldKeys.value = selected
    ? exportableFields.value.map((field) => String(field.key))
    : [];
}

function updateExportFieldAlias(key: string, value: string) {
  exportFieldAliases.value[String(key)] = value;
}

function updateExportFieldConverter(
  key: string,
  converter: CrudExportConverter,
) {
  exportFieldConverters.value[String(key)] = converter;
}

function moveExportField(field: CrudFieldConfig, offset: -1 | 1) {
  const fieldKey = String(field.key);
  const orderedKeys = orderedExportFields.value.map((item) => String(item.key));
  const currentIndex = orderedKeys.indexOf(fieldKey);
  const nextIndex = currentIndex + offset;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedKeys.length) {
    return;
  }

  const [movedKey] = orderedKeys.splice(currentIndex, 1);
  orderedKeys.splice(nextIndex, 0, movedKey!);
  exportFieldOrderKeys.value = orderedKeys;
}

function getExportFieldHeader(field: CrudFieldConfig) {
  const alias = exportFieldAliases.value[String(field.key)]?.trim();

  return alias || field.label || field.key;
}

function getExportFileName() {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const listTitle = activeListTable.value
    ? getListTableTitle(
        activeListTable.value,
        Math.max(0, listTables.value.indexOf(activeListTable.value)),
      )
    : '列表';

  return `${props.config.title}_${listTitle}_${timestamp}.xls`;
}

function formatExportCellValue(field: CrudFieldConfig, record: GenericRecord) {
  const value = getTableFieldValue(field, record);

  if (value === null || value === undefined || value === '') {
    return '';
  }

  let displayValue: string;

  if (field.type === 'tenant') {
    const tenant = getTenantDisplay(record);
    displayValue = tenant.id ? `${tenant.name} (${tenant.id})` : tenant.name;
  } else if (isStatusLikeField(field)) {
    displayValue = getStatusTagText(field, value);
  } else if (isNumericField(field)) {
    displayValue = formatNumericValue(field, value);
  } else {
    displayValue = String(getCellDisplayText(field, value)).replace(/^-$/, '');
  }

  return formatCrudExportValue(
    value,
    exportFieldConverters.value[String(field.key)],
    displayValue,
  );
}

function buildExportQueryParams(pageIndex: number, pageSize: number) {
  return {
    ...buildSearchParams(),
    ...buildSortParams(),
    pageIndex,
    pageSize,
  };
}

function showExportLimitWarning() {
  message.warning('最多只能导出5万条记录，请缩小导出范围');
}

async function checkExportRecordLimit() {
  const result = await fetchCrudList<GenericRecord>(
    activeListPath.value,
    buildExportQueryParams(1, 1),
    props.config.apiModuleBase,
  );
  const total = Number(result.totals || 0);

  if (Number.isFinite(total) && total > EXPORT_MAX_RECORDS) {
    showExportLimitWarning();
    return false;
  }

  return true;
}

async function openExportModal() {
  if (exportLimitChecking.value) {
    return;
  }

  exportLimitChecking.value = true;

  try {
    const canExport = await checkExportRecordLimit();
    if (!canExport) {
      return;
    }

    exportFieldOrderKeys.value = getDefaultExportFieldOrder();
    exportSelectedFieldKeys.value = getDefaultSelectedExportFieldKeys();
    exportFieldAliases.value = getDefaultExportFieldAliases();
    exportFieldConverters.value = getDefaultExportFieldConverters();
    selectedExportTemplateId.value = undefined;
    await loadExportTemplates();
    exportModalOpen.value = true;
  } catch (error) {
    console.error(error);
    message.error('导出前检查失败');
  } finally {
    exportLimitChecking.value = false;
  }
}

function resetImportState() {
  importSheet.value = null;
  importMappings.value = [];
  importFileName.value = '';
  selectedImportTemplateId.value = undefined;
}

async function openImportModal() {
  if (!canImport.value) {
    return;
  }

  resetImportState();
  await loadImportTemplates();
  importModalOpen.value = true;
}

async function handleImportFileChange(file: File) {
  try {
    const sheet = await parseImportFile(file);

    if (sheet.headers.length === 0) {
      message.warning('文件中没有可导入的数据');
      return;
    }

    importFileName.value = file.name;
    importSheet.value = sheet;
    importMappings.value = buildDefaultImportMappings(
      sheet.headers,
      importableFields.value,
    );
    selectedImportTemplateId.value = undefined;
    message.success(`已读取 ${sheet.rows.length} 行数据`);
  } catch (error) {
    console.error(error);
    message.error(getCrudErrorMessage(error, '导入文件解析失败'));
  }
}

function updateImportMapping(
  fieldKey: string,
  patch: Partial<CrudImportMapping>,
) {
  importMappings.value = importMappings.value.map((mapping) =>
    mapping.fieldKey === fieldKey ? { ...mapping, ...patch } : mapping,
  );
}

function getImportTemplateNameSeed() {
  const context = exportTemplateContext.value;

  return `${context.title}${context.listTitle}导入模板`;
}

function buildImportTemplateConfig() {
  return {
    mappings: importMappings.value.map((mapping) => ({ ...mapping })),
    version: 1,
  };
}

function applyImportTemplateConfig(config: { mappings?: CrudImportMapping[] }) {
  const availableKeys = new Set(
    importableFields.value.map((field) => String(field.key)),
  );
  const currentMappings = new Map(
    importMappings.value.map((mapping) => [mapping.fieldKey, mapping] as const),
  );

  importMappings.value = (config.mappings || [])
    .filter((mapping) => availableKeys.has(String(mapping.fieldKey)))
    .map((mapping) => ({
      ...currentMappings.get(String(mapping.fieldKey)),
      ...mapping,
      fieldKey: String(mapping.fieldKey),
    }));

  for (const field of importableFields.value) {
    const fieldKey = String(field.key);

    if (
      !importMappings.value.some((mapping) => mapping.fieldKey === fieldKey)
    ) {
      importMappings.value.push({
        converter: 'trim',
        fieldKey,
      });
    }
  }
}

function handleImportTemplateChange(value?: number | string) {
  selectedImportTemplateId.value =
    value === undefined || value === null ? undefined : String(value);

  if (!selectedImportTemplateId.value) {
    return;
  }

  const template = importTemplates.value.find(
    (item) => getCrudTemplateValue(item) === selectedImportTemplateId.value,
  );

  if (!template) {
    return;
  }

  applyImportTemplateConfig(normalizeImportTemplateConfig(template.config));
  message.success(`已应用导入模板：${template.name}`);
}

async function saveImportTemplate(
  name: string,
  scope: ExportTemplateSaveScope,
) {
  const create = props.config.exportTemplateService?.create;

  if (!create) {
    message.warning('当前页面未配置导入模板保存接口');
    return;
  }

  if (importMappings.value.every((mapping) => !mapping.header)) {
    message.warning('请至少映射一个导入字段');
    return;
  }

  importTemplateSaving.value = true;

  try {
    const context = exportTemplateContext.value;
    const payload = {
      category: CRUD_IMPORT_TEMPLATE_CATEGORY,
      code: buildCrudTemplateCode('crud-import', context, name, 'import'),
      config: buildImportTemplateConfig(),
      editable: true,
      enable: true,
      fileType: EXPORT_TEMPLATE_FILE_TYPE,
      groupName: context.title,
      name,
      ...buildCrudTemplateScopePayload(
        scope,
        userStore.userInfo as Record<string, any> | undefined,
      ),
      targetType: context.targetType,
      type: IMPORT_TEMPLATE_TYPE,
    };
    const created = normalizeCreatedCrudTemplate(
      await create(payload, context),
    );
    const savedTemplate = {
      ...payload,
      ...created,
      config: payload.config,
      name: String(created.name || payload.name),
    } as CrudExportTemplateRecord;

    message.success('导入模板已保存');
    await loadImportTemplates();
    const refreshedTemplate =
      importTemplates.value.find((item) =>
        isSameCrudTemplate(item, savedTemplate),
      ) || savedTemplate;

    if (
      !importTemplates.value.some((item) =>
        isSameCrudTemplate(item, refreshedTemplate),
      )
    ) {
      importTemplates.value = [refreshedTemplate, ...importTemplates.value];
    }

    selectedImportTemplateId.value = getCrudTemplateValue(refreshedTemplate);
  } catch (error) {
    console.error(error);
    message.error('导入模板保存失败');
    throw error;
  } finally {
    importTemplateSaving.value = false;
  }
}

function promptSaveImportTemplate() {
  if (importMappings.value.every((mapping) => !mapping.header)) {
    message.warning('请至少映射一个导入字段');
    return;
  }

  let templateName = getImportTemplateNameSeed();
  let templateScope: ExportTemplateSaveScope = 'personal';
  const templateScopeName = `import-template-scope-${Date.now()}`;

  Modal.confirm({
    bodyStyle: {
      minHeight: '300px',
    },
    class: 'vben-crud-export-save-template-modal',
    content: () =>
      h('div', { class: 'vben-crud-export-save-template-form' }, [
        h('label', { class: 'vben-crud-export-save-template-field' }, [
          h('span', { class: 'vben-crud-export-save-template-label' }, [
            h(
              'span',
              { class: 'vben-crud-export-save-template-required' },
              '*',
            ),
            '模板名称',
          ]),
          h(Input, {
            autofocus: true,
            maxlength: 128,
            placeholder: '请输入模板名称',
            value: templateName,
            'onUpdate:value': (value: string) => {
              templateName = value;
            },
            onChange: (event: Event) => {
              templateName = (event.target as HTMLInputElement).value;
            },
          }),
        ]),
        h(
          'div',
          { class: 'vben-crud-export-save-template-scope' },
          EXPORT_TEMPLATE_SCOPE_OPTIONS.map((option) =>
            h(
              'label',
              {
                class: 'vben-crud-export-save-template-scope-option',
                key: option.value,
              },
              [
                h('input', {
                  checked: option.value === templateScope,
                  name: templateScopeName,
                  type: 'radio',
                  value: option.value,
                  onChange: (event: Event) => {
                    const input = event.target as HTMLInputElement;

                    if (input.checked) {
                      templateScope =
                        (input.value as ExportTemplateSaveScope) || 'personal';
                    }
                  },
                }),
                h('span', option.label),
              ],
            ),
          ),
        ),
      ]),
    okText: '保存',
    onOk: async () => {
      const name = templateName.trim();

      if (!name) {
        message.warning('请输入模板名称');
        throw new Error('EMPTY_IMPORT_TEMPLATE_NAME');
      }

      await saveImportTemplate(name, templateScope);
    },
    title: '另存为导入模板',
    width: 750,
  });
}

function appendImportConsole(line: string, payload?: unknown) {
  const time = new Date().toLocaleTimeString();
  const text =
    payload === undefined
      ? line
      : `${line}\n${JSON.stringify(payload, null, 2)}`;

  importConsoleLines.value.push(`[${time}] ${text}`);
}

function clearImportConsole() {
  importConsoleLines.value = [];
}

function stopImport() {
  if (!importing.value) {
    return;
  }

  importStopRequested.value = true;
  appendImportConsole('已请求停止导入，当前批次完成后不再提交后续批次');
}

async function copyImportConsole() {
  try {
    await navigator.clipboard?.writeText(importConsoleLines.value.join('\n'));
    message.success('控制台内容已复制');
  } catch {
    message.warning('复制失败');
  }
}

async function handleImportConfirm() {
  const apiService = props.config.apiService;

  if (!apiService?.batchCreate || !importSheet.value) {
    return;
  }

  const { records, rowErrors } = importPreviewResult.value;

  if (rowErrors.length > 0) {
    message.warning('存在转换错误，请修正映射或数据后再导入');
    importConsoleOpen.value = true;
    appendImportConsole('导入预检失败', rowErrors);
    return;
  }

  if (records.length === 0) {
    message.warning('没有可导入的数据');
    return;
  }

  importing.value = true;
  importStopRequested.value = false;
  importConsoleOpen.value = true;
  appendImportConsole(
    `开始导入 ${records.length} 条数据，每批 ${CRUD_IMPORT_BATCH_SIZE} 条`,
  );

  let successCount = 0;
  const chunks = chunkImportRecords(records);
  let stopped = false;

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      if (importStopRequested.value) {
        stopped = true;
        appendImportConsole(
          `导入已停止，已完成 ${successCount} 条，剩余 ${records.length - successCount} 条未提交`,
        );
        break;
      }

      const chunk = chunks[index] || [];

      appendImportConsole(`提交第 ${index + 1}/${chunks.length} 批`, {
        count: chunk.length,
      });
      const result = await apiService.batchCreate(chunk);

      successCount += chunk.length;
      appendImportConsole(`第 ${index + 1} 批导入成功`, result);
    }

    if (!stopped) {
      appendImportConsole(`导入完成，成功 ${successCount} 条`);
      message.success(`导入完成，成功 ${successCount} 条`);
      importModalOpen.value = false;
    } else {
      message.warning(`导入已停止，成功 ${successCount} 条`);
    }

    if (successCount > 0) {
      await loadList();
    }
  } catch (error) {
    console.error(error);
    appendImportConsole('导入失败', {
      error: getCrudErrorMessage(error, '导入失败'),
      response: (error as any)?.response?.data,
    });
    message.error('导入失败，详情见控制台');
  } finally {
    importing.value = false;
  }
}

async function fetchExportRecords() {
  const records: GenericRecord[] = [];
  let pageIndex = 1;

  while (true) {
    const result = await fetchCrudList<GenericRecord>(
      activeListPath.value,
      buildExportQueryParams(pageIndex, EXPORT_PAGE_SIZE),
      props.config.apiModuleBase,
    );
    const items = result.items || [];

    if (items.length === 0) {
      break;
    }

    records.push(...items);

    if (records.length > EXPORT_MAX_RECORDS) {
      showExportLimitWarning();
      throw new Error(EXPORT_LIMIT_ERROR_MESSAGE);
    }

    if (items.length < EXPORT_PAGE_SIZE) {
      break;
    }

    pageIndex += 1;
  }

  return records;
}

async function handleExportConfirm() {
  const fields = selectedExportFields.value;

  if (fields.length === 0) {
    message.warning('请至少选择一个导出字段');
    return;
  }

  exporting.value = true;

  try {
    const records = await fetchExportRecords();
    const xml = buildExcelXml({
      fields,
      formatCellValue: formatExportCellValue,
      getFieldHeader: getExportFieldHeader,
      records,
      worksheetName: props.config.title,
    });
    downloadExcelXml(xml, getExportFileName());
    exportModalOpen.value = false;

    try {
      await loadList();
    } catch (error) {
      console.error(error);
      message.warning(`导出成功，共 ${records.length} 条，列表刷新失败`);
      return;
    }

    message.success(`导出成功，共 ${records.length} 条`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === EXPORT_LIMIT_ERROR_MESSAGE
    ) {
      return;
    }

    console.error(error);
    message.error('导出失败');
  } finally {
    exporting.value = false;
  }
}

async function loadList() {
  if (!canQuery.value) {
    dataSource.value = [];
    pagination.total = 0;
    captureListTableState();
    return;
  }

  loading.value = true;

  try {
    const listParams = {
      ...buildSearchParams(),
      ...buildSortParams(),
      pageIndex: pagination.current,
      pageSize: pagination.pageSize,
    };
    const defaultListPath = `${props.config.apiBase}/list`;
    const result =
      props.config.apiService?.list &&
      !activeListTable.value?.listPath &&
      !props.config.listPath &&
      activeListPath.value === defaultListPath
        ? await props.config.apiService.list(listParams)
        : await fetchCrudList<GenericRecord>(
            activeListPath.value,
            listParams,
            props.config.apiModuleBase,
          );

    dataSource.value = result.items || [];
    pagination.total = result.totals || 0;
    captureListTableState();
  } finally {
    loading.value = false;
  }
}

function handleCreate() {
  editingRecord.value = null;
  resetForm();
  modalOpen.value = true;
}

function handleEdit(record: GenericRecord) {
  editingRecord.value = record;
  resetForm(record);
  modalOpen.value = true;
}

async function handleRetrieve(record: GenericRecord) {
  const params = buildCrudRetrieveParams(record, recordKey.value);

  const response =
    props.config.apiService?.retrieve && !props.config.detailPath
      ? await props.config.apiService.retrieve(params)
      : await requestClient.get(
          buildModuleRequestPath(
            props.config.detailPath || `${props.config.apiBase}/retrieve`,
            props.config.apiModuleBase,
          ),
          {
            baseURL: '',
            params,
          },
        );

  if (response && typeof response === 'object' && !Array.isArray(response)) {
    latestDetailRecord.value = {source:pageDisplaySettingCode.value,record:response};
  }
  openActionResult(
    `${getBusinessTitle(props.config.title)}详情`,
    'showForm',
    response,
  );
}

async function handleDelete(record: GenericRecord) {
  const deleteParams = buildCrudDeleteParams(record, recordKey.value);
  const recordId = deleteParams[recordKey.value];

  if (props.config.apiService?.delete && !props.config.deletePath) {
    await props.config.apiService.delete(deleteParams);
  } else {
    await deleteCrudRecord(
      props.config.deletePath || `${props.config.apiBase}/delete`,
      recordId,
      recordKey.value,
      props.config.apiModuleBase,
    );
  }
  message.success('删除成功');
  await loadList();
}

async function handleSubmit() {
  if (submitting.value) return;
  if (!validateFormFields()) {
    return;
  }

  const allowedFields = [...submittableFormFields.value];
  const allowedKeys = new Set(allowedFields.map((field) => field.key));
  const excludedFields = props.config.fields.filter((field) => !allowedKeys.has(field.key));
  submitting.value = true;

  try {
    const payload: GenericRecord = {};
    const isCreating = editingRecord.value?.[recordKey.value] === undefined;

    if (editingRecord.value?.[recordKey.value] !== undefined) {
      payload[recordKey.value] = editingRecord.value[recordKey.value];
    }

    if (
      editingRecord.value &&
      editingRecord.value.optimisticLock !== undefined &&
      editingRecord.value.optimisticLock !== null
    ) {
      payload.optimisticLock = editingRecord.value.optimisticLock;
    }

    for (const field of allowedFields) {
      if (
        unsubmittedGroupKeys.value.has(field.key) ||
        !shouldSubmitCrudFormField(field, isCreating ? 'create' : 'edit')
      ) {
        continue;
      }

      if (field.complexGroupKey) {
        continue;
      }
      if (field.type === 'area-cascader') {
        if (
          isCreating &&
          shouldOmitEmptyChoiceFormField(field, formState[field.key])
        ) {
          continue;
        }

        applyAreaCascaderValueToRecord(
          payload,
          field,
          formState[field.key],
          getFieldOptions(field),
          !isCreating,
        );
        continue;
      }

      const originalValue = editingRecord.value
        ? getRecordValue(editingRecord.value, field.key)
        : undefined;
      const value =
        editingRecord.value &&
        shouldPreserveUnmatchedCrudChoiceValue(
          field,
          originalValue,
          formState[field.key],
          getFieldOptions(field),
        )
          ? originalValue
          : serializeSubmittableFormValue(field, formState[field.key], !isCreating);

      if (isCreating && shouldOmitEmptyChoiceFormField(field, value)) {
        continue;
      }

      payload[field.key] = value;
    }

    const complexValues = { ...formState };
    for (const field of allowedFields) {
      if (field.complexGroupKey && field.type !== 'area-cascader')
        complexValues[field.key] = serializeSubmittableFormValue(field, formState[field.key], !isCreating);
    }
    const allowedComplexGroups = (props.config.complexGroups || []).map((group) => ({
      ...group,
      fieldMappings: Object.fromEntries(Object.entries(group.fieldMappings).filter(([key]) => allowedKeys.has(key))),
    })).filter((group) => Object.keys(group.fieldMappings).length > 0);
    const complexGroupPayload = buildCrudComplexGroupPayload(
      allowedComplexGroups,
      complexGroupEnabled,
      complexValues,
    );
    for (const field of allowedFields) {
      if (!field.complexGroupKey || field.type !== 'area-cascader') {
        continue;
      }
      const group = props.config.complexGroups?.find(
        (item) => item.key === field.complexGroupKey,
      );
      const nestedKey = group?.fieldMappings[field.key];
      const target = group ? complexGroupPayload[group.submitKey] : undefined;
      if (!nestedKey || !target) {
        continue;
      }
      applyAreaCascaderValueToRecord(
        target,
        {
          ...field,
          areaCascader: {
            ...field.areaCascader,
            valueKey: nestedKey,
          },
        },
        formState[field.key],
        getFieldOptions(field, formState),
        !isCreating,
      );
    }
    Object.assign(payload, complexGroupPayload);

    const createPath = resolveCrudPath(
      props.config.createPath,
      `${props.config.apiBase}/create`,
      payload,
      editingRecord.value,
    );
    const transformedPayload = props.config.transformSubmit
      ? await props.config.transformSubmit(payload, editingRecord.value)
      : payload;
    const finalPayload = omitExcludedCrudFields(
      omitNonPlatformTenantId(transformedPayload, isPlatformUser.value),
      excludedFields,
      props.config.complexGroups,
      isCreating ? [] : [recordKey.value, 'optimisticLock'],
    );

    if (!isCreating) {
      finalPayload[recordKey.value] = editingRecord.value?.[recordKey.value];
      if (editingRecord.value?.optimisticLock !== undefined)
        finalPayload.optimisticLock = editingRecord.value.optimisticLock;
    }

    if (!isCreating && shouldAutoForceUpdateField(pageDisplayConfig.value)) {
      finalPayload.autoForceUpdateField = true;
    }

    if (isCreating) {
      if (props.config.apiService?.create && !props.config.createPath) {
        await props.config.apiService.create(finalPayload);
      } else {
        await createCrudRecord(
          createPath,
          finalPayload,
          props.config.apiModuleBase,
        );
      }
      message.success('创建成功');
    } else {
      if (props.config.apiService?.update && !props.config.updatePath) {
        await props.config.apiService.update(finalPayload);
      } else {
        await updateCrudRecord(
          props.config.updatePath || `${props.config.apiBase}/update`,
          finalPayload,
          props.config.apiModuleBase,
        );
      }
      message.success('更新成功');
    }

    modalOpen.value = false;
    await loadList();
  } catch (error) {
    console.error(error);
    message.error(getCrudErrorMessage(error, '保存失败'));
  } finally {
    submitting.value = false;
  }
}

function resetSearch() {
  suppressAutoSearch = true;
  for (const field of submittableSearchFields.value) searchState[field.key] = undefined;
  for (const item of searchFieldItems.value) {
    if (item.kind === 'range') {
      searchState[item.key] = undefined;
      continue;
    }

    searchState[item.field.key] = undefined;
  }

  applyEditableSearchDefault();
  applyPageDisplayQueryDefaults();

  pagination.current = 1;
  loadList();
  void nextTick(() => {
    suppressAutoSearch = false;
  });
}

function applyPageDisplayQueryDefaults() {
  for (const field of props.config.fields.filter(
    (item) => item.search && isFieldVisible(item),
  )) {
    const configuredDefault = getPageDisplayField(
      'query',
      field.key,
    )?.defaultValue;
    if (configuredDefault && 'value' in configuredDefault) {
      searchState[field.key] =
        field.type === 'area-cascader'
          ? normalizeFormValue(field, configuredDefault.value)
          : configuredDefault.value;
    }
  }
  for (const item of searchFieldItems.value) {
    if (item.kind !== 'range') continue;
    const values = [searchState[item.startKey], searchState[item.endKey]];
    if (values.some((value) => value !== undefined)) searchState[item.key] = values;
  }
}

function applyEditableSearchDefault() {
  if (
    shouldApplyEditableSearchDefault(
      isPlatformUser.value,
      searchFieldItems.value,
    )
  ) {
    searchState.editable = 'true';
  }
}

function normalizeTableSorter(sorter: any): TableSorterState {
  const sorterItem = Array.isArray(sorter)
    ? sorter.find((item) => item?.order)
    : sorter;
  const order = sorterItem?.order;

  if (order !== 'ascend' && order !== 'descend') {
    return {};
  }

  const field =
    sorterItem?.field ??
    sorterItem?.columnKey ??
    sorterItem?.column?.key ??
    sorterItem?.column?.dataIndex;

  if (!field) {
    return {};
  }

  return {
    field: String(Array.isArray(field) ? field.join('.') : field),
    order,
  };
}

function handleTableChange(page: any, _filters: any, sorter: any) {
  pagination.current = page.current || 1;
  pagination.pageSize = page.pageSize || 10;
  copyReactiveRecord<any>(tableSorterState, normalizeTableSorter(sorter));
  loadList();
}

function handleListTableChange(key: number | string) {
  const previousKey = activeListTableStateKey.value;
  const nextKey = String(key || '');

  if (!nextKey || nextKey === previousKey) {
    return;
  }

  captureListTableState(previousKey);
  activeListTableKey.value = nextKey;
  restoreListTableState(nextKey);
  loadTableColumnPreference();
  void loadList();
  updateTableScrollY();
}

function toggleSearchExpanded() {
  searchExpanded.value = !searchExpanded.value;
}

let suppressAutoSearch = false;
const SINGLE_TEXT_QUERY_AUTOSEARCH_DELAY = 1000;
let singleTextQueryAutoSearchTimer: ReturnType<typeof setTimeout> | undefined;

function clearSingleTextQueryAutoSearchTimer() {
  if (singleTextQueryAutoSearchTimer !== undefined) {
    clearTimeout(singleTextQueryAutoSearchTimer);
    singleTextQueryAutoSearchTimer = undefined;
  }
}

function loadSearchFromFirstPage() {
  pagination.current = 1;
  void loadList();
}

function scheduleSingleTextQueryAutoSearch() {
  clearSingleTextQueryAutoSearchTimer();
  singleTextQueryAutoSearchTimer = setTimeout(() => {
    singleTextQueryAutoSearchTimer = undefined;
    if (
      !shouldAutoQuery(
        singleTextQueryAutoSearchEnabled.value,
        autoSearchReady.value,
        suppressAutoSearch,
      )
    ) {
      return;
    }
    loadSearchFromFirstPage();
  }, SINGLE_TEXT_QUERY_AUTOSEARCH_DELAY);
}

function handleSingleTextQuerySearchEnter() {
  clearSingleTextQueryAutoSearchTimer();
  loadSearchFromFirstPage();
}

watch(
  searchState,
  () => {
    if (
      shouldAutoQuery(
        autoSearchEnabled.value,
        autoSearchReady.value,
        suppressAutoSearch,
      )
    ) {
      clearSingleTextQueryAutoSearchTimer();
      loadSearchFromFirstPage();
      return;
    }

    if (
      shouldAutoQuery(
        singleTextQueryAutoSearchEnabled.value,
        autoSearchReady.value,
        suppressAutoSearch,
      )
    ) {
      scheduleSingleTextQueryAutoSearch();
      return;
    }

    clearSingleTextQueryAutoSearchTimer();
  },
  { deep: true },
);

watch(singleTextQueryAutoSearchEnabled, (enabled) => {
  if (!enabled) {
    clearSingleTextQueryAutoSearchTimer();
  }
});

async function refreshTable() {
  await loadList();
}

function toggleTableFullscreen() {
  tableFullscreen.value = !tableFullscreen.value;
  updateTableScrollY();
}

function getDefaultTableColumnFixed(field: CrudFieldConfig) {
  if (field.fixed === true) {
    return 'left';
  }

  return field.fixed === 'left' || field.fixed === 'right'
    ? field.fixed
    : undefined;
}

function getEffectiveTableColumnFixed(field: CrudFieldConfig) {
  return effectiveTableColumnFixedMap.value[getTableFieldKey(field)];
}

function resetReactiveRecord(record: Record<string, any>) {
  for (const key of Object.keys(record)) {
    delete record[key];
  }
}

function copyReactiveRecord<T = any>(
  target: Record<string, T>,
  source: Record<string, T>,
) {
  resetReactiveRecord(target);

  for (const [key, value] of Object.entries(source)) {
    target[key] = value;
  }
}

function getTableFieldKey(field: CrudFieldConfig) {
  return String(field.key);
}

function pruneTableColumnPreference() {
  const availableKeys = new Set(
    tableFields.value.map((field) => getTableFieldKey(field)),
  );
  const nextHiddenKeys = hiddenTableColumnKeys.value.filter((key) =>
    availableKeys.has(key),
  );

  if (nextHiddenKeys.length !== hiddenTableColumnKeys.value.length) {
    hiddenTableColumnKeys.value = nextHiddenKeys;
    return true;
  }

  return false;
}

function saveTableColumnPreference() {
  if (!canCustomizeTableColumnsLocally.value) {
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  pruneTableColumnPreference();

  if (hiddenTableColumnKeys.value.length === 0) {
    clearTableColumnPreference();
    return;
  }

  window.localStorage.setItem(
    tableColumnPreferenceStorageKey.value,
    JSON.stringify(buildTableColumnPreference(hiddenTableColumnKeys.value)),
  );
  hasStoredTableColumnPreference.value = true;
}

function clearTableColumnPreference() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(tableColumnPreferenceStorageKey.value);
  }
  hasStoredTableColumnPreference.value = false;
}

function resetTableColumnPreferenceState() {
  hiddenTableColumnKeys.value = [];
  draftHiddenTableColumnKeys.value = [];
  hasStoredTableColumnPreference.value = false;
  columnSettingsSnapshot.value = null;
}

function loadTableColumnPreference() {
  if (!canCustomizeTableColumnsLocally.value) {
    resetTableColumnPreferenceState();
    columnSettingsOpen.value = false;
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  resetTableColumnPreferenceState();

  const rawValue = window.localStorage.getItem(
    tableColumnPreferenceStorageKey.value,
  );

  if (!rawValue) {
    hasStoredTableColumnPreference.value = false;
    return;
  }

  const preference = readTableColumnPreference(
    rawValue,
    tableFields.value.map((field) => getTableFieldKey(field)),
  );

  hiddenTableColumnKeys.value = preference.hiddenKeys;
  hasStoredTableColumnPreference.value = preference.hasStoredPreference;

  if (preference.invalid) {
    console.warn('读取表格列设置失败，已恢复默认列设置。');
    clearTableColumnPreference();
  }
}

function getTableColumnSettingsSnapshot(): TableColumnSettingsSnapshot {
  return {
    hiddenKeys: [...hiddenTableColumnKeys.value],
  };
}

function restoreTableColumnSettings(snapshot: TableColumnSettingsSnapshot) {
  hiddenTableColumnKeys.value = [...snapshot.hiddenKeys];
  openTableColumnSettings(false);
  updateTableScrollY();
}

function syncDraftTableColumnSettingsToTable() {
  hiddenTableColumnKeys.value = [...draftHiddenTableColumnKeys.value];
  updateTableScrollY();
}

function openTableColumnSettings(captureSnapshot = true) {
  if (captureSnapshot) {
    columnSettingsSnapshot.value = getTableColumnSettingsSnapshot();
  }

  draftHiddenTableColumnKeys.value = [...hiddenTableColumnKeys.value];
}

function isDraftTableColumnVisible(key: string) {
  return !draftHiddenTableColumnKeys.value.includes(String(key));
}

function setDraftTableColumnVisible(key: string, visible: boolean) {
  const columnKey = String(key);
  const nextHiddenKeys = draftHiddenTableColumnKeys.value.filter(
    (hiddenKey) => hiddenKey !== columnKey,
  );

  if (!visible) {
    const remainingVisibleCount =
      tableFields.value.length - nextHiddenKeys.length - 1;

    if (remainingVisibleCount <= 0) {
      message.warning('至少保留一列');
      return;
    }

    nextHiddenKeys.push(columnKey);
  }

  draftHiddenTableColumnKeys.value = nextHiddenKeys;
  syncDraftTableColumnSettingsToTable();
}

function setAllDraftTableColumnsVisible(visible: boolean) {
  if (visible) {
    draftHiddenTableColumnKeys.value = [];
    syncDraftTableColumnSettingsToTable();
    return;
  }

  if (tableFields.value.length <= 1) {
    message.warning('至少保留一列');
    return;
  }

  draftHiddenTableColumnKeys.value = tableFields.value
    .slice(1)
    .map((field) => String(field.key));
  syncDraftTableColumnSettingsToTable();
}

function applyTableColumnSettings() {
  if (!canCustomizeTableColumnsLocally.value) {
    return;
  }

  syncDraftTableColumnSettingsToTable();
  saveTableColumnPreference();
  columnSettingsSnapshot.value = null;
  columnSettingsOpen.value = false;
  updateTableScrollY();
}

function cancelTableColumnSettings() {
  if (columnSettingsSnapshot.value) {
    restoreTableColumnSettings(columnSettingsSnapshot.value);
  } else {
    openTableColumnSettings(false);
  }

  columnSettingsSnapshot.value = null;
  columnSettingsOpen.value = false;
}

function resetTableColumns() {
  draftHiddenTableColumnKeys.value = [];
  syncDraftTableColumnSettingsToTable();
  clearTableColumnPreference();
  columnSettingsSnapshot.value = getTableColumnSettingsSnapshot();
  updateTableScrollY();
}

function getAreaCascaderSelectableLevels(
  field: CrudFieldConfig,
  state: GenericRecord,
) {
  const valueKey = field.areaCascader?.valueKey || field.key;
  return resolveAdministrativeAreaSelectableLevels(
    field.areaCascader?.selectableLevels,
    state[valueKey] ?? state[field.key],
  );
}

function getFieldOptions(
  field: CrudFieldConfig,
  state: GenericRecord = formState,
): any[] {
  if (field.type === 'area-cascader') {
    return restrictAdministrativeAreaOptionsByLevels(
      areaCascaderRestrictedOptions[field.key] ||
        getAdministrativeAreaCascaderOptions(),
      getAreaCascaderSelectableLevels(field, state),
    );
  }
  return normalizeCrudChoiceOptions(
    field,
    optionState[field.key] || field.options || [],
  );
}

function isAreaCascaderLevelRestricted(
  field: CrudFieldConfig,
  state: GenericRecord,
) {
  return getAreaCascaderSelectableLevels(field, state).length < 3;
}

async function handleAreaCascaderDropdownVisibleChange(
  field: CrudFieldConfig,
  open: boolean,
  state: GenericRecord,
) {
  if (!open) return;
  const context = resolveAreaCascaderOpenAreaContext(field, state);
  if (!hasOpenAreaContext(context)) {
    areaCascaderRestrictedOptions[field.key] =
      getAdministrativeAreaCascaderOptions();
    return;
  }
  optionLoadingState[field.key] = true;
  try {
    areaCascaderRestrictedOptions[field.key] = filterAdministrativeAreaOptions(
      await getCurrentOpenAreaCodes(context),
    );
  } catch {
    message.error('获取开通区域失败，请重试');
    areaCascaderRestrictedOptions[field.key] = [];
  } finally {
    optionLoadingState[field.key] = false;
  }
}

function resolveAreaCascaderOpenAreaContext(
  field: CrudFieldConfig,
  state: GenericRecord,
) {
  const context = field.areaCascader?.openAreaContext;
  return {
    bizCategory: resolveCrudDynamicTextWithState(context?.bizCategory, state),
    bizType: resolveCrudDynamicTextWithState(context?.bizType, state),
    domain: resolveCrudDynamicTextWithState(context?.domain, state),
  };
}

function resolveCrudDynamicTextWithState(
  value: CrudDynamicText | undefined,
  state: GenericRecord,
) {
  return typeof value === 'function' ? value(state) : value;
}

function resolveCrudDynamicText(value: CrudDynamicText | undefined) {
  return resolveCrudDynamicTextWithState(value, formState);
}

function getFormFieldLabel(field: CrudFieldConfig) {
  return resolveCrudDynamicText(field.formLabel) || field.label;
}

function getFormFieldHelp(field: CrudFieldConfig) {
  return resolveCrudDynamicText(field.help);
}

function getPlaceholder(field: CrudFieldConfig) {
  const placeholder = resolveCrudDynamicText(field.placeholder);
  const label = getFormFieldLabel(field);
  if (placeholder) {
    return placeholder;
  }

  if (
    field.type === 'area-cascader' ||
    field.type === 'org-tree-select' ||
    field.type === 'role-select' ||
    field.type === 'select'
  ) {
    return `请选择${label}`;
  }

  return `请输入${label}`;
}

function getSearchFieldSlotName(field: CrudFieldConfig) {
  return `search-field-${field.key}`;
}

function resolveSearchFieldSlotName(field: CrudFieldConfig) {
  const slotName = getSearchFieldSlotName(field);
  return slots[slotName] ? slotName : 'search-field';
}

function hasSearchFieldSlot(field: CrudFieldConfig) {
  return Boolean(slots[getSearchFieldSlotName(field)] || slots['search-field']);
}

function getFormFieldSlotName(field: CrudFieldConfig) {
  return `form-field-${field.key}`;
}

function resolveFormFieldSlotName(field: CrudFieldConfig) {
  const slotName = getFormFieldSlotName(field);
  return slots[slotName] ? slotName : 'form-field';
}

function hasFormFieldSlot(field: CrudFieldConfig) {
  return Boolean(slots[getFormFieldSlotName(field)] || slots['form-field']);
}

function getTableCellSlotName(key: unknown) {
  return typeof key === 'string' ? `table-cell-${key}` : '';
}

function resolveTableCellSlotName(key: unknown) {
  const slotName = getTableCellSlotName(key);
  return slotName && slots[slotName] ? slotName : 'table-cell';
}

function hasTableCellSlot(key: unknown) {
  const slotName = getTableCellSlotName(key);
  return Boolean((slotName && slots[slotName]) || slots['table-cell']);
}

function isImageUploadField(field: CrudFieldConfig) {
  return field.type === 'image';
}

function isFileUploadField(field: CrudFieldConfig) {
  return field.type === 'file' || field.type === 'image';
}

function isMultiUploadField(field: CrudFieldConfig) {
  return typeof field.multiple === 'function'
    ? field.multiple(formState)
    : !!field.multiple;
}

function getUploadMaxCount(field: CrudFieldConfig) {
  if (typeof field.maxUploadCount === 'function') {
    return field.maxUploadCount(formState);
  }
  return field.maxUploadCount || (isMultiUploadField(field) ? undefined : 1);
}

function shouldShowUploadTrigger(field: CrudFieldConfig) {
  return isMultiUploadField(field) || getUploadUrls(field).length === 0;
}

function getUploadUrls(field: CrudFieldConfig) {
  return getUploadUrlsFromValue(formState[field.key]);
}

function getUploadUrlsFromValue(value: any) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getUploadFileList(field: CrudFieldConfig): UploadFile[] {
  return getUploadUrls(field).map((url, index) => ({
    name: url.split('/').pop() || `${field.label}${index + 1}`,
    status: 'done',
    uid: `${field.key}-${index}-${url}`,
    url,
  }));
}

function setUploadUrls(field: CrudFieldConfig, urls: string[]) {
  updateFormFieldInput(field, isMultiUploadField(field) ? urls : (urls[0] ?? ''));
}

function replaceUploadUrl(
  field: CrudFieldConfig,
  oldUrl: string,
  newUrl: string,
) {
  const urls = getUploadUrls(field);
  const index = urls.indexOf(oldUrl);

  if (index === -1) {
    setUploadUrls(
      field,
      isMultiUploadField(field) ? [...urls, newUrl] : [newUrl],
    );
    return;
  }

  urls[index] = newUrl;
  setUploadUrls(field, urls);
}

function cropResultToFile(result: Blob | string, fileName: string) {
  if (result instanceof Blob) {
    return new File([result], fileName, { type: result.type || 'image/png' });
  }

  const dataUrl = result;
  const [header = '', content = ''] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) || 0;
  }

  return new File([bytes], fileName, { type: mime });
}

function cropImageFile(file: File, aspectRatio?: string) {
  return new Promise<File | null>((resolve) => {
    const container = document.createElement('div');
    document.body.append(container);

    const open = ref(true);
    const cropperRef = ref<InstanceType<typeof VCropper> | null>(null);
    const objectUrl = URL.createObjectURL(file);

    function close(result: File | null) {
      open.value = false;
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        render(null, container);
        container.remove();
        resolve(result);
      }, 200);
    }

    const CropperWrapper = {
      setup() {
        return () =>
          h(
            Modal,
            {
              centered: true,
              destroyOnClose: true,
              maskClosable: false,
              okText: '裁剪并上传',
              open: open.value,
              title: '图片裁剪',
              width: 548,
              onCancel: () => close(null),
              onOk: async () => {
                const dataUrl = await cropperRef.value?.getCropImage();
                close(dataUrl ? cropResultToFile(dataUrl, file.name) : null);
              },
            },
            () =>
              h(VCropper, {
                ref: (ref: any) => {
                  cropperRef.value = ref;
                },
                aspectRatio,
                img: objectUrl,
              }),
          );
      },
    };

    render(h(CropperWrapper), container);
  });
}

async function uploadCrudFile(field: CrudFieldConfig, options: any) {
  if (isFormFieldInteractionDisabled(field)) return;
  try {
    const rawFile = options.file as File;
    const uploadFile =
      isImageUploadField(field) && !isMultiUploadField(field)
        ? (await cropImageFile(rawFile)) || rawFile
        : rawFile;
    if (isFormFieldInteractionDisabled(field)) return;
    const url = await uploadFileByFileStorageController(
      uploadFile,
      props.config.apiModuleBase,
      field.uploadPath ||
        (isMultiUploadField(field)
          ? FILE_STORAGE_MULTI_UPLOAD_PATH
          : FILE_STORAGE_SINGLE_UPLOAD_PATH),
    );
    if (isFormFieldInteractionDisabled(field)) return;
    const normalizedUrl = url.trim();
    if (options.replaceUrl) {
      replaceUploadUrl(field, options.replaceUrl, normalizedUrl);
    } else {
      const nextUrls = isMultiUploadField(field)
        ? [...getUploadUrls(field), normalizedUrl]
        : [normalizedUrl];
      setUploadUrls(field, nextUrls);
    }
    options.onSuccess?.(normalizedUrl);
  } catch (error) {
    console.error(error);
    message.error(`${field.label}上传失败`);
    options.onError?.(error);
  }
}

async function uploadClipboardImage(field: CrudFieldConfig, file: File) {
  await uploadCrudFile(field, {
    file,
    onError: () => {},
    onSuccess: () => {
      message.success('截图已粘贴上传');
    },
  });
}

function getClipboardImageFile(event: ClipboardEvent) {
  const items = [...(event.clipboardData?.items || [])];
  const imageItem = items.find((item) => item.type.startsWith('image/'));
  const file = imageItem?.getAsFile();

  if (!file) {
    return null;
  }

  const suffix = file.type.split('/').pop() || 'png';
  return new File([file], `clipboard-${Date.now()}.${suffix}`, {
    type: file.type,
  });
}

function handlePasteUpload(event: ClipboardEvent) {
  const target = hoveredImageUploadTarget.value;
  const field = target?.field;

  if (!field || !modalOpen.value || !isImageUploadField(field) || isFormFieldInteractionDisabled(field)) {
    return;
  }

  const file = getClipboardImageFile(event);
  if (!file) {
    return;
  }

  event.preventDefault();
  if (target?.mode === 'replace' && target.url) {
    void uploadCrudFile(field, {
      file,
      replaceUrl: target.url,
      onError: () => {},
      onSuccess: () => {
        message.success('截图已粘贴并替换图片');
      },
    });
    return;
  }

  void uploadClipboardImage(field, file);
}

function handleUploadMouseEnter(
  field: CrudFieldConfig,
  event: MouseEvent,
  mode: 'append' | 'replace' = 'append',
  url?: string,
) {
  if (!isImageUploadField(field) || isFormFieldInteractionDisabled(field)) {
    return;
  }

  hoveredImageUploadTarget.value = {
    field,
    mode,
    url,
  };
  handleUploadMouseMove(event);
}

function handleUploadMouseMove(event: MouseEvent) {
  uploadPasteTipPosition.x = event.clientX + 14;
  uploadPasteTipPosition.y = event.clientY + 14;
}

function handleUploadMouseLeave(field: CrudFieldConfig) {
  if (hoveredImageUploadTarget.value?.field.key === field.key) {
    hoveredImageUploadTarget.value = null;
  }
}

function handleUploadAreaMouseMove(field: CrudFieldConfig, event: MouseEvent) {
  if (!isImageUploadField(field) || isFormFieldInteractionDisabled(field)) {
    return;
  }

  const target = event.target as Element | null;
  const isUploadSelectCard = !!target?.closest('.ant-upload-select');
  const isUploadListCard = !!target?.closest(
    '.ant-upload-list-item, .ant-upload-list-picture-card-container',
  );

  if (!isUploadSelectCard && !isUploadListCard) {
    handleUploadMouseLeave(field);
    return;
  }

  if (isUploadSelectCard) {
    hoveredImageUploadTarget.value = {
      field,
      mode: 'append',
    };
  }

  handleUploadMouseMove(event);
}

function removeCrudUploadFile(field: CrudFieldConfig, file: UploadFile) {
  if (isFormFieldInteractionDisabled(field)) return false;
  setUploadUrls(
    field,
    getUploadUrls(field).filter((url) => url !== file.url),
  );
  return true;
}

function handleUploadPreview(file: UploadFile) {
  if (!file.url) {
    return;
  }

  if (isImageUrl(file.url)) {
    uploadPreviewUrl.value = file.url;
    uploadPreviewOpen.value = true;
    return;
  }

  window.open(file.url, '_blank');
}

function isImageUrl(url: string) {
  return /\.(?:bmp|gif|jpe?g|png|svg|webp)(?:\?.*)?$/i.test(url);
}

function getTableImageUrl(record: GenericRecord, key: unknown) {
  return getUploadUrlsFromValue(getRecordValue(record, key))[0] || '';
}

function getTableFileUrl(record: GenericRecord, key: unknown) {
  return getUploadUrlsFromValue(getRecordValue(record, key))[0] || '';
}

function renderUploadItem(
  field: CrudFieldConfig,
  originNode: any,
  file: UploadFile,
) {
  if (!isImageUploadField(field)) {
    return originNode;
  }

  return h(
    'div',
    {
      class: 'h-full w-full',
      onMouseenter: (event: MouseEvent) =>
        handleUploadMouseEnter(field, event, 'replace', file.url),
      onMouseleave: () => handleUploadMouseLeave(field),
      onMousemove: handleUploadMouseMove,
    },
    [originNode],
  );
}

function filterSelectOptionByLabel(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  const label = String(option?.label ?? '').toLowerCase();
  const value = String(option?.value ?? '').toLowerCase();

  return label.includes(keyword) || value.includes(keyword);
}

function isRemoteSearchField(field: CrudFieldConfig) {
  return !!field.remoteSearch && !!field.loadOptions;
}

function handleSelectSearch(field: CrudFieldConfig, keyword: string) {
  if (isFormFieldInteractionDisabled(field)) return;
  if (field.allowInput && !field.multiple) {
    formState[field.key] = keyword;
  }

  if (!isRemoteSearchField(field)) {
    return;
  }

  void loadFieldOptions(field, keyword);
}

function handleSearchSelectSearch(field: CrudFieldConfig, keyword: string) {
  if (isSearchFieldInteractionDisabled(field)) return;
  if (field.allowInput && !field.multiple) {
    searchState[field.key] = keyword;
  }

  if (!isRemoteSearchField(field)) {
    return;
  }

  void loadFieldOptions(field, keyword);
}

function restoreRemoteFieldOptions(field: CrudFieldConfig) {
  if (!shouldReloadRemoteOptionsOnDropdownOpen(field)) {
    return;
  }

  void loadFieldOptions(field, '');
}

function handleSelectDropdownVisibleChange(
  field: CrudFieldConfig,
  open: boolean,
) {
  if (!open) {
    return;
  }

  restoreRemoteFieldOptions(field);
}

function handleSelectChange(field: CrudFieldConfig, value: any) {
  if (isFormFieldInteractionDisabled(field)) return;
  if (!field.allowInput || field.multiple || value) {
    return;
  }

  formState[field.key] = undefined;
}

function handleSearchSelectChange(field: CrudFieldConfig, value: any) {
  if (isSearchFieldInteractionDisabled(field)) return;
  if (!field.allowInput || field.multiple || value) {
    return;
  }

  searchState[field.key] = undefined;
}

function formatCellValue(field: CrudFieldConfig, value: any) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const booleanDisplayText = getCrudBooleanDisplayText(field, value);
  if (booleanDisplayText) {
    return booleanDisplayText;
  }

  if (field.type === 'string-array' || field.type === 'tags') {
    return Array.isArray(value) ? value.join(', ') : String(value);
  }

  if (field.type === 'datetime' || field.type === 'date') {
    return String(value).replace('T', ' ');
  }

  if (field.type === 'json') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  if (
    field.type === 'area-cascader' ||
    field.key === 'areaCode' ||
    field.key === 'regionCode' ||
    /区域编码|行政编码|城市编码|区县编码/.test(field.label)
  ) {
    try {
      return formatAdministrativeArea(value);
    } catch {
      return String(value);
    }
  }

  const options = getFieldOptions(field);
  const matched = findMatchingCrudChoiceOption(field, value, options);

  return matched ? String(matched.label) : String(value);
}

function getCellDisplayText(field: CrudFieldConfig | undefined, value: any) {
  if (!field) {
    return '-';
  }

  if (
    field.type === 'string-array' ||
    field.type === 'tags' ||
    field.multiple
  ) {
    return getDisplayTagValues(field, value).join(', ') || '-';
  }

  return formatCellValue(field, value);
}

function getCodeEditorLanguage(field: CrudFieldConfig) {
  if (field.type === 'css') {
    return 'css';
  }

  if (field.type === 'html') {
    return 'html';
  }

  return 'text';
}

function isNumericField(field: CrudFieldConfig | undefined) {
  return !!field && (field.type === 'number' || field.valueType === 'number');
}

function isMoneyLikeField(field: CrudFieldConfig | undefined) {
  if (!isNumericField(field)) {
    return false;
  }

  return (
    /amount|balance|price|fee|rate|limit/i.test(field?.key || '') ||
    /金额|余额|价格|费率|额度|汇率/.test(field?.label || '')
  );
}

function formatNumericValue(field: CrudFieldConfig | undefined, value: any) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (field) {
    const matched = findMatchingCrudChoiceOption(
      field,
      value,
      getFieldOptions(field),
    );
    if (matched) {
      return String(matched.label);
    }
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return String(value);
  }

  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: isMoneyLikeField(field) ? 4 : 8,
  }).format(numberValue);
}

function isStatusLikeField(field: CrudFieldConfig | undefined) {
  if (!field) {
    return false;
  }

  return (
    isCrudBooleanField(field) ||
    (field.type === 'select' &&
      (/status|state/i.test(field.key) || /状态/.test(field.label)))
  );
}

function isBooleanEnableField(field: CrudFieldConfig | undefined) {
  return isCrudEnableBooleanField(field);
}

function canQuickUpdateBooleanEnableField(
  field: CrudFieldConfig | undefined,
  record: GenericRecord,
) {
  return isBooleanEnableField(field) && canShowBuiltinEdit(record);
}

function getStatusTagColor(field: CrudFieldConfig | undefined, value: any) {
  if (isCrudBooleanField(field) && typeof value === 'boolean') {
    return getCrudBooleanTagColor(value);
  }

  const text = String(formatCellValue(field || ({} as CrudFieldConfig), value));

  if (/成功|正常|启用|生效|已支付|完成|通过|发布|在线|可用/.test(text)) {
    return 'green';
  }

  if (/失败|禁用|停用|关闭|删除|异常|拒绝|过期|退款|错误/.test(text)) {
    return 'red';
  }

  if (/申请中|续期中|处理中|待|审核|未提交|草稿|离线|冻结/.test(text)) {
    return 'orange';
  }

  return 'blue';
}

function getStatusTagText(field: CrudFieldConfig | undefined, value: any) {
  const booleanDisplayText = getCrudBooleanDisplayText(field, value);
  if (booleanDisplayText) {
    return booleanDisplayText;
  }

  return formatCellValue(field!, value);
}

function shouldRenderStatusTag(field: CrudFieldConfig | undefined, value: any) {
  return !isCrudBooleanField(field) || typeof value === 'boolean';
}

function shouldShowActionLogTooltip(
  field: CrudFieldConfig | undefined,
  record: GenericRecord,
) {
  return (
    isStatusLikeField(field) &&
    shouldRenderStatusTag(field, getRecordValue(record, field?.key)) &&
    hasDisplayableActionLog(record.actionLog)
  );
}

function getActionLogTooltipItems(record: GenericRecord) {
  return buildActionLogTooltipItems(record.actionLog);
}

function isLinkField(field: CrudFieldConfig | undefined, value: any) {
  if (!field || value === null || value === undefined || value === '') {
    return false;
  }

  return (
    /(?:url|link)$/i.test(field.key) ||
    /链接|入口|回调|网址/.test(field.label) ||
    /^https?:\/\//i.test(String(value))
  );
}

function getTableField(key: unknown) {
  if (typeof key !== 'string') {
    return undefined;
  }

  return tableFieldMap.value[key];
}

function getRecordValue(record: GenericRecord, key: unknown) {
  if (typeof key !== 'string') {
    return undefined;
  }

  let current: any = record;
  for (const path of key.split('.')) {
    current = current?.[path];
  }

  return current;
}

function getTableFieldValue(field: CrudFieldConfig, record: GenericRecord) {
  return typeof field.tableValue === 'function'
    ? field.tableValue(record)
    : getRecordValue(record, field.key);
}

function getTableCellValue(record: GenericRecord, key: unknown) {
  const field = getTableField(key);

  if (!field) {
    return getRecordValue(record, key);
  }

  const display = getPageDisplayHeader(field.key)?.valueDisplay;
  if (display?.mode === 'script' && display.expression) {
    try {
      return evaluateJavaScriptExpression(display.expression, {
        org: buildOrganizationScriptContext(
          userStore.userInfo as Record<string, any> | undefined,
        ),
        row: record,
        tenant: getTenantScriptContext(),
        user: userStore.userInfo || {},
      });
    } catch (error) {
      console.warn(`列表值展示脚本执行失败：${field.key}`, error);
      return '';
    }
  }

  return getTableFieldValue(field, record);
}

function hasCustomTableCellDisplay(key: unknown) {
  return getTableField(key)
    ? getPageDisplayHeader(getTableField(key)!.key)?.valueDisplay?.mode ===
        'script'
    : false;
}

function getTagValues(value: any) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDisplayTagValues(field: CrudFieldConfig | undefined, value: any) {
  const values = getTagValues(value);
  if (!field) {
    return values;
  }

  const options = getFieldOptions(field);
  return values.map(
    (value) =>
      options.find((option) => String(option.value) === value)?.label || value,
  );
}

function getTagTooltipText(field: CrudFieldConfig | undefined, value: any) {
  return buildCrudCollectionTooltipText(getDisplayTagValues(field, value));
}

function getCellTooltipText(field: CrudFieldConfig | undefined, value: any) {
  const text = getCellDisplayText(field, value);

  if (!field || text === '-') {
    return text;
  }

  if (
    field.type === 'tags' ||
    field.type === 'string-array' ||
    field.multiple
  ) {
    return getTagTooltipText(field, value);
  }

  return buildCrudTooltipText(text);
}

function shouldTruncateCellText(
  field: CrudFieldConfig | undefined,
  value: any,
) {
  if (!field) {
    return false;
  }

  const text = getCellDisplayText(field, value);
  const overflowStrategy =
    getPageDisplayHeader(field.key)?.overflowStrategy ||
    pageDisplayConfig.value.list?.defaultOverflowStrategy;
  return (
    field.cellSingleLine ||
    [
      'code',
      'css',
      'html',
      'json',
      'string-array',
      'tags',
      'textarea',
    ].includes(field.type || '') ||
    (overflowStrategy !== 'wrap' && text.length > 28)
  );
}

function shouldUseCellTooltip(field: CrudFieldConfig | undefined, value: any) {
  return (
    field?.cellTooltip !== false &&
    shouldTruncateCellText(field, value) &&
    getCellDisplayText(field, value) !== '-'
  );
}

function getTenantDisplay(record: GenericRecord) {
  const tenant = record.tenant || record.ownerTenant || {};
  const name = String(record.tenantName || tenant.name || '').trim();
  const id = String(record.tenantId || tenant.id || '').trim();

  if (!name && !id) {
    return {
      id: '',
      name: '-',
    };
  }

  if (!name || name === id) {
    return {
      id: '',
      name: name || id,
    };
  }

  return {
    id,
    name,
  };
}

function getSupportEventsByCurrentStatus(record: GenericRecord) {
  const events = record.supportEventsByCurrentStatus;
  return Array.isArray(events)
    ? events.filter((event): event is string => typeof event === 'string')
    : undefined;
}

const flowEventNames = new Set([
  '编辑',
  '提交审核',
  '审核拒绝',
  '审核通过',
  '发布',
  '下线',
  '存档',
  '删除',
]);
const rejectReasonActionNames = new Set(['审核拒绝']);

function canUseCurrentStatusEvent(record: GenericRecord, eventName: string) {
  const events = getSupportEventsByCurrentStatus(record);
  return (
    events === undefined ||
    !flowEventNames.has(eventName) ||
    events.includes(eventName)
  );
}

function getRowActions(record: GenericRecord) {
  return actionGroups.value.row.filter(
    (action) =>
      (!action.permission || hasPermission(action.permission)) &&
      canUseCurrentStatusEvent(record, action.label) &&
      evaluateCrudVisibleOn(action.visibleOn, record, userStore.userInfo) &&
      (action.visible ? action.visible(record) : true),
  );
}

function getActionBadgeCount(action: CrudRowAction, record: GenericRecord) {
  const count = action.badgeCount?.(record) || 0;
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function getToolbarActions() {
  return actionGroups.value.toolbar.filter(
    (action) =>
      (!action.permission || hasPermission(action.permission)) &&
      evaluateCrudVisibleOn(action.visibleOn, {}, userStore.userInfo) &&
      (action.visible ? action.visible({}) : true),
  );
}

function getBatchActions() {
  return actionGroups.value.batch.filter(
    (action) =>
      (!action.permission || hasPermission(action.permission)) &&
      selectedRows.value.length > 0 &&
      evaluateCrudVisibleOn(
        action.visibleOn,
        selectedRows.value[0] || {},
        userStore.userInfo,
      ) &&
      (action.visible ? action.visible(selectedRows.value[0] || {}) : true),
  );
}

function getActionConfirm(action: CrudRowAction) {
  return buildCrudConfirmConfig(action.confirmText, action.confirmTitle);
}

function getActionRecordTitle(record: GenericRecord | GenericRecord[]) {
  if (Array.isArray(record)) {
    return `选中的 ${record.length} 条记录`;
  }

  return String(record.title || record.name || record.id || '当前记录').trim();
}

function appendOperatorAction(
  record: GenericRecord | GenericRecord[],
  operatorAction: string,
) {
  if (Array.isArray(record)) {
    return record.map((item) => ({
      ...item,
      _operatorAction: operatorAction,
    }));
  }

  return {
    ...record,
    _operatorAction: operatorAction,
  };
}

function requestRejectReason(
  action: CrudRowAction,
  record: GenericRecord | GenericRecord[],
) {
  if (!rejectReasonActionNames.has(action.label)) {
    return Promise.resolve<null | string>(null);
  }

  return new Promise<null | string>((resolve) => {
    let reason = '';

    Modal.confirm({
      cancelText: '取消',
      content: h('div', { class: 'grid gap-2' }, [
        h(
          'div',
          { class: 'text-sm text-muted-foreground' },
          `请输入「${getActionRecordTitle(record)}」的拒绝原因。`,
        ),
        h(Input.TextArea, {
          autofocus: true,
          defaultValue: reason,
          maxlength: 500,
          onChange: (event: Event) => {
            reason = (event.target as HTMLTextAreaElement | null)?.value || '';
          },
          onInput: (event: Event) => {
            reason = (event.target as HTMLTextAreaElement | null)?.value || '';
          },
          placeholder: '请输入拒绝原因',
          rows: 4,
          showCount: true,
        }),
      ]),
      okText: '确认拒绝',
      title: action.confirmTitle || '审核拒绝',
      async onOk() {
        const normalizedReason = reason.trim();

        if (!normalizedReason) {
          message.warning('请输入拒绝原因');
          return Promise.reject(new Error('REJECT_REASON_REQUIRED'));
        }

        resolve(normalizedReason);
      },
      onCancel() {
        resolve(null);
      },
    });
  });
}

function canShowBuiltinEdit(record: GenericRecord) {
  return (
    canEdit.value &&
    canMutateCrudRecord(record) &&
    canUseCurrentStatusEvent(record, '编辑') &&
    (!props.config.editVisibleOn ||
      evaluateCrudVisibleOn(
        props.config.editVisibleOn,
        record,
        userStore.userInfo,
      ))
  );
}

function canMutateCrudRecord(record: GenericRecord) {
  return canMutateEditableCrudRecord(
    props.config.fields,
    record,
    userStore.userInfo,
  );
}

function getQuickSwitchLoadingKey(record: GenericRecord, fieldKey: unknown) {
  return `${String(getRecordValue(record, recordKey.value) ?? '')}:${String(
    fieldKey,
  )}`;
}

async function updateBooleanEnableField(
  record: GenericRecord,
  field: CrudFieldConfig,
  checked: boolean,
) {
  const fieldKey = String(field.key);
  const loadingKey = getQuickSwitchLoadingKey(record, fieldKey);
  const previousValue = Boolean(record[fieldKey]);

  quickSwitchLoadingState[loadingKey] = true;
  record[fieldKey] = checked;

  try {
    const payload = {
      autoForceUpdateField: false,
      [recordKey.value]: getRecordValue(record, recordKey.value),
      optimisticLock: record.optimisticLock,
      [fieldKey]: checked,
    };

    if (props.config.apiService?.update && !props.config.updatePath) {
      await props.config.apiService.update(payload);
    } else {
      await updateCrudRecord(
        props.config.updatePath || `${props.config.apiBase}/update`,
        payload,
        props.config.apiModuleBase,
      );
    }
    message.success('更新成功');
    await loadList();
  } catch (error) {
    record[fieldKey] = previousValue;
    console.error(error);
    message.error(getCrudErrorMessage(error, '更新失败'));
  } finally {
    quickSwitchLoadingState[loadingKey] = false;
  }
}

function canShowBuiltinDetail(record: GenericRecord) {
  return (
    canRetrieve.value &&
    (!props.config.detailVisibleOn ||
      evaluateCrudVisibleOn(
        props.config.detailVisibleOn,
        record,
        userStore.userInfo,
      ))
  );
}

function canShowBuiltinDelete(record: GenericRecord) {
  return (
    canDelete.value &&
    canMutateCrudRecord(record) &&
    canUseCurrentStatusEvent(record, '删除') &&
    (!props.config.deleteVisibleOn ||
      evaluateCrudVisibleOn(
        props.config.deleteVisibleOn,
        record,
        userStore.userInfo,
      ))
  );
}

function openActionResult(
  title: string,
  mode: NormalizedCrudAction,
  data: any,
) {
  actionResultMode.value = mode;
  actionResultTitle.value = title;
  actionResultData.value = data;
  actionResultOpen.value = true;
}

const detailSettingsFields = computed(() => resolveDetailFields(
  latestDetailRecord.value?.source === pageDisplaySettingCode.value
    ? latestDetailRecord.value.record
    : dataSource.value[0],
  props.config.fields,
  props.config.detailFields,
));

function getDetailDisplayFields() {
  return applyPageDisplayFields(resolveDetailFields(actionResultData.value, props.config.fields, props.config.detailFields), 'detail').map(field => ({...field, options:getFieldOptions(field)}));
}

const actionResultEntries = computed((): DetailDisplayEntry[] => {
  const data = actionResultData.value;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [];
  }

  return buildDetailDisplayEntries(
    data,
    getDetailDisplayFields(),
    [...props.config.fields, ...resolveDetailFields(actionResultData.value, props.config.fields, props.config.detailFields)],
    pageDisplayConfig.value.detail?.showEmptyValues !== false,
  ) as DetailDisplayEntry[];
});

const actionResultQrValue = computed(() => {
  const data = actionResultData.value;
  if (typeof data === 'string') {
    return data;
  }

  if (data && typeof data === 'object') {
    return data.qrCode || data.mfaQrCode || data.url || data.value || '';
  }

  return '';
});

const actionResultMediaUrl = computed(() => {
  const data = actionResultData.value;

  if (typeof data === 'string') {
    return data;
  }

  if (data && typeof data === 'object') {
    return (
      data.image ||
      data.imageUrl ||
      data.video ||
      data.videoUrl ||
      data.iframeUrl ||
      data.link ||
      data.src ||
      data.url ||
      ''
    );
  }

  return '';
});

const detailModalConfig = computed(() => pageDisplayConfig.value.detail);

async function runRowAction(
  action: CrudRowAction,
  record: GenericRecord | GenericRecord[],
) {
  if (!action) {
    return;
  }

  if (action.permission && !hasPermission(action.permission)) {
    message.warning('没有权限执行该操作');
    return;
  }

  const rejectReason = await requestRejectReason(action, record);
  if (rejectReasonActionNames.has(action.label) && !rejectReason) {
    return;
  }

  try {
    const actionPayload = rejectReason
      ? appendOperatorAction(record, rejectReason)
      : record;
    const response = await action.handler(actionPayload);
    const resultAction = resolveCrudActionAfterSuccess(
      action.action,
      action.successAction,
    );
    const resultData = pickCrudActionResultData(
      response,
      action.resultActionData,
    );

    if (action.successMessage !== false) {
      message.success(action.successMessage || `${action.label}成功`);
    }

    switch (resultAction) {
      case 'copy': {
        await navigator.clipboard?.writeText(
          typeof resultData === 'string'
            ? resultData
            : JSON.stringify(resultData),
        );
        message.success('已复制到剪贴板');

        break;
      }
      case 'link': {
        window.open(String(resultData || ''), '_blank');

        break;
      }
      case 'url': {
        window.location.href = String(resultData || '');

        break;
      }
      default: {
        if (
          [
            'showForm',
            'showIFrame',
            'showImage',
            'showQrCode',
            'showSchema',
            'showVideo',
          ].includes(resultAction)
        ) {
          openActionResult(action.label, resultAction, resultData);
        }
      }
    }

    if (
      action.reloadAfterAction !== false &&
      shouldReloadDataListAfterAction(action.action, action.successAction)
    ) {
      await loadList();
    }
  } catch (error) {
    console.error(error);
    message.error(getCrudErrorMessage(error, `${action.label}失败`));
  }
}

onMounted(async () => {
  window.addEventListener('resize', handleViewportResize);
  window.addEventListener('paste', handlePasteUpload);
  applyEditableSearchDefault();
  await loadPageDisplaySettings();
  loadTableColumnPreference();
  applyPageDisplayQueryDefaults();
  await loadOptions();
  await loadList();
  autoSearchReady.value = true;
  await nextTick();
  restoreListTableTabsPosition();

  if (typeof ResizeObserver !== 'undefined' && listSectionRef.value) {
    listSectionResizeObserver = new ResizeObserver(updateTableScrollY);
    listSectionResizeObserver.observe(listSectionRef.value);
  }

  if (typeof ResizeObserver !== 'undefined' && searchPanelRef.value) {
    searchPanelResizeObserver = new ResizeObserver(updateSearchPanelWidth);
    searchPanelResizeObserver.observe(searchPanelRef.value);
  }

  updateSearchPanelWidth();
  updateTableScrollY();
});

onUnmounted(() => {
  clearSingleTextQueryAutoSearchTimer();
  window.removeEventListener('resize', handleViewportResize);
  window.removeEventListener('paste', handlePasteUpload);
  stopListTableTabsDrag();
  listSectionResizeObserver?.disconnect();
  listSectionResizeObserver = null;
  searchPanelResizeObserver?.disconnect();
  searchPanelResizeObserver = null;
});

watch(modalOpen, (open) => {
  if (!open) {
    hoveredImageUploadTarget.value = null;
  }
});

watch(columnSettingsOpen, (open) => {
  if (open) {
    if (!canCustomizeTableColumnsLocally.value) {
      columnSettingsOpen.value = false;
      return;
    }

    openTableColumnSettings();
  }
});

watch(
  listTables,
  (tables) => {
    if (tables.length === 0) {
      ensureListTableState('default');
      restoreListTableState('default');
      return;
    }

    for (const table of tables) {
      ensureListTableState(table.key);
    }

    if (!tables.some((table) => table.key === activeListTableKey.value)) {
      activeListTableKey.value = tables[0]?.key || '';
      restoreListTableState(activeListTableKey.value);
    }
  },
  { immediate: true },
);

watch([searchExpanded, searchFieldItems, tableFullscreen], updateTableScrollY);

watch(tableFields, () => {
  if (!canCustomizeTableColumnsLocally.value) {
    return;
  }

  const changed = pruneTableColumnPreference();

  if (changed) {
    saveTableColumnPreference();
  }
});

watch(tableColumnPreferenceStorageKey, () => {
  loadTableColumnPreference();
  updateTableScrollY();
});

watch(canCustomizeTableColumnsLocally, () => {
  loadTableColumnPreference();
  updateTableScrollY();
});
</script>

<template>
  <Page
    :auto-content-height="!embedded"
    :class="embedded ? '!min-h-0 flex-1' : undefined"
    :content-class="
      embedded
        ? 'flex min-h-0 flex-1 flex-col !bg-transparent min-w-0 !overflow-hidden !p-0'
        : '!bg-transparent min-w-0 !overflow-hidden !p-0'
    "
  >
    <div
      ref="crudPageRef"
      class="vben-crud-page relative flex h-full flex-col gap-2"
    >
      <div
        v-if="hasListTableTabs"
        ref="listTableTabsRef"
        class="vben-crud-list-tabs-float"
        :class="{
          'is-collapsed': listTableTabsCollapsed,
          'is-dragging': isDraggingListTableTabs,
        }"
        :style="listTableTabsFloatStyle"
      >
        <Tooltip
          :mouse-enter-delay="1.5"
          :mouse-leave-delay="0"
          :open="listTableTabsHandleTooltipOpen"
          placement="right"
          @open-change="handleListTableTabsTooltipOpenChange"
        >
          <template #title>
            <div class="max-w-80">
              <div class="font-medium leading-5">
                {{ listTableTabsHandleName }}
              </div>
              <div class="mt-0.5 text-xs leading-5 opacity-90">
                {{ listTableTabsHandleActionLabel }}
              </div>
            </div>
          </template>
          <button
            :aria-label="listTableTabsHandleLabel"
            :aria-pressed="listTableTabsCollapsed"
            class="vben-crud-list-tabs-handle"
            type="button"
            @pointerdown.stop="handleListTableTabsPointerDown"
          >
            <IconifyIcon class="size-3.5" icon="lucide:grip" />
          </button>
        </Tooltip>
        <Tabs
          v-if="!listTableTabsCollapsed"
          :active-key="activeListTableKey"
          class="vben-crud-list-tabs"
          size="small"
          tab-position="left"
          @change="handleListTableChange"
        >
          <Tabs.TabPane
            v-for="(table, index) in listTables"
            :key="table.key"
            :tab="getListTableTitle(table, index)"
          />
        </Tabs>
      </div>

      <div
        v-if="searchFieldItems.length > 0"
        ref="searchPanelRef"
        class="vben-crud-section"
      >
        <Form :label-col="{ style: { width: '88px' } }">
          <div class="grid gap-x-4 gap-y-4" :style="searchGridStyle">
            <Form.Item
              v-for="item in visibleSearchFieldItems"
              :key="item.key"
              :label="item.kind === 'range' ? item.label : item.field.label"
              class="mb-0 min-w-0"
              :style="getSearchItemStyle(item)"
            >
              <div
                v-if="item.kind === 'field' && hasSearchFieldSlot(item.field)"
                :inert="isSearchFieldInteractionDisabled(item.field)"
              >
                <slot
                  :name="resolveSearchFieldSlotName(item.field)"
                  :field="item.field"
                  :search-state="isSearchFieldInteractionDisabled(item.field) ? readonly(searchState) : searchState"
                  :disabled="isSearchFieldInteractionDisabled(item.field)"
                ></slot>
              </div>
              <DatePicker.RangePicker
                v-else-if="item.kind === 'range' && item.format !== 'time'"
                :value="searchState[item.key]"
                :disabled="getSearchRangeDisabled(item)"
                @update:value="updateSearchRangeInput(item, $event)"
                :allow-clear="true"
                class="w-full"
                :placeholder="['开始时间', '结束时间']"
                :show-time="item.format === 'datetime'"
                :value-format="
                  item.format === 'datetime'
                    ? 'YYYY-MM-DDTHH:mm:ss'
                    : 'YYYY-MM-DD'
                "
              />
              <TimePicker.RangePicker
                v-else-if="item.kind === 'range'"
                :value="searchState[item.key]"
                :disabled="getSearchRangeDisabled(item)"
                @update:value="updateSearchRangeInput(item, $event)"
                :allow-clear="true"
                class="w-full"
                :placeholder="['开始时间', '结束时间']"
                value-format="HH:mm:ss"
              />
              <Checkbox.Group
                v-else-if="
                  shouldUseInlineChoiceOptions(item.field, 'query') &&
                  item.field.multiple
                "
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :options="getInlineChoiceOptions(item.field, 'query')"
                class="flex flex-wrap gap-x-3 gap-y-2"
              />
              <Radio.Group
                v-else-if="shouldUseInlineChoiceOptions(item.field, 'query')"
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :options="getInlineChoiceOptions(item.field, 'query')"
                class="flex flex-wrap gap-2"
                option-type="button"
              />
              <Cascader
                v-else-if="item.field.type === 'area-cascader'"
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :allow-clear="true"
                :change-on-select="
                  !isAreaCascaderLevelRestricted(item.field, searchState)
                "
                :loading="optionLoadingState[item.field.key]"
                :options="getFieldOptions(item.field, searchState)"
                :placeholder="getPlaceholder(item.field)"
                class="w-full"
                show-search
                @dropdown-visible-change="
                  (open) =>
                    handleAreaCascaderDropdownVisibleChange(
                      item.field,
                      open,
                      searchState,
                    )
                "
              />
              <TreeSelect
                v-else-if="item.field.type === 'org-tree-select'"
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :allow-clear="true"
                class="w-full"
                :loading="optionLoadingState[item.field.key]"
                :multiple="Boolean(item.field.multiple)"
                :placeholder="getPlaceholder(item.field)"
                show-search
                :tree-checkable="Boolean(item.field.multiple)"
                :tree-data="getFieldOptions(item.field)"
                tree-default-expand-all
                tree-node-filter-prop="label"
                @blur="() => restoreRemoteFieldOptions(item.field)"
                @dropdown-visible-change="
                  (open) => handleSelectDropdownVisibleChange(item.field, open)
                "
              />
              <AutoComplete
                v-else-if="
                  (item.field.type === 'select' ||
                    item.field.type === 'role-select') &&
                  item.field.allowInput &&
                  !item.field.multiple
                "
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :allow-clear="true"
                :options="getFieldOptions(item.field)"
                :placeholder="getPlaceholder(item.field)"
                :filter-option="
                  isRemoteSearchField(item.field)
                    ? false
                    : filterSelectOptionByLabel
                "
                :loading="optionLoadingState[item.field.key]"
                class="w-full"
                @blur="() => restoreRemoteFieldOptions(item.field)"
                @dropdown-visible-change="
                  (open) => handleSelectDropdownVisibleChange(item.field, open)
                "
                @search="handleSearchSelectSearch(item.field, $event)"
              />
              <Select
                v-else-if="
                  item.field.type === 'select' ||
                  item.field.type === 'role-select'
                "
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :allow-clear="true"
                :mode="item.field.multiple ? 'multiple' : undefined"
                :options="getFieldOptions(item.field)"
                :placeholder="getPlaceholder(item.field)"
                :filter-option="
                  isRemoteSearchField(item.field)
                    ? false
                    : filterSelectOptionByLabel
                "
                :loading="optionLoadingState[item.field.key]"
                class="w-full"
                show-search
                @blur="() => restoreRemoteFieldOptions(item.field)"
                @change="(value) => handleSearchSelectChange(item.field, value)"
                @dropdown-visible-change="
                  (open) => handleSelectDropdownVisibleChange(item.field, open)
                "
                @search="handleSearchSelectSearch(item.field, $event)"
              />
              <Select
                v-else-if="item.field.type === 'switch'"
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :allow-clear="true"
                :options="[
                  { label: '是', value: 'true' },
                  { label: '否', value: 'false' },
                ]"
                :placeholder="getPlaceholder(item.field)"
                class="w-full"
              />
              <DatePicker
                v-else-if="
                  item.field.type === 'datetime' || item.field.type === 'date'
                "
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :allow-clear="true"
                class="w-full"
                :placeholder="getPlaceholder(item.field)"
                :show-time="item.field.type === 'datetime'"
                :value-format="
                  item.field.type === 'datetime'
                    ? 'YYYY-MM-DDTHH:mm:ss'
                    : 'YYYY-MM-DD'
                "
              />
              <TimePicker
                v-else-if="item.field.type === 'time'"
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :allow-clear="true"
                class="w-full"
                :placeholder="getPlaceholder(item.field)"
                value-format="HH:mm:ss"
              />
              <InputNumber
                v-else-if="item.field.type === 'number'"
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                :allow-clear="true"
                :placeholder="getPlaceholder(item.field)"
                class="w-full"
              />
              <Input
                v-else
                :value="getInteractionModelValue(searchState[item.field.key], isSearchFieldInteractionDisabled(item.field))"
                :disabled="isSearchFieldInteractionDisabled(item.field)"
                @update:value="updateSearchFieldInput(item.field, $event)"
                allow-clear
                :maxlength="item.field.maxLength"
                :placeholder="getPlaceholder(item.field)"
                class="w-full"
                @press-enter="
                  singleTextQueryAutoSearchEnabled &&
                  handleSingleTextQuerySearchEnter()
                "
              />
            </Form.Item>
            <div class="vben-crud-search-actions min-w-0">
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Button
                  v-if="
                    shouldShowManualQueryButton(
                      canQuery,
                      autoSearchEnabled || singleTextQueryAutoSearchEnabled,
                    )
                  "
                  type="primary"
                  @click="
                    () => {
                      pagination.current = 1;
                      loadList();
                    }
                  "
                >
                  查询
                </Button>
                <Button
                  v-if="!singleTextQueryAutoSearchEnabled"
                  @click="resetSearch"
                >
                  重置
                </Button>
                <Button
                  v-if="showAdvancedSearchToggle"
                  type="link"
                  :aria-expanded="searchExpanded"
                  @click="toggleSearchExpanded"
                >
                  <template #icon>
                    <ChevronDown
                      class="vben-crud-toggle-icon"
                      :class="{ 'is-expanded': searchExpanded }"
                      aria-hidden="true"
                    />
                  </template>
                  {{ searchExpanded ? '收起' : '展开' }}
                </Button>
              </div>
            </div>
          </div>
        </Form>
      </div>

      <div
        ref="listSectionRef"
        class="vben-crud-section flex min-h-0 flex-1 flex-col overflow-hidden"
        :class="{ 'vben-crud-section--fullscreen': tableFullscreen }"
      >
        <div
          ref="listToolbarRef"
          class="mb-3 flex flex-wrap items-center gap-2"
        >
          <div class="flex flex-wrap items-center gap-2">
            <Button v-if="canCreate" type="primary" @click="handleCreate">
              <Plus class="size-4" />
              新增
            </Button>
            <slot
              name="toolbar-extra"
              :editing-record="editingRecord"
              :form-state="formState"
              :load-list="loadList"
            ></slot>
            <Button
              v-for="action in getToolbarActions()"
              :key="action.label"
              :danger="action.danger"
              @click="runRowAction(action, {})"
            >
              {{ action.label }}
            </Button>
            <template v-for="action in getBatchActions()" :key="action.label">
              <Popconfirm
                v-if="getActionConfirm(action).enabled"
                :description="getActionConfirm(action).text"
                :title="getActionConfirm(action).title"
                @confirm="runRowAction(action, selectedRows)"
              >
                <Button :danger="action.danger">
                  {{ action.label }}（{{ selectedRows.length }}）
                </Button>
              </Popconfirm>
              <Button
                v-else
                :danger="action.danger"
                @click="runRowAction(action, selectedRows)"
              >
                {{ action.label }}（{{ selectedRows.length }}）
              </Button>
            </template>
          </div>

          <Space class="ml-auto" :size="8">
            <Tooltip title="导出">
              <Button
                v-if="canQuery"
                aria-label="导出"
                class="vben-crud-table-tool-button"
                shape="circle"
                :disabled="exportableFields.length === 0 || exportLimitChecking"
                :loading="exportLimitChecking"
                @click="openExportModal"
              >
                <template #icon>
                  <IconifyIcon class="size-4" icon="lucide:upload" />
                </template>
              </Button>
            </Tooltip>

            <Tooltip title="导入">
              <Button
                v-if="canImport"
                aria-label="导入"
                class="vben-crud-table-tool-button"
                shape="circle"
                @click="openImportModal"
              >
                <IconifyIcon class="size-4" icon="lucide:download" />
              </Button>
            </Tooltip>

            <Tooltip title="刷新">
              <Button
                aria-label="刷新"
                class="vben-crud-table-tool-button"
                shape="circle"
                :loading="loading"
                @click="refreshTable"
              >
                <template #icon>
                  <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
                </template>
              </Button>
            </Tooltip>

            <Tooltip v-if="canManagePageDisplaySettings" title="页面展示设置">
              <Button
                aria-label="页面展示设置"
                class="vben-crud-table-tool-button"
                shape="circle"
                @click="pageDisplaySettingsOpen = true"
              >
                <template #icon>
                  <IconifyIcon class="size-4" icon="lucide:panel-top" />
                </template>
              </Button>
            </Tooltip>

            <Tooltip :title="tableFullscreen ? '退出全屏' : '全屏'">
              <Button
                :aria-label="tableFullscreen ? '退出全屏' : '全屏'"
                class="vben-crud-table-tool-button"
                shape="circle"
                @click="toggleTableFullscreen"
              >
                <IconifyIcon
                  class="size-4"
                  :icon="
                    tableFullscreen ? 'lucide:minimize-2' : 'lucide:maximize-2'
                  "
                />
              </Button>
            </Tooltip>

            <Popover
              v-if="canCustomizeTableColumnsLocally"
              v-model:open="columnSettingsOpen"
              placement="bottomRight"
              trigger="click"
              overlay-class-name="vben-crud-column-popover"
            >
              <template #content>
                <div class="w-[380px] max-w-[80vw]">
                  <div class="border-border mb-2 border-b pb-2">
                    <Checkbox
                      :checked="allDraftTableColumnsVisible"
                      :indeterminate="draftTableColumnsIndeterminate"
                      @change="
                        (event) =>
                          setAllDraftTableColumnsVisible(event.target.checked)
                      "
                    >
                      全部
                    </Checkbox>
                  </div>
                  <div class="flex max-h-96 flex-col overflow-auto">
                    <div
                      v-for="field in tableFields"
                      :key="field.key"
                      class="vben-crud-column-setting-row"
                    >
                      <Checkbox
                        :checked="isDraftTableColumnVisible(field.key)"
                        @change="
                          (event) =>
                            setDraftTableColumnVisible(
                              field.key,
                              event.target.checked,
                            )
                        "
                      >
                        {{ field.label }}
                      </Checkbox>
                    </div>
                  </div>
                  <div
                    class="border-border mt-3 flex items-center justify-between border-t pt-3"
                  >
                    <Button
                      type="link"
                      class="p-0"
                      :disabled="!hasStoredTableColumnPreference"
                      @click="resetTableColumns"
                    >
                      清空设置
                    </Button>
                    <Space>
                      <Button size="small" @click="cancelTableColumnSettings">
                        取消
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        @click="applyTableColumnSettings"
                      >
                        保存
                      </Button>
                    </Space>
                  </div>
                </div>
              </template>
              <Button
                aria-label="列设置"
                class="vben-crud-table-tool-button"
                shape="circle"
                title="列设置"
              >
                <IconifyIcon class="size-4" icon="lucide:settings-2" />
              </Button>
            </Popover>
          </Space>
        </div>

        <Table
          :columns="tableColumns"
          :data-source="dataSource"
          :loading="loading"
          :pagination="{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showTotal: renderPaginationTotal,
            showSizeChanger: true,
            total: pagination.total,
          }"
          :row-selection="rowSelection"
          :scroll="{ x: 'max-content', y: tableScrollY }"
          :row-key="recordKey"
          @change="handleTableChange"
          class="vben-crud-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="hasTableCellSlot(column.key)">
              <slot
                :name="resolveTableCellSlotName(column.key)"
                :column="column"
                :field="getTableField(column.key)"
                :record="record"
                :value="getTableCellValue(record, column.key)"
              ></slot>
            </template>
            <template v-else-if="column.key === '__actions'">
              <Space :size="4" wrap>
                <Button
                  v-if="canShowBuiltinDetail(record)"
                  size="small"
                  type="link"
                  @click="handleRetrieve(record)"
                >
                  详情
                </Button>
                <Button
                  v-if="canShowBuiltinEdit(record)"
                  size="small"
                  type="link"
                  @click="handleEdit(record)"
                >
                  编辑
                </Button>
                <slot
                  name="row-actions"
                  :record="record"
                  :reload="loadList"
                ></slot>
                <Popconfirm
                  v-if="canShowBuiltinDelete(record)"
                  title="确认删除当前记录吗？"
                  @confirm="handleDelete(record)"
                >
                  <Button danger size="small" type="link">删除</Button>
                </Popconfirm>
                <template
                  v-for="action in getRowActions(record)"
                  :key="action.label"
                >
                  <Popconfirm
                    v-if="getActionConfirm(action).enabled"
                    :description="getActionConfirm(action).text"
                    :title="getActionConfirm(action).title"
                    @confirm="runRowAction(action, record)"
                  >
                    <Button :danger="action.danger" size="small" type="link">
                      <span class="vben-crud-row-action-content">
                        <span>{{ action.label }}</span>
                        <span
                          v-if="getActionBadgeCount(action, record) > 0"
                          class="vben-crud-row-action-badge"
                        >
                          {{ getActionBadgeCount(action, record) }}
                        </span>
                      </span>
                    </Button>
                  </Popconfirm>
                  <Button
                    v-else
                    :danger="action.danger"
                    size="small"
                    type="link"
                    @click="runRowAction(action, record)"
                  >
                    <span class="vben-crud-row-action-content">
                      <span>{{ action.label }}</span>
                      <span
                        v-if="getActionBadgeCount(action, record) > 0"
                        class="vben-crud-row-action-badge"
                      >
                        {{ getActionBadgeCount(action, record) }}
                      </span>
                    </span>
                  </Button>
                </template>
              </Space>
            </template>
            <template v-else>
              <pre
                v-if="hasCustomTableCellDisplay(column.key)"
                class="m-0 whitespace-pre-wrap break-words text-sm leading-6"
                >{{ getTableCellValue(record, column.key) }}</pre
              >
              <Switch
                v-else-if="
                  canQuickUpdateBooleanEnableField(
                    getTableField(column.key),
                    record,
                  )
                "
                :checked="Boolean(getRecordValue(record, column.key))"
                :loading="
                  quickSwitchLoadingState[
                    getQuickSwitchLoadingKey(record, column.key)
                  ]
                "
                checked-children="启用"
                un-checked-children="禁用"
                @change="
                  (checked) =>
                    updateBooleanEnableField(
                      record,
                      getTableField(column.key)!,
                      Boolean(checked),
                    )
                "
              />
              <Tooltip
                v-else-if="
                  shouldShowActionLogTooltip(getTableField(column.key), record)
                "
                :mouse-enter-delay="CRUD_TOOLTIP_MOUSE_ENTER_DELAY"
                overlay-class-name="vben-crud-action-log-tooltip"
              >
                <template #title>
                  <div class="vben-crud-action-log-tooltip-content">
                    <div
                      v-for="item in getActionLogTooltipItems(record)"
                      :key="item.key"
                      class="vben-crud-action-log-tooltip-item"
                    >
                      <div
                        v-for="row in item.rows"
                        :key="`${item.key}-${row.label}`"
                        class="vben-crud-action-log-tooltip-row"
                      >
                        <span class="vben-crud-action-log-tooltip-label">
                          {{ row.label }}
                        </span>
                        <span class="vben-crud-action-log-tooltip-value">
                          {{ row.value }}
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
                <Tag
                  :color="
                    getStatusTagColor(
                      getTableField(column.key),
                      getRecordValue(record, column.key),
                    )
                  "
                >
                  {{
                    getStatusTagText(
                      getTableField(column.key),
                      getRecordValue(record, column.key),
                    )
                  }}
                </Tag>
              </Tooltip>
              <Tag
                v-else-if="
                  isStatusLikeField(getTableField(column.key)) &&
                  shouldRenderStatusTag(
                    getTableField(column.key),
                    getRecordValue(record, column.key),
                  )
                "
                :color="
                  getStatusTagColor(
                    getTableField(column.key),
                    getRecordValue(record, column.key),
                  )
                "
              >
                {{
                  getStatusTagText(
                    getTableField(column.key),
                    getRecordValue(record, column.key),
                  )
                }}
              </Tag>
              <Image
                v-else-if="
                  isImageUploadField(getTableField(column.key)!) &&
                  getTableImageUrl(record, column.key)
                "
                :height="40"
                :src="getTableImageUrl(record, column.key)"
                :width="40"
                class="rounded object-cover"
              />
              <a
                v-else-if="
                  getTableField(column.key)?.type === 'file' &&
                  getTableFileUrl(record, column.key)
                "
                :href="getTableFileUrl(record, column.key)"
                rel="noopener noreferrer"
                target="_blank"
              >
                查看文件
              </a>
              <a
                v-else-if="
                  isLinkField(
                    getTableField(column.key),
                    getTableCellValue(record, column.key),
                  )
                "
                :href="String(getTableCellValue(record, column.key) || '')"
                rel="noopener noreferrer"
                target="_blank"
              >
                {{
                  formatCellValue(
                    getTableField(column.key)!,
                    getTableCellValue(record, column.key),
                  )
                }}
              </a>
              <div
                v-else-if="getTableField(column.key)?.type === 'tenant'"
                class="leading-5"
              >
                <div class="font-medium">
                  {{ getTenantDisplay(record).name }}
                </div>
                <div
                  v-if="getTenantDisplay(record).id"
                  class="text-muted-foreground text-xs"
                >
                  {{ getTenantDisplay(record).id }}
                </div>
              </div>
              <span
                v-else-if="isNumericField(getTableField(column.key))"
                class="inline-block min-w-[96px] text-right tabular-nums"
              >
                {{
                  formatNumericValue(
                    getTableField(column.key),
                    getTableCellValue(record, column.key),
                  )
                }}
              </span>
              <span v-else>
                <template
                  v-if="
                    getTableField(column.key)?.type === 'tags' ||
                    getTableField(column.key)?.multiple
                  "
                >
                  <Tooltip
                    v-if="
                      shouldUseCellTooltip(
                        getTableField(column.key),
                        getTableCellValue(record, column.key),
                      )
                    "
                    :mouse-enter-delay="CRUD_TOOLTIP_MOUSE_ENTER_DELAY"
                    overlay-class-name="vben-crud-cell-tooltip"
                    :title="
                      getCellTooltipText(
                        getTableField(column.key),
                        getTableCellValue(record, column.key),
                      )
                    "
                  >
                    <span
                      class="inline-block max-w-[240px] truncate align-bottom"
                    >
                      {{
                        getCellDisplayText(
                          getTableField(column.key),
                          getTableCellValue(record, column.key),
                        )
                      }}
                    </span>
                  </Tooltip>
                  <Space v-else :size="4" wrap>
                    <Tag
                      v-for="tag in getDisplayTagValues(
                        getTableField(column.key),
                        getTableCellValue(record, column.key),
                      ).slice(0, 3)"
                      :key="tag"
                    >
                      {{ tag }}
                    </Tag>
                    <Tooltip
                      v-if="
                        getDisplayTagValues(
                          getTableField(column.key),
                          getTableCellValue(record, column.key),
                        ).length > 3
                      "
                      :mouse-enter-delay="CRUD_TOOLTIP_MOUSE_ENTER_DELAY"
                      overlay-class-name="vben-crud-cell-tooltip"
                      :title="
                        getTagTooltipText(
                          getTableField(column.key),
                          getTableCellValue(record, column.key),
                        )
                      "
                    >
                      <Tag>...</Tag>
                    </Tooltip>
                  </Space>
                </template>
                <Tooltip
                  v-else-if="
                    shouldUseCellTooltip(
                      getTableField(column.key),
                      getTableCellValue(record, column.key),
                    )
                  "
                  :mouse-enter-delay="CRUD_TOOLTIP_MOUSE_ENTER_DELAY"
                  overlay-class-name="vben-crud-cell-tooltip"
                  :title="
                    getCellTooltipText(
                      getTableField(column.key),
                      getTableCellValue(record, column.key),
                    )
                  "
                >
                  <span
                    class="inline-block max-w-[240px] truncate align-bottom"
                  >
                    {{
                      getCellDisplayText(
                        getTableField(column.key),
                        getTableCellValue(record, column.key),
                      )
                    }}
                  </span>
                </Tooltip>
                <span
                  v-else-if="
                    shouldTruncateCellText(
                      getTableField(column.key),
                      getTableCellValue(record, column.key),
                    )
                  "
                  class="inline-block max-w-[240px] truncate align-bottom"
                >
                  {{
                    getCellDisplayText(
                      getTableField(column.key),
                      getTableCellValue(record, column.key),
                    )
                  }}
                </span>
                <template v-else>
                  {{
                    getCellDisplayText(
                      getTableField(column.key),
                      getTableCellValue(record, column.key),
                    )
                  }}
                </template>
              </span>
            </template>
          </template>
        </Table>
      </div>
    </div>

    <CrudExportPanel
      v-model:open="exportModalOpen"
      :all-fields-selected="allExportFieldsSelected"
      :confirm-loading="exporting"
      :field-aliases="exportFieldAliases"
      :field-converters="exportFieldConverters"
      :fields-indeterminate="exportFieldsIndeterminate"
      :ordered-fields="orderedExportFields"
      :selected-field-keys="exportSelectedFieldKeys"
      :selected-template="selectedExportTemplate"
      :selected-template-can-delete="selectedExportTemplateCanDelete"
      :selected-template-id="selectedExportTemplateId"
      :template-loading="exportTemplateLoading"
      :template-options="exportTemplateOptions"
      :template-saving="exportTemplateSaving"
      @confirm="handleExportConfirm"
      @delete-template="
        selectedExportTemplate &&
        deleteTemplate(selectedExportTemplate, 'export')
      "
      @move-field="moveExportField"
      @save-template="promptSaveExportTemplate"
      @set-all-fields-selected="setAllExportFieldsSelected"
      @set-field-selected="setExportFieldSelected"
      @template-change="handleExportTemplateChange"
      @update-field-alias="updateExportFieldAlias"
      @update-field-converter="updateExportFieldConverter"
    />

    <CrudImportPanel
      v-model:console-open="importConsoleOpen"
      v-model:open="importModalOpen"
      :can-start="importCanStart"
      :console-lines="importConsoleLines"
      :file-name="importFileName"
      :header-options="importHeaderOptions"
      :importable-fields="importableFields"
      :importing="importing"
      :mappings="importMappings"
      :preview-columns="importPreviewColumns"
      :preview-rows="importPreviewRows"
      :row-count="importSheet?.rows.length || 0"
      :row-errors="importPreviewResult.rowErrors"
      :selected-template="selectedImportTemplate"
      :selected-template-can-delete="selectedImportTemplateCanDelete"
      :selected-template-id="selectedImportTemplateId"
      :stop-requested="importStopRequested"
      :template-loading="importTemplateLoading"
      :template-options="importTemplateOptions"
      :template-saving="importTemplateSaving"
      @clear-console="clearImportConsole"
      @confirm="handleImportConfirm"
      @copy-console="copyImportConsole"
      @delete-template="
        selectedImportTemplate &&
        deleteTemplate(selectedImportTemplate, 'import')
      "
      @file-change="handleImportFileChange"
      @save-template="promptSaveImportTemplate"
      @stop="stopImport"
      @template-change="handleImportTemplateChange"
      @update-mapping="updateImportMapping"
    />

    <Modal
      v-if="canCreate || (canEdit && editingRecord)"
      :body-style="modalBodyStyle"
      :confirm-loading="submitting"
      :mask-closable="false"
      :open="modalOpen"
      :title="
        editingRecord
          ? `编辑${getBusinessTitle(config.title)}`
          : `新增${getBusinessTitle(config.title)}`
      "
      :style="modalStyle"
      :width="modalWidth"
      destroy-on-close
      @cancel="modalOpen = false"
      @ok="handleSubmit"
    >
      <div class="vben-crud-quick-fill-control">
        <Checkbox
          :checked="quickFillActive"
          :disabled="!quickFillPlan.eligible || submitting"
          @update:checked="quickFillRequested = $event"
        >
          快捷填写
        </Checkbox>
      </div>
      <Form
        layout="vertical"
        class="w-full max-w-full"
        :style="formContainerStyle"
      >
        <div
          ref="formFieldsContainer"
          class="grid gap-x-4 gap-y-4"
          :style="formGridStyle"
        >
          <template v-for="field in displayedFormFields" :key="field.key">
            <div
              v-if="
                quickFillActive && field.key === quickFillPlan.firstOptionalKey
              "
              class="vben-crud-quick-fill-divider"
            >
              <Button
                type="link"
                :aria-expanded="quickFillMore"
                @click="quickFillMore = !quickFillMore"
              >
                <template #icon>
                  <ChevronDown
                    class="vben-crud-toggle-icon"
                    :class="{ 'is-expanded': quickFillMore }"
                    aria-hidden="true"
                  />
                </template>
                {{ quickFillMore ? '收起更多' : '更多' }}
              </Button>
            </div>
            <div
              v-if="
                !quickFillActive &&
                field.complexGroupKey &&
                isFirstComplexGroupField(field)
              "
              class="border-border/70 col-span-full mt-2 flex items-center gap-2 border-t pt-4 text-sm font-semibold"
            >
              <Checkbox
                v-model:checked="complexGroupEnabled[field.complexGroupKey]"
              >
                本次提交{{ getComplexGroup(field.complexGroupKey)?.title }}
              </Checkbox>
              <Tooltip title="未勾选时，本次不变更这部分数据">
                <span class="text-muted-foreground text-xs"
                  >不勾选则不变更</span
                >
              </Tooltip>
              <Button
                type="link"
                size="small"
                :aria-expanded="!complexGroupCollapsed[field.complexGroupKey]"
                @click="toggleComplexGroup(field.complexGroupKey)"
              >
                <template #icon>
                  <ChevronDown
                    class="vben-crud-toggle-icon"
                    :class="{
                      'is-expanded':
                        !complexGroupCollapsed[field.complexGroupKey],
                    }"
                    aria-hidden="true"
                  />
                </template>
                {{
                  complexGroupCollapsed[field.complexGroupKey] ? '展开' : '收起'
                }}
              </Button>
            </div>
            <div
              v-if="
                !quickFillActive &&
                !field.complexGroupKey &&
                shouldShowFormGroupTitle(field)
              "
              class="col-span-full mt-3 flex items-center justify-between text-sm font-semibold"
              :class="getFormGroupTitleClass(field)"
            >
              <span class="vben-crud-group-title">
                {{ field.layoutGroupTitle }}
              </span>
              <div v-if="field.displayGroup" class="vben-crud-group-actions">
                <Checkbox
                  v-if="field.displayGroup.showSubmitCheckbox === true"
                  :checked="
                    groupSubmitChecked[field.displayGroup.key] !== false
                  "
                  :disabled="submitting"
                  :aria-label="`${field.layoutGroupTitle}提交数据`"
                  @update:checked="changeGroupSubmitChecked(field, $event)"
                >
                  提交数据
                </Checkbox>
                <Button
                  type="link"
                  size="small"
                  :aria-expanded="
                    pageDisplayGroupExpandedRows[field.displayGroup.key] ===
                    'all'
                  "
                  @click="togglePageDisplayGroup(field.displayGroup.key)"
                >
                  <template #icon>
                    <ChevronDown
                      class="vben-crud-toggle-icon"
                      :class="{
                        'is-expanded':
                          pageDisplayGroupExpandedRows[
                            field.displayGroup.key
                          ] === 'all',
                      }"
                      aria-hidden="true"
                    />
                  </template>
                  {{ getPageDisplayGroupToggleLabel(field.displayGroup.key) }}
                </Button>
              </div>
            </div>
            <Form.Item
              v-if="
                quickFillActive ||
                (isComplexGroupFieldVisible(field) &&
                  isPageDisplayGroupFieldVisible(field))
              "
              v-show="
                !quickFillActive ||
                quickFillMore ||
                quickFillPlan.requiredKeys.has(field.key)
              "
              :data-crud-form-field="field.key"
              :label="getFormFieldLabel(field)"
              :required="field.required"
              :extra="getFormFieldHelp(field)"
              class="mb-0 w-full"
              :class="{
                'vben-crud-form-item-new-row':
                  !quickFillActive && field.layoutNewRow,
                'col-span-full': shouldFormItemSpanFullRow(field),
                'md:col-span-2': shouldFormItemSpanTwoColumns(field),
              }"
              :style="
                getFormItemStyle(
                  quickFillActive ? { ...field, layoutNewRow: false } : field,
                )
              "
            >
              <div v-if="hasFormFieldSlot(field)" :inert="isFormFieldInteractionDisabled(field)">
                <slot
                  :name="resolveFormFieldSlotName(field)"
                  :editing-record="editingRecord"
                  :field="field"
                  :form-state="isFormFieldInteractionDisabled(field) ? readonly(formState) : formState"
                  :disabled="isFormFieldInteractionDisabled(field)"
                ></slot>
              </div>
              <Input.Password
                v-else-if="field.type === 'password'"
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                class="w-full"
                :disabled="isFormFieldInteractionDisabled(field)"
                :maxlength="field.maxLength"
                :placeholder="getPlaceholder(field)"
              />
              <Cascader
                v-else-if="field.type === 'area-cascader'"
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :allow-clear="true"
                :change-on-select="
                  !isAreaCascaderLevelRestricted(field, formState)
                "
                :disabled="isFormFieldInteractionDisabled(field)"
                :loading="optionLoadingState[field.key]"
                :options="getFieldOptions(field, formState)"
                :placeholder="getPlaceholder(field)"
                class="w-full"
                show-search
                @dropdown-visible-change="
                  (open) =>
                    handleAreaCascaderDropdownVisibleChange(
                      field,
                      open,
                      formState,
                    )
                "
              />
              <TreeSelect
                v-else-if="field.type === 'org-tree-select'"
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :allow-clear="true"
                class="w-full"
                :disabled="isFormFieldInteractionDisabled(field)"
                :loading="optionLoadingState[field.key]"
                :multiple="Boolean(field.multiple)"
                :placeholder="getPlaceholder(field)"
                show-search
                :tree-checkable="Boolean(field.multiple)"
                :tree-data="getFieldOptions(field)"
                tree-default-expand-all
                tree-node-filter-prop="label"
                @blur="() => restoreRemoteFieldOptions(field)"
                @dropdown-visible-change="
                  (open) => handleSelectDropdownVisibleChange(field, open)
                "
              />
              <div
                v-else-if="isFileUploadField(field)"
                @mouseleave="handleUploadMouseLeave(field)"
                @mousemove="
                  handleUploadAreaMouseMove(field, $event as MouseEvent)
                "
              >
                <Upload
                :disabled="isFormFieldInteractionDisabled(field)"
                  :accept="isImageUploadField(field) ? 'image/*' : undefined"
                  :custom-request="(options) => uploadCrudFile(field, options)"
                  :file-list="getUploadFileList(field)"
                  :item-render="
                    ({ originNode, file }) =>
                      renderUploadItem(field, originNode, file)
                  "
                  :list-type="
                    isImageUploadField(field) ? 'picture-card' : 'text'
                  "
                  :max-count="getUploadMaxCount(field)"
                  :multiple="isMultiUploadField(field)"
                  @preview="handleUploadPreview"
                  @remove="(file) => removeCrudUploadFile(field, file)"
                >
                  <Button
                    v-if="
                      !isImageUploadField(field) &&
                      shouldShowUploadTrigger(field)
                    "
                  >
                    上传{{ field.label }}
                  </Button>
                  <div
                    v-else-if="shouldShowUploadTrigger(field)"
                    class="flex h-full w-full items-center justify-center"
                  >
                    <Plus class="size-5" />
                  </div>
                </Upload>
              </div>
              <JsonEditorField
                v-else-if="
                  field.type === 'json' &&
                  !shouldUseJsonSchemaEditor(field, formState[field.key])
                "
                :model-value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:model-value="updateFormFieldInput(field, $event)"
                :disabled="isFormFieldInteractionDisabled(field)"
                :modal-style="modalStyle"
                :modal-width="modalWidth"
                :title="field.label"
              />
              <JsonSchemaEditorField
                v-else-if="
                  shouldUseJsonSchemaEditor(field, formState[field.key])
                "
                :model-value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:model-value="updateFormFieldInput(field, $event)"
                :disabled="isFormFieldInteractionDisabled(field)"
                :inline="isCrudFieldJsonSchemaInline(field)"
                :modal-style="modalStyle"
                :modal-width="modalWidth"
                :schema-source="
                  getJsonSchemaSourceInput(field, formState[field.key])
                "
                :title="field.label"
              />
              <CronExpressionField
                v-else-if="field.type === 'cron'"
                :model-value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:model-value="updateFormFieldInput(field, $event)"
                :disabled="isFormFieldInteractionDisabled(field)"
                :modal-style="modalStyle"
                :modal-width="modalWidth"
                :placeholder="getPlaceholder(field)"
                :title="field.label"
              />
              <CodeEditorField
                v-else-if="
                  field.type === 'code' ||
                  field.type === 'css' ||
                  field.type === 'html'
                "
                :model-value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:model-value="updateFormFieldInput(field, $event)"
                :disabled="isFormFieldInteractionDisabled(field)"
                :language="getCodeEditorLanguage(field)"
                :modal-style="modalStyle"
                :modal-width="modalWidth"
                :title="field.label"
              />
              <Input.TextArea
                v-else-if="
                  field.type === 'textarea' || field.type === 'string-array'
                "
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :auto-size="{ minRows: 3, maxRows: 8 }"
                class="w-full"
                :disabled="isFormFieldInteractionDisabled(field)"
                :maxlength="field.maxLength"
                :placeholder="getPlaceholder(field)"
              />
              <DatePicker
                :disabled="isFormFieldInteractionDisabled(field)"
                v-else-if="field.type === 'datetime' || field.type === 'date'"
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                class="w-full"
                :placeholder="getPlaceholder(field)"
                :show-time="field.type === 'datetime'"
                :value-format="
                  field.type === 'datetime'
                    ? 'YYYY-MM-DDTHH:mm:ss'
                    : 'YYYY-MM-DD'
                "
              />
              <TimePicker
                :disabled="isFormFieldInteractionDisabled(field)"
                v-else-if="field.type === 'time'"
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                class="w-full"
                :placeholder="getPlaceholder(field)"
                value-format="HH:mm:ss"
              />
              <InputNumber
                :disabled="isFormFieldInteractionDisabled(field)"
                v-else-if="field.type === 'number'"
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                class="w-full"
                :placeholder="getPlaceholder(field)"
              />
              <Checkbox.Group
                v-else-if="
                  shouldUseInlineChoiceOptions(
                    field,
                    editingRecord ? 'edit' : 'create',
                  ) && field.multiple
                "
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :disabled="isFormFieldInteractionDisabled(field)"
                :options="
                  getInlineChoiceOptions(
                    field,
                    editingRecord ? 'edit' : 'create',
                  )
                "
                class="flex flex-wrap gap-x-3 gap-y-2"
              />
              <Radio.Group
                v-else-if="
                  shouldUseInlineChoiceOptions(
                    field,
                    editingRecord ? 'edit' : 'create',
                  )
                "
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :disabled="isFormFieldInteractionDisabled(field)"
                :options="
                  getInlineChoiceOptions(
                    field,
                    editingRecord ? 'edit' : 'create',
                  )
                "
                class="flex flex-wrap gap-2"
                option-type="button"
              />
              <AutoComplete
                v-else-if="
                  (field.type === 'select' || field.type === 'role-select') &&
                  field.allowInput &&
                  !field.multiple
                "
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :allow-clear="true"
                :disabled="isFormFieldInteractionDisabled(field)"
                :options="getFieldOptions(field)"
                :placeholder="getPlaceholder(field)"
                :filter-option="
                  isRemoteSearchField(field) ? false : filterSelectOptionByLabel
                "
                :loading="optionLoadingState[field.key]"
                class="w-full"
                @blur="() => restoreRemoteFieldOptions(field)"
                @dropdown-visible-change="
                  (open) => handleSelectDropdownVisibleChange(field, open)
                "
                @search="handleSelectSearch(field, $event)"
              />
              <Select
                v-else-if="
                  field.type === 'select' || field.type === 'role-select'
                "
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :allow-clear="true"
                :disabled="isFormFieldInteractionDisabled(field)"
                :mode="field.multiple ? 'multiple' : undefined"
                :options="getFieldOptions(field)"
                :placeholder="getPlaceholder(field)"
                :filter-option="
                  isRemoteSearchField(field) ? false : filterSelectOptionByLabel
                "
                :loading="optionLoadingState[field.key]"
                class="w-full"
                show-search
                @blur="() => restoreRemoteFieldOptions(field)"
                @change="(value) => handleSelectChange(field, value)"
                @dropdown-visible-change="
                  (open) => handleSelectDropdownVisibleChange(field, open)
                "
                @search="handleSelectSearch(field, $event)"
              />
              <Select
                :disabled="isFormFieldInteractionDisabled(field)"
                v-else-if="field.type === 'tags'"
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :options="getFieldOptions(field)"
                :placeholder="getPlaceholder(field)"
                :filter-option="
                  isRemoteSearchField(field) ? false : filterSelectOptionByLabel
                "
                :loading="optionLoadingState[field.key]"
                class="w-full"
                mode="tags"
                show-search
                @blur="() => restoreRemoteFieldOptions(field)"
                @dropdown-visible-change="
                  (open) => handleSelectDropdownVisibleChange(field, open)
                "
                @search="handleSelectSearch(field, $event)"
              />
              <Switch
                :disabled="isFormFieldInteractionDisabled(field)"
                v-else-if="field.type === 'switch'"
                :checked="formState[field.key]"
                @update:checked="updateFormFieldInput(field, $event)"
                :checked-children="
                  getCrudBooleanDisplayText(field, true) || '是'
                "
                :un-checked-children="
                  getCrudBooleanDisplayText(field, false) || '否'
                "
              />
              <Input
                v-else
                :value="getInteractionModelValue(formState[field.key], isFormFieldInteractionDisabled(field))"
                @update:value="updateFormFieldInput(field, $event)"
                :disabled="isFormFieldInteractionDisabled(field)"
                class="w-full"
                :maxlength="field.maxLength"
                :placeholder="getPlaceholder(field)"
              />
            </Form.Item>
          </template>
        </div>
      </Form>
    </Modal>

    <Modal
      v-model:open="actionResultOpen"
      :body-style="modalBodyStyle"
      :footer="null"
      :title="actionResultTitle"
      :style="
        actionResultMode === 'showForm'
          ? {
              maxHeight:
                detailModalConfig?.modalMaxHeight ||
                DEFAULT_CONTENT_MODAL_MAX_HEIGHT,
              maxWidth: detailModalConfig?.modalMaxWidth || '80vw',
            }
          : undefined
      "
      :width="
        actionResultMode === 'showForm'
          ? detailModalConfig?.modalMaxWidth || '80vw'
          : '720px'
      "
    >
      <div
        v-if="actionResultMode === 'showQrCode'"
        class="flex flex-col items-center gap-4 py-4"
      >
        <QRCode :value="String(actionResultQrValue || '')" />
        <div
          class="text-muted-foreground max-w-full break-all text-center text-sm"
        >
          {{ actionResultQrValue }}
        </div>
      </div>
      <div
        v-else-if="actionResultMode === 'showImage' && actionResultMediaUrl"
        class="flex justify-center py-4"
      >
        <Image :src="actionResultMediaUrl" />
      </div>
      <div
        v-else-if="actionResultMode === 'showVideo' && actionResultMediaUrl"
        class="py-4"
      >
        <video class="max-h-[70vh] w-full rounded-lg bg-black" controls>
          <source :src="actionResultMediaUrl" />
        </video>
      </div>
      <div
        v-else-if="actionResultMode === 'showIFrame' && actionResultMediaUrl"
        class="py-2"
      >
        <iframe
          :src="actionResultMediaUrl"
          class="border-border h-[70vh] w-full rounded-lg border"
        ></iframe>
      </div>
      <DetailDisplayPanel
        v-else-if="
          actionResultMode === 'showForm' &&
          typeof actionResultData === 'object' &&
          !Array.isArray(actionResultData)
        "
        :entries="actionResultEntries"
      />
      <div
        v-else
        class="bg-muted max-h-[60vh] overflow-auto rounded p-3 text-sm"
      >
        <pre>{{
          typeof actionResultData === 'string'
            ? actionResultData
            : JSON.stringify(actionResultData, null, 2)
        }}</pre>
      </div>
    </Modal>

    <slot
      name="modals"
      :editing-record="editingRecord"
      :form-state="formState"
      :load-list="loadList"
    ></slot>

    <div
      v-if="hoveredImageUploadTarget"
      class="border-border bg-popover text-popover-foreground pointer-events-none fixed z-[9999] rounded-md border px-2 py-1 text-xs shadow"
      :style="{
        left: `${uploadPasteTipPosition.x}px`,
        top: `${uploadPasteTipPosition.y}px`,
      }"
    >
      按 Ctrl/⌘ + V 粘贴截图到这
      <span v-if="hoveredImageUploadTarget.mode === 'replace'">
        ，替换当前图片
      </span>
    </div>

    <Image
      :preview="{
        visible: uploadPreviewOpen,
        onVisibleChange: (visible: boolean) => {
          uploadPreviewOpen = visible;
        },
      }"
      :src="uploadPreviewUrl"
      class="hidden"
    />

    <PageDisplaySettingsDrawer
      v-model:open="pageDisplaySettingsOpen"
      :code="pageDisplaySettingCode"
      :fields="props.config.fields"
      :detail-fields="detailSettingsFields"
      :initial-scope="pageDisplaySettingRecord || pageDisplayInitialScope"
      :model-value="pageDisplayConfig"
      :saving="pageDisplaySettingSaving"
      :show-operation-column="hasAvailableOperationColumn"
      @save="savePageDisplaySettings"
    />
  </Page>
</template>

<style scoped>
.vben-crud-page {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.vben-crud-list-tabs-float {
  position: absolute;
  z-index: 20;
  display: inline-flex;
  gap: 6px;
  align-items: flex-start;
  max-width: calc(100% - 32px);
  padding: 8px 10px;
  background: hsl(var(--primary) / 5%);
  border: 1px solid hsl(var(--primary));
  border-radius: var(--radius);
  opacity: 1;
  box-shadow: var(--shadow-sm);
  transition:
    width 0.15s ease,
    height 0.15s ease,
    border-radius 0.15s ease,
    opacity 0.15s ease;
  user-select: none;
  touch-action: none;
}

.vben-crud-list-tabs-float.is-collapsed {
  width: 0;
  height: 0;
  padding: 0 !important;
  background: transparent !important;
  border-color: transparent;
  border-width: 0;
  box-shadow: none !important;
}

.vben-crud-list-tabs-handle {
  position: absolute;
  top: -10px;
  left: -10px;
  display: inline-flex;
  width: 22px;
  height: 22px;
  padding: 0;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  cursor: grab;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 9999px;
  box-shadow: var(--shadow-sm);
  touch-action: none;
  user-select: none;
}

.vben-crud-list-tabs-handle:hover {
  color: hsl(var(--foreground));
}

.vben-crud-list-tabs-float.is-dragging .vben-crud-list-tabs-handle {
  cursor: grabbing;
}

.vben-crud-list-tabs {
  min-width: 0;
  max-width: 100%;
}

.vben-crud-list-tabs :deep(.ant-tabs-nav) {
  margin: 0;
}

.vben-crud-list-tabs :deep(.ant-tabs-content-holder) {
  display: none;
}

.vben-crud-list-tabs :deep(.ant-tabs-tab) {
  justify-content: center;
  min-width: 96px;
  padding: 6px 10px;
  margin: 0;
}

.vben-crud-section {
  min-width: 0;
  padding: 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.vben-crud-section:has(.vben-crud-table) {
  padding-bottom: 8px;
}

.vben-crud-group-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: flex-end;
}

.vben-crud-quick-fill-control {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.vben-crud-quick-fill-divider {
  display: flex;
  grid-column: 1 / -1;
  gap: 12px;
  align-items: center;
  margin-block: 8px;
}

.vben-crud-quick-fill-divider::before,
.vben-crud-quick-fill-divider::after {
  flex: 1;
  height: 1px;
  content: '';
  background: hsl(var(--border));
}

.vben-crud-toggle-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-inline-end: 4px;
  vertical-align: -3px;
  transition: transform 150ms ease;
}

.vben-crud-toggle-icon.is-expanded {
  transform: rotate(180deg);
}

.vben-crud-search-actions {
  display: flex;
  grid-column: -2 / -1;
  align-items: flex-start;
  justify-content: flex-end;
  min-height: 32px;
}

.vben-crud-section--fullscreen {
  position: fixed;
  inset: 16px;
  z-index: 1000;
  height: auto;
  max-height: none;
  overflow: auto;
  box-shadow: var(--shadow-lg);
}

.vben-crud-table {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.vben-crud-table :deep(.ant-table-wrapper),
.vben-crud-table :deep(.ant-spin-nested-loading),
.vben-crud-table :deep(.ant-spin-container) {
  min-height: 0;
}

.vben-crud-table :deep(.ant-table) {
  min-height: 0;
  border-radius: var(--radius);
}

.vben-crud-table :deep(.ant-table-container) {
  position: relative;
  min-height: 0;
}

.vben-crud-table :deep(.ant-table-body) {
  overflow-y: auto !important;
}

.vben-crud-table :deep(.ant-table-thead > tr > th) {
  padding-top: 10px;
  padding-bottom: 10px;
  font-weight: 500;
  white-space: nowrap;
  background: hsl(var(--muted));
}

.vben-crud-table :deep(.ant-table-column-sorters) {
  min-width: 0;
}

.vben-crud-table :deep(.ant-table-column-title) {
  min-width: 0;
  overflow: hidden;
}

.vben-crud-table :deep(.vben-crud-table-header-title) {
  display: block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vben-crud-table :deep(.ant-pagination) {
  margin-top: 8px;
  margin-bottom: 0;
}

.vben-crud-column-setting-row {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 4px 0;
  border-radius: var(--radius);
  transition: background-color 0.15s ease;
}

.vben-crud-column-setting-row:hover {
  background: hsl(var(--muted) / 60%);
}

.vben-crud-column-setting-row :deep(.ant-checkbox-wrapper) {
  min-width: 0;
  flex: 1;
}

.vben-crud-column-setting-row :deep(.ant-checkbox + span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vben-crud-row-action-content {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.vben-crud-row-action-badge {
  position: absolute;
  top: -8px;
  right: -9px;
  display: inline-flex;
  min-width: 15px;
  height: 15px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  color: hsl(var(--primary-foreground));
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
  background: hsl(var(--primary));
  border: 1px solid hsl(var(--background));
  border-radius: 999px;
  box-shadow: 0 2px 6px hsl(var(--primary) / 28%);
}

:global(.vben-crud-action-log-tooltip) {
  max-width: min(420px, calc(100vw - 48px));
}

:global(.vben-crud-action-log-tooltip .ant-tooltip-inner) {
  width: min(340px, calc(100vw - 48px));
  max-height: min(40vh, 320px);
  overflow: auto;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

:global(.vben-crud-cell-tooltip) {
  max-width: min(420px, calc(100vw - 48px));
}

:global(.vben-crud-cell-tooltip .ant-tooltip-inner) {
  max-width: min(420px, calc(100vw - 48px));
  max-height: min(40vh, 320px);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.vben-crud-action-log-tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  font-size: 12px;
  line-height: 1.5;
}

.vben-crud-action-log-tooltip-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vben-crud-action-log-tooltip-row {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 8px;
}

.vben-crud-action-log-tooltip-label {
  white-space: nowrap;
  opacity: 0.76;
}

.vben-crud-action-log-tooltip-value {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

:global(.vben-crud-export-save-template-form) {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 240px;
  padding-top: 8px;
}

:global(.vben-crud-export-save-template-field) {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

:global(.vben-crud-export-save-template-label) {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  justify-content: flex-end;
  white-space: nowrap;
}

:global(.vben-crud-export-save-template-required) {
  color: hsl(var(--destructive));
}

:global(.vben-crud-export-save-template-scope) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 24px;
  padding-left: 86px;
}

:global(.vben-crud-export-save-template-scope-option) {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  cursor: pointer;
}

:global(.vben-crud-export-save-template-scope-option input) {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: hsl(var(--primary));
  cursor: pointer;
}

:global(.vben-crud-export-save-template-scope-option span) {
  min-width: 0;
  white-space: normal;
}

.vben-crud-form-item-new-row {
  grid-column-start: 1 !important;
}
</style>
