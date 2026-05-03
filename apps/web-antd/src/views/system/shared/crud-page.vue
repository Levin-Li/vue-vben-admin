<script lang="ts" setup>
import type { TableColumnsType, UploadFile } from 'ant-design-vue';

import type { NormalizedCrudAction } from './crud-action-model';
import type {
  CrudFieldConfig,
  CrudListTableConfig,
  CrudPageConfig,
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
  ref,
  render,
  useSlots,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { Page, VCropper } from '@vben/common-ui';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  IconifyIcon,
  Plus,
} from '@vben/icons';
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
  fetchTreeOptions,
  FILE_STORAGE_MULTI_UPLOAD_PATH,
  FILE_STORAGE_SINGLE_UPLOAD_PATH,
  updateCrudRecord,
  uploadFileByFileStorageController,
} from '#/api';
import { requestClient } from '#/api/request';
import { useRbacAccess } from '#/utils/rbac-access';

import {
  applyAreaCascaderValueToRecord,
  getAreaCascaderValueFromRecord,
} from './area-cascader';
import CodeEditorField from './code-editor-field.vue';
import {
  pickCrudActionResultData,
  resolveCrudActionAfterSuccess,
  shouldReloadDataListAfterAction,
} from './crud-action-model';
import { buildCrudConfirmConfig } from './crud-confirm';
import {
  filterCrudOperationsByListTable,
  groupCrudOperationsByRecordRef,
} from './crud-operation-placement';
import { buildCrudOperationPermissions } from './crud-permissions';
import { normalizeLeftFixedTableColumns } from './crud-table-columns';
import { evaluateCrudVisibleOn } from './crud-visible-on';
import JsonEditorField from './json-editor-field.vue';

const props = defineProps<{
  config: CrudPageConfig;
}>();
const slots = useSlots();

type GenericRecord = Record<string, any>;
type TableColumnFixedMode = 'left' | 'none' | 'right';
type TableSortOrder = 'ascend' | 'descend';
type CrudBuiltinAction = 'create' | 'delete' | 'edit' | 'retrieve';
interface TableColumnPreference {
  fixedMap?: Record<string, TableColumnFixedMode>;
  hiddenKeys?: string[];
  orderedKeys?: string[];
  version?: number;
}
interface TableColumnSettingsSnapshot {
  fixedMap: Record<string, TableColumnFixedMode>;
  hiddenKeys: string[];
  orderedKeys: string[];
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

const DEFAULT_SEARCH_COLLAPSED_COUNT = 3;
const DEFAULT_CRUD_MODAL_WIDTH = 'min(70vw, 1280px)';
const DEFAULT_FORM_ROW_HEIGHT = 78;
const EXPORT_PAGE_SIZE = 2000;
const FORM_GRID_COLUMN_GAP = 16;
const MIN_FORM_COLUMN_WIDTH = 240;
const TABLE_COLUMN_PREFERENCE_VERSION = 2;
const TABLE_MIN_SCROLL_Y = 160;
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
const actionResultMode = ref<NormalizedCrudAction>('showSchema');
const exportModalOpen = ref(false);
const exporting = ref(false);
const exportSelectedFieldKeys = ref<string[]>([]);
const exportFieldOrderKeys = ref<string[]>([]);
const uploadPreviewOpen = ref(false);
const uploadPreviewUrl = ref('');
const optionState = reactive<Record<string, any[]>>({});
const optionLoadingState = reactive<Record<string, boolean>>({});
const quickSwitchLoadingState = reactive<Record<string, boolean>>({});
const searchState = reactive<GenericRecord>({});
const formState = reactive<GenericRecord>({});
const submitting = ref(false);
const crudPageRef = ref<HTMLElement | null>(null);
const listTableTabsRef = ref<HTMLElement | null>(null);
const listSectionRef = ref<HTMLElement | null>(null);
const listToolbarRef = ref<HTMLElement | null>(null);
const tableScrollY = ref(360);
const tableFullscreen = ref(false);
const activeListTableKey = ref('');
const listTableTabsCollapsed = ref(false);
const isDraggingListTableTabs = ref(false);
const suppressListTableTabsClick = ref(false);
const hiddenTableColumnKeys = ref<string[]>([]);
const columnSettingsOpen = ref(false);
const columnSettingsSnapshot = ref<null | TableColumnSettingsSnapshot>(null);
const draggedDraftTableColumnKey = ref('');
const draftHiddenTableColumnKeys = ref<string[]>([]);
const tableColumnOrderKeys = ref<string[]>([]);
const draftTableColumnOrderKeys = ref<string[]>([]);
const tableColumnFixedState = reactive<Record<string, TableColumnFixedMode>>(
  {},
);
const draftTableColumnFixedState = reactive<
  Record<string, TableColumnFixedMode>
>({});
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

let listTableTabsDragState: null | {
  startLeft: number;
  startTop: number;
  startX: number;
  startY: number;
} = null;

const isSaasUser = computed(() => {
  const userInfo = userStore.userInfo as Record<string, any>;
  let roles: any[] = [];

  if (Array.isArray(userInfo?.roles)) {
    roles = userInfo.roles;
  } else if (Array.isArray(userInfo?.roleList)) {
    roles = userInfo.roleList;
  }

  return (
    userInfo?.saasUser === true ||
    userInfo?.isSaasUser === true ||
    userInfo?.saasAdmin === true ||
    userInfo?.isSaasAdmin === true ||
    roles.some((role) => String(role || '').startsWith('R_SAAS'))
  );
});

function isFieldVisible(field: CrudFieldConfig) {
  if (field.visibleForSaasUser) {
    return isSaasUser.value;
  }

  return true;
}

const searchFields = computed(() =>
  props.config.fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.search && isFieldVisible(field))
    .sort(
      (left, right) =>
        (left.field.searchOrder ?? left.index) -
        (right.field.searchOrder ?? right.index),
    )
    .map(({ field }) => field),
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

const FORM_LAYOUT_GROUP_ORDER = [
  'ownership',
  'basic',
  'media',
  'content',
  'business',
  'extension',
  'remark',
  'audit',
];

function getFormLayoutGroupIndex(field: CrudFieldConfig, index: number) {
  if (!field.layoutGroup) {
    return FORM_LAYOUT_GROUP_ORDER.length + index / 1000;
  }

  const groupIndex = FORM_LAYOUT_GROUP_ORDER.indexOf(field.layoutGroup);
  return groupIndex >= 0 ? groupIndex : FORM_LAYOUT_GROUP_ORDER.length;
}

function sortFormLayoutFields(fields: CrudFieldConfig[]) {
  return [...fields].sort((a, b) => {
    const aIndex = fields.indexOf(a);
    const bIndex = fields.indexOf(b);
    const groupDiff =
      getFormLayoutGroupIndex(a, aIndex) - getFormLayoutGroupIndex(b, bIndex);

    if (groupDiff !== 0) {
      return groupDiff;
    }

    const orderDiff = (a.layoutOrder ?? aIndex) - (b.layoutOrder ?? bIndex);
    return orderDiff !== 0 ? orderDiff : aIndex - bIndex;
  });
}

const visibleFormFields = computed(() =>
  sortFormLayoutFields(
    formFields.value.filter((field) =>
      editingRecord.value
        ? field.formEdit !== false
        : field.formCreate !== false,
    ),
  ),
);

const tableFields = computed(() =>
  props.config.fields.filter((field) => field.table && isFieldVisible(field)),
);

const orderedTableFields = computed(() =>
  getOrderedTableFields(tableColumnOrderKeys.value),
);

const visibleTableFields = computed(() =>
  orderedTableFields.value.filter(
    (field) => !hiddenTableColumnKeys.value.includes(String(field.key)),
  ),
);

const effectiveTableColumnFixedMap = computed(() =>
  normalizeLeftFixedTableColumns(
    visibleTableFields.value,
    getTableColumnFixed,
    getTableFieldKey,
  ),
);

const draftOrderedTableFields = computed(() =>
  getOrderedTableFields(draftTableColumnOrderKeys.value),
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

const exportableFields = computed(() => {
  const orderedKeys = new Set<string>();
  const fieldsInCurrentOrder: CrudFieldConfig[] = [];

  for (const field of [
    ...orderedVisibleTableFields.value,
    ...orderedTableFields.value,
  ]) {
    const key = String(field.key);
    if (field.type !== 'password' && !orderedKeys.has(key)) {
      orderedKeys.add(key);
      fieldsInCurrentOrder.push(field);
    }
  }

  const remainingFields = props.config.fields.filter(
    (field) =>
      isFieldVisible(field) &&
      field.type !== 'password' &&
      !orderedKeys.has(String(field.key)),
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

const tableColumnPreferenceStorageKey = computed(() => {
  const routeKey =
    route.path ||
    `${props.config.apiModuleBase || ''}${props.config.apiBase || ''}`;
  const tableName = String(activeListTableName.value || '').trim();
  const pageKey = tableName ? `${routeKey}:${tableName}` : routeKey;

  return `vben:crud-table-columns:${pageKey}`;
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

const hasTableColumnCustomization = computed(
  () =>
    hiddenTableColumnKeys.value.length > 0 ||
    tableColumnOrderKeys.value.length > 0 ||
    Object.keys(tableColumnFixedState).length > 0,
);

const hasConfiguredRowActions = computed(() =>
  actionGroups.value.row.some(
    (action) =>
      (!action.permission || hasPermission(action.permission)) &&
      evaluateCrudVisibleOn(action.visibleOn, {}, userStore.userInfo),
  ),
);

const showActionColumn = computed(
  () =>
    canShowActiveBuiltinAction('retrieve') ||
    canShowActiveBuiltinAction('edit') ||
    canShowActiveBuiltinAction('delete') ||
    hasConfiguredRowActions.value,
);

const tableColumns = computed<TableColumnsType>(() => {
  const columns: TableColumnsType = orderedVisibleTableFields.value.map(
    (field) => ({
      align: isNumericField(field) ? 'right' : undefined,
      dataIndex: field.key,
      fixed: getEffectiveTableColumnFixed(field),
      key: field.key,
      sorter: isTableFieldSortable(field),
      sortOrder:
        tableSorterState.field === String(field.key)
          ? tableSorterState.order
          : undefined,
      title: field.label,
      width: field.width,
    }),
  );

  if (showActionColumn.value) {
    columns.push({
      fixed: 'right',
      key: '__actions',
      title: '操作',
      width: 220,
    });
  }

  return columns;
});

const tableFieldMap = computed(() =>
  Object.fromEntries(tableFields.value.map((field) => [field.key, field])),
);

const allFieldMap = computed(() =>
  Object.fromEntries(props.config.fields.map((field) => [field.key, field])),
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

const canRetrieve = computed(
  () =>
    props.config.allowRetrieve === true &&
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

const searchCollapsedCount = computed(
  () => props.config.searchCollapsedCount ?? DEFAULT_SEARCH_COLLAPSED_COUNT,
);

const showAdvancedSearchToggle = computed(
  () => searchFieldItems.value.length > searchCollapsedCount.value,
);

const visibleSearchFieldItems = computed(() => {
  if (searchExpanded.value || !showAdvancedSearchToggle.value) {
    return searchFieldItems.value;
  }

  return searchFieldItems.value.slice(0, searchCollapsedCount.value);
});

function getResponsiveColumnCount(targetCount: number) {
  if (viewportWidth.value < 768) {
    return 1;
  }

  if (viewportWidth.value < 1024) {
    return Math.min(targetCount, 2);
  }

  if (viewportWidth.value < 1440) {
    return Math.min(targetCount, 3);
  }

  if (viewportWidth.value < 1920) {
    return Math.min(targetCount, 4);
  }

  return targetCount;
}

function getFormFieldVisualWeight(field: CrudFieldConfig) {
  if (field.type === 'switch') {
    return 0.6;
  }

  if (
    field.type === 'code' ||
    field.type === 'css' ||
    field.type === 'file' ||
    field.type === 'html' ||
    field.type === 'image' ||
    field.type === 'textarea'
  ) {
    return 2;
  }

  if (field.type === 'string-array' || field.type === 'tags') {
    return 3;
  }

  return 1;
}

function isTableFieldSortable(field: CrudFieldConfig) {
  return field.sortable !== false && field.key !== '__tenant';
}

function shouldFormFieldSpanFullRow(field: CrudFieldConfig) {
  return (
    field.fullRow ||
    field.span === -1 ||
    field.type === 'textarea' ||
    field.type === 'string-array' ||
    field.type === 'tags'
  );
}

function getFormFieldColumnSpan(field: CrudFieldConfig, columns: number) {
  if (shouldFormFieldSpanFullRow(field)) {
    return columns;
  }

  return Math.min(Math.max(field.span || 1, 1), columns);
}

function estimateFormVisualRows(fields: CrudFieldConfig[], columns: number) {
  let usedColumns = 0;
  let currentRowWeight = 0;
  let rows = 0;

  function flushRow() {
    if (usedColumns > 0) {
      rows += currentRowWeight || 1;
      usedColumns = 0;
      currentRowWeight = 0;
    }
  }

  for (const field of fields) {
    if (field.layoutNewRow) {
      flushRow();
    }

    const span = getFormFieldColumnSpan(field, columns);
    const weight = getFormFieldVisualWeight(field);

    if (usedColumns > 0 && usedColumns + span > columns) {
      flushRow();
    }

    usedColumns += span;
    currentRowWeight = Math.max(currentRowWeight, weight);

    if (span === columns || usedColumns >= columns) {
      flushRow();
    }
  }

  flushRow();

  return rows;
}

function getModalAvailableWidth() {
  const configuredWidth = props.config.modalWidth;
  const configuredMaxWidth =
    typeof configuredWidth === 'number' ? configuredWidth : 1280;

  return Math.min(viewportWidth.value * 0.7, configuredMaxWidth);
}

function getMediaFieldCount(fields: CrudFieldConfig[]) {
  return fields.filter(
    (field) => field.type === 'image' || field.type === 'file',
  ).length;
}

const searchColumnCount = computed(() => {
  const count = visibleSearchFieldItems.value.length;

  if (count <= 1) {
    return 1;
  }

  if (count <= 2) {
    return getResponsiveColumnCount(2);
  }

  return getResponsiveColumnCount(4);
});

const searchGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${searchColumnCount.value}, minmax(0, 1fr))`,
}));

const formColumnCount = computed(() => {
  const totalWeight = visibleFormFields.value.reduce(
    (sum, field) => sum + getFormFieldVisualWeight(field),
    0,
  );
  const maxColumns = getResponsiveColumnCount(5);
  let columns = 1;

  if (totalWeight > 30) {
    columns = 5;
  } else if (totalWeight > 18) {
    columns = 4;
  } else if (
    totalWeight > 10 ||
    getMediaFieldCount(visibleFormFields.value) >= 2
  ) {
    columns = 3;
  } else if (totalWeight > 6) {
    columns = 2;
  }

  columns = Math.min(columns, maxColumns);

  while (
    columns > 1 &&
    estimateFormVisualRows(visibleFormFields.value, columns) < 3
  ) {
    columns -= 1;
  }

  while (
    columns < maxColumns &&
    estimateFormVisualRows(visibleFormFields.value, columns) *
      DEFAULT_FORM_ROW_HEIGHT >
      viewportHeight.value * 0.75
  ) {
    const nextColumns = columns + 1;
    const nextColumnWidth =
      (getModalAvailableWidth() -
        (nextColumns - 1) * FORM_GRID_COLUMN_GAP -
        48) /
      nextColumns;

    if (nextColumnWidth < MIN_FORM_COLUMN_WIDTH) {
      break;
    }

    columns = nextColumns;
  }

  return columns;
});

const formGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${formColumnCount.value}, minmax(0, 1fr))`,
}));

const formContainerStyle = computed(() => ({
  maxWidth: '100%',
  width: '100%',
}));

function getFormItemStyle(field: CrudFieldConfig) {
  return field.layoutNewRow ? { gridColumnStart: 1 } : undefined;
}

const modalMaxWidth = computed(() => {
  const configuredWidth = props.config.modalWidth || DEFAULT_CRUD_MODAL_WIDTH;

  if (typeof configuredWidth === 'number') {
    return `min(70vw, ${configuredWidth}px)`;
  }

  return String(configuredWidth).trim() || DEFAULT_CRUD_MODAL_WIDTH;
});

const modalStyle = computed(() => ({
  maxWidth: modalMaxWidth.value,
}));

const modalWidth = computed(() => modalMaxWidth.value);

function handleViewportResize() {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
  setListTableTabsPosition(listTableTabsPosition.x, listTableTabsPosition.y);
  updateTableScrollY();
}

let listSectionResizeObserver: null | ResizeObserver = null;

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

function handleListTableTabsPointerMove(event: PointerEvent) {
  if (!listTableTabsDragState) {
    return;
  }

  const deltaX = event.clientX - listTableTabsDragState.startX;
  const deltaY = event.clientY - listTableTabsDragState.startY;

  if (
    !isDraggingListTableTabs.value &&
    Math.hypot(deltaX, deltaY) < LIST_TABLE_TABS_DRAG_THRESHOLD
  ) {
    return;
  }

  isDraggingListTableTabs.value = true;
  suppressListTableTabsClick.value = true;
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
  const wasDragging = isDraggingListTableTabs.value;

  listTableTabsDragState = null;
  isDraggingListTableTabs.value = false;
  stopListTableTabsDrag();

  if (wasDragging) {
    window.setTimeout(() => {
      suppressListTableTabsClick.value = false;
    }, 0);
  } else {
    suppressListTableTabsClick.value = false;
  }
}

function handleListTableTabsPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  listTableTabsDragState = {
    startLeft: listTableTabsPosition.x,
    startTop: listTableTabsPosition.y,
    startX: event.clientX,
    startY: event.clientY,
  };
  suppressListTableTabsClick.value = false;
  window.addEventListener('pointermove', handleListTableTabsPointerMove);
  window.addEventListener('pointerup', handleListTableTabsPointerUp);
  window.addEventListener('pointercancel', handleListTableTabsPointerUp);
}

function toggleListTableTabsCollapsed() {
  if (suppressListTableTabsClick.value) {
    return;
  }

  listTableTabsCollapsed.value = !listTableTabsCollapsed.value;
  nextTick(() => {
    setListTableTabsPosition(listTableTabsPosition.x, listTableTabsPosition.y);
  });
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
      fetchTreeOptions(
        '/rbac/authorizedOrgList',
        'name',
        'id',
        {
          assembleTree: true,
        },
        props.config.apiModuleBase,
      );
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

  for (const field of visibleFormFields.value) {
    result[field.key] =
      field.key in result
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
    return Array.isArray(value)
      ? value.map((item) => String(item)).filter(Boolean)
      : getDefaultValue(field);
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

  return value;
}

function serializeScalarValue(field: CrudFieldConfig, value: any) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (field.valueType === 'number' || field.type === 'number') {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new TypeError(`${field.label}的值[${value}]不是有效数字`);
    }
    return numberValue;
  }

  if (field.valueType === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }

    if (String(value).toLowerCase() === 'true') {
      return true;
    }

    if (String(value).toLowerCase() === 'false') {
      return false;
    }
  }

  return value;
}

function serializeFieldValue(field: CrudFieldConfig, value: any) {
  if (Array.isArray(value)) {
    return value.map((item) => serializeScalarValue(field, item));
  }

  return serializeScalarValue(field, value);
}

function serializeFormValue(field: CrudFieldConfig, value: any) {
  if (field.type === 'json') {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return undefined;
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

  return serializeFieldValue(field, value);
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
  const params: GenericRecord = {};

  for (const item of searchFieldItems.value) {
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
        : serializeFieldValue(field, searchState[field.key]);
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      continue;
    }

    params[field.key] = value;
  }

  return params;
}

function validateFormFields() {
  for (const field of visibleFormFields.value) {
    if (!field.required) {
      continue;
    }

    const value = formState[field.key];
    const isEmptyArray = Array.isArray(value) && value.length === 0;
    const isEmptyScalar =
      value === null || value === undefined || String(value).trim() === '';

    if (isEmptyArray || isEmptyScalar) {
      message.warning(`请填写${field.label}`);
      return false;
    }
  }

  return true;
}

function resetForm(record?: GenericRecord) {
  const nextState = buildEmptyState();

  for (const key of Object.keys(formState)) {
    delete formState[key];
  }

  for (const [key, value] of Object.entries(nextState)) {
    formState[key] = value;
  }

  if (!record) {
    return;
  }

  for (const field of visibleFormFields.value) {
    if (field.type === 'area-cascader') {
      formState[field.key] = getAreaCascaderValueFromRecord(field, record);
      continue;
    }

    formState[field.key] = normalizeFormValue(
      field,
      getRecordValue(record, field.key),
    );
  }
}

async function loadFieldOptions(field: CrudFieldConfig, keyword = '') {
  const loader = field.loadOptions || getDefaultOptionsLoader(field);

  if (!loader) {
    return;
  }

  optionLoadingState[field.key] = true;

  try {
    optionState[field.key] = await loader(keyword);
  } catch (error) {
    console.error(error);
    message.warning(`${field.label}选项加载失败`);
  } finally {
    optionLoadingState[field.key] = false;
  }
}

async function loadOptions() {
  await Promise.all(
    props.config.fields
      .filter((field) => field.loadOptions || getDefaultOptionsLoader(field))
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
    .filter((field) => field.type !== 'password')
    .map((field) => String(field.key));
}

function openExportModal() {
  exportFieldOrderKeys.value = getDefaultExportFieldOrder();
  exportSelectedFieldKeys.value = getDefaultSelectedExportFieldKeys();
  exportModalOpen.value = true;
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

function escapeExcelXmlValue(value: any) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getSafeWorksheetName(name: string) {
  const safeName = String(name || 'Sheet1')
    .replaceAll(/[\\/?*\[\]:]/g, '')
    .slice(0, 31)
    .trim();

  return safeName || 'Sheet1';
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
  const value = getRecordValue(record, field.key);

  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (field.type === 'tenant') {
    const tenant = getTenantDisplay(record);
    return tenant.id ? `${tenant.name} (${tenant.id})` : tenant.name;
  }

  if (isBooleanEnableField(field)) {
    return value ? '启用' : '禁用';
  }

  if (isNumericField(field)) {
    return formatNumericValue(field, value);
  }

  return String(formatCellValue(field, value)).replace(/^-$/, '');
}

function buildExcelXml(fields: CrudFieldConfig[], records: GenericRecord[]) {
  const headerXml = fields
    .map(
      (field) =>
        `<Cell><Data ss:Type="String">${escapeExcelXmlValue(
          field.label || field.key,
        )}</Data></Cell>`,
    )
    .join('');
  const rowXml = records
    .map((record) => {
      const cells = fields
        .map(
          (field) =>
            `<Cell><Data ss:Type="String">${escapeExcelXmlValue(
              formatExportCellValue(field, record),
            )}</Data></Cell>`,
        )
        .join('');

      return `<Row>${cells}</Row>`;
    })
    .join('');
  const worksheetName = getSafeWorksheetName(props.config.title);

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeExcelXmlValue(worksheetName)}">
  <Table>
   <Row>${headerXml}</Row>
   ${rowXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

function downloadExcelXml(xml: string, fileName: string) {
  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function fetchExportRecords() {
  const records: GenericRecord[] = [];
  let pageIndex = 1;

  while (true) {
    const result = await fetchCrudList<GenericRecord>(
      activeListPath.value,
      {
        ...props.config.defaultQuery,
        ...buildSearchParams(),
        ...buildSortParams(),
        pageIndex,
        pageSize: EXPORT_PAGE_SIZE,
      },
      props.config.apiModuleBase,
    );
    const items = result.items || [];

    if (items.length === 0) {
      break;
    }

    records.push(...items);

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
    const xml = buildExcelXml(fields, records);
    downloadExcelXml(xml, getExportFileName());
    message.success(`导出成功，共 ${records.length} 条`);
    exportModalOpen.value = false;
  } catch (error) {
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
    const result = await fetchCrudList<GenericRecord>(
      activeListPath.value,
      {
        ...props.config.defaultQuery,
        ...buildSearchParams(),
        ...buildSortParams(),
        pageIndex: pagination.current,
        pageSize: pagination.pageSize,
      },
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
  const params = Object.fromEntries(
    Object.entries({
      [recordKey.value]: record?.[recordKey.value],
      orgId: record?.orgId,
      tenantId: record?.tenantId,
    }).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );

  const response = await requestClient.get(
    buildModuleRequestPath(
      props.config.detailPath || `${props.config.apiBase}/retrieve`,
      props.config.apiModuleBase,
    ),
    {
      baseURL: '',
      params,
    },
  );

  openActionResult(
    `${getBusinessTitle(props.config.title)}详情`,
    'showForm',
    response,
  );
}

async function handleDelete(record: GenericRecord) {
  const recordId = record?.[recordKey.value];

  await deleteCrudRecord(
    props.config.deletePath || `${props.config.apiBase}/delete`,
    recordId,
    recordKey.value,
    props.config.apiModuleBase,
  );
  message.success('删除成功');
  await loadList();
}

async function handleSubmit() {
  if (!validateFormFields()) {
    return;
  }

  submitting.value = true;

  try {
    const payload: GenericRecord = {};

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

    for (const field of visibleFormFields.value) {
      if (field.type === 'area-cascader') {
        if (shouldOmitEmptyChoiceFormField(field, formState[field.key])) {
          continue;
        }

        applyAreaCascaderValueToRecord(
          payload,
          field,
          formState[field.key],
          getFieldOptions(field),
        );
        continue;
      }

      const value = serializeFormValue(field, formState[field.key]);

      if (shouldOmitEmptyChoiceFormField(field, value)) {
        continue;
      }

      payload[field.key] = value;
    }

    const isCreating = editingRecord.value?.[recordKey.value] === undefined;
    const createPath = resolveCrudPath(
      props.config.createPath,
      `${props.config.apiBase}/create`,
      payload,
      editingRecord.value,
    );
    const finalPayload = props.config.transformSubmit
      ? await props.config.transformSubmit(payload, editingRecord.value)
      : payload;

    if (isCreating) {
      await createCrudRecord(
        createPath,
        finalPayload,
        props.config.apiModuleBase,
      );
      message.success('创建成功');
    } else {
      await updateCrudRecord(
        props.config.updatePath || `${props.config.apiBase}/update`,
        finalPayload,
        props.config.apiModuleBase,
      );
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
  for (const item of searchFieldItems.value) {
    if (item.kind === 'range') {
      searchState[item.key] = undefined;
      continue;
    }

    searchState[item.field.key] = undefined;
  }

  pagination.current = 1;
  loadList();
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
  if (suppressListTableTabsClick.value) {
    return;
  }

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

async function refreshTable() {
  await loadList();
}

function toggleTableFullscreen() {
  tableFullscreen.value = !tableFullscreen.value;
  updateTableScrollY();
}

function normalizeTableColumnFixedMode(value: unknown) {
  return value === 'left' || value === 'right' || value === 'none'
    ? value
    : undefined;
}

function getDefaultTableColumnFixed(field: CrudFieldConfig) {
  if (field.fixed === true) {
    return 'left';
  }

  return field.fixed === 'left' || field.fixed === 'right'
    ? field.fixed
    : undefined;
}

function getTableColumnFixed(field: CrudFieldConfig) {
  const mode = tableColumnFixedState[String(field.key)];

  if (mode === 'none') {
    return undefined;
  }

  return mode || getDefaultTableColumnFixed(field);
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

function getAvailableTableFieldKeys() {
  return new Set(tableFields.value.map((field) => String(field.key)));
}

function getDefaultTableColumnOrder() {
  return tableFields.value.map(getTableFieldKey);
}

function normalizeTableColumnOrder(keys: string[] = []) {
  const availableKeys = getAvailableTableFieldKeys();
  const seenKeys = new Set<string>();
  const orderedKeys: string[] = [];

  for (const key of keys.map(String)) {
    if (availableKeys.has(key) && !seenKeys.has(key)) {
      seenKeys.add(key);
      orderedKeys.push(key);
    }
  }

  for (const key of getDefaultTableColumnOrder()) {
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      orderedKeys.push(key);
    }
  }

  return orderedKeys;
}

function getOrderedTableFields(keys: string[] = []) {
  const fieldMap = new Map(
    tableFields.value.map((field) => [getTableFieldKey(field), field]),
  );

  return normalizeTableColumnOrder(keys)
    .map((key) => fieldMap.get(key))
    .filter(Boolean) as CrudFieldConfig[];
}

function isTableColumnOrderCustomized(keys = tableColumnOrderKeys.value) {
  const normalizedKeys = normalizeTableColumnOrder(keys);
  const defaultKeys = getDefaultTableColumnOrder();

  return normalizedKeys.some((key, index) => key !== defaultKeys[index]);
}

function pruneTableColumnPreference() {
  const availableKeys = getAvailableTableFieldKeys();
  let changed = false;
  const nextHiddenKeys = hiddenTableColumnKeys.value.filter((key) =>
    availableKeys.has(key),
  );

  if (nextHiddenKeys.length !== hiddenTableColumnKeys.value.length) {
    hiddenTableColumnKeys.value = nextHiddenKeys;
    changed = true;
  }

  const nextOrderKeys = normalizeTableColumnOrder(tableColumnOrderKeys.value);
  const normalizedOrderKeys = isTableColumnOrderCustomized(nextOrderKeys)
    ? nextOrderKeys
    : [];

  if (
    normalizedOrderKeys.length !== tableColumnOrderKeys.value.length ||
    normalizedOrderKeys.some(
      (key, index) => key !== tableColumnOrderKeys.value[index],
    )
  ) {
    tableColumnOrderKeys.value = normalizedOrderKeys;
    changed = true;
  }

  for (const key of Object.keys(tableColumnFixedState)) {
    const field = tableFields.value.find(
      (fieldItem) => String(fieldItem.key) === key,
    );
    const mode = tableColumnFixedState[key];

    if (!availableKeys.has(key)) {
      delete tableColumnFixedState[key];
      changed = true;
      continue;
    }

    if (
      !mode ||
      (mode === 'none' && !getDefaultTableColumnFixed(field!)) ||
      mode === getDefaultTableColumnFixed(field!)
    ) {
      delete tableColumnFixedState[key];
      changed = true;
    }
  }

  return changed;
}

function saveTableColumnPreference() {
  if (typeof window === 'undefined') {
    return;
  }

  pruneTableColumnPreference();

  if (
    hiddenTableColumnKeys.value.length === 0 &&
    tableColumnOrderKeys.value.length === 0 &&
    Object.keys(tableColumnFixedState).length === 0
  ) {
    clearTableColumnPreference();
    return;
  }

  const preference: TableColumnPreference = {
    fixedMap: { ...tableColumnFixedState },
    hiddenKeys: [...hiddenTableColumnKeys.value],
    orderedKeys: [...tableColumnOrderKeys.value],
    version: TABLE_COLUMN_PREFERENCE_VERSION,
  };

  window.localStorage.setItem(
    tableColumnPreferenceStorageKey.value,
    JSON.stringify(preference),
  );
}

function clearTableColumnPreference() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(tableColumnPreferenceStorageKey.value);
  }
}

function loadTableColumnPreference() {
  if (typeof window === 'undefined') {
    return;
  }

  resetReactiveRecord(tableColumnFixedState);
  hiddenTableColumnKeys.value = [];
  tableColumnOrderKeys.value = [];

  const rawValue = window.localStorage.getItem(
    tableColumnPreferenceStorageKey.value,
  );

  if (!rawValue) {
    return;
  }

  try {
    const preference = JSON.parse(rawValue) as TableColumnPreference;
    const availableKeys = getAvailableTableFieldKeys();
    hiddenTableColumnKeys.value = (preference.hiddenKeys || [])
      .map(String)
      .filter((key) => availableKeys.has(key));
    const orderedKeys = normalizeTableColumnOrder(preference.orderedKeys || []);
    tableColumnOrderKeys.value = isTableColumnOrderCustomized(orderedKeys)
      ? orderedKeys
      : [];

    for (const [key, value] of Object.entries(preference.fixedMap || {})) {
      const columnKey = String(key);
      const mode = normalizeTableColumnFixedMode(value);
      if (mode && availableKeys.has(columnKey)) {
        tableColumnFixedState[columnKey] = mode;
      }
    }
  } catch (error) {
    console.warn('读取表格列设置失败，已恢复默认列设置。', error);
    clearTableColumnPreference();
  }
}

function getTableColumnSettingsSnapshot(): TableColumnSettingsSnapshot {
  return {
    fixedMap: { ...tableColumnFixedState },
    hiddenKeys: [...hiddenTableColumnKeys.value],
    orderedKeys: [...tableColumnOrderKeys.value],
  };
}

function restoreTableColumnSettings(snapshot: TableColumnSettingsSnapshot) {
  hiddenTableColumnKeys.value = [...snapshot.hiddenKeys];
  tableColumnOrderKeys.value = [...snapshot.orderedKeys];
  copyReactiveRecord(tableColumnFixedState, snapshot.fixedMap);
  openTableColumnSettings(false);
  updateTableScrollY();
}

function syncDraftTableColumnSettingsToTable() {
  hiddenTableColumnKeys.value = [...draftHiddenTableColumnKeys.value];
  tableColumnOrderKeys.value = normalizeTableColumnOrder(
    draftTableColumnOrderKeys.value,
  );
  copyReactiveRecord(tableColumnFixedState, draftTableColumnFixedState);
  updateTableScrollY();
}

function openTableColumnSettings(captureSnapshot = true) {
  if (captureSnapshot) {
    columnSettingsSnapshot.value = getTableColumnSettingsSnapshot();
  }

  draftHiddenTableColumnKeys.value = [...hiddenTableColumnKeys.value];
  draftTableColumnOrderKeys.value = normalizeTableColumnOrder(
    tableColumnOrderKeys.value,
  );
  copyReactiveRecord(draftTableColumnFixedState, tableColumnFixedState);
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

function getDraftTableColumnIndex(field: CrudFieldConfig) {
  return normalizeTableColumnOrder(draftTableColumnOrderKeys.value).indexOf(
    getTableFieldKey(field),
  );
}

function moveDraftTableColumn(field: CrudFieldConfig, offset: -1 | 1) {
  const columnKey = getTableFieldKey(field);
  const orderedKeys = normalizeTableColumnOrder(
    draftTableColumnOrderKeys.value,
  );
  const currentIndex = orderedKeys.indexOf(columnKey);
  const nextIndex = currentIndex + offset;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedKeys.length) {
    return;
  }

  const [movedKey] = orderedKeys.splice(currentIndex, 1);
  orderedKeys.splice(nextIndex, 0, movedKey!);
  draftTableColumnOrderKeys.value = orderedKeys;
  syncDraftTableColumnSettingsToTable();
}

function handleDraftTableColumnDragStart(
  event: DragEvent,
  field: CrudFieldConfig,
) {
  const columnKey = getTableFieldKey(field);
  draggedDraftTableColumnKey.value = columnKey;
  event.dataTransfer?.setData('text/plain', columnKey);

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function handleDraftTableColumnDragOver(event: DragEvent) {
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleDraftTableColumnDrop(
  event: DragEvent,
  targetField: CrudFieldConfig,
) {
  event.preventDefault();

  const sourceKey =
    draggedDraftTableColumnKey.value ||
    event.dataTransfer?.getData('text/plain') ||
    '';
  const targetKey = getTableFieldKey(targetField);

  if (!sourceKey || sourceKey === targetKey) {
    draggedDraftTableColumnKey.value = '';
    return;
  }

  const orderedKeys = normalizeTableColumnOrder(
    draftTableColumnOrderKeys.value,
  );
  const sourceIndex = orderedKeys.indexOf(sourceKey);
  const targetIndex = orderedKeys.indexOf(targetKey);

  if (sourceIndex < 0 || targetIndex < 0) {
    draggedDraftTableColumnKey.value = '';
    return;
  }

  const [movedKey] = orderedKeys.splice(sourceIndex, 1);
  orderedKeys.splice(
    sourceIndex < targetIndex ? targetIndex - 1 : targetIndex,
    0,
    movedKey!,
  );
  draftTableColumnOrderKeys.value = orderedKeys;
  draggedDraftTableColumnKey.value = '';
  syncDraftTableColumnSettingsToTable();
}

function handleDraftTableColumnDragEnd() {
  draggedDraftTableColumnKey.value = '';
}

function getDraftTableColumnFixedMode(
  field: CrudFieldConfig,
): TableColumnFixedMode {
  const mode = draftTableColumnFixedState[String(field.key)];

  if (mode === 'none') {
    return 'none';
  }

  return mode || getDefaultTableColumnFixed(field) || 'none';
}

function setDraftTableColumnFixed(key: string, mode: TableColumnFixedMode) {
  draftTableColumnFixedState[String(key)] = mode;
  syncDraftTableColumnSettingsToTable();
}

function toggleDraftTableColumnFixed(
  field: CrudFieldConfig,
  mode: Exclude<TableColumnFixedMode, 'none'>,
) {
  const currentMode = getDraftTableColumnFixedMode(field);
  setDraftTableColumnFixed(field.key, currentMode === mode ? 'none' : mode);
}

function applyTableColumnSettings() {
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
  draftTableColumnOrderKeys.value = normalizeTableColumnOrder();
  resetReactiveRecord(draftTableColumnFixedState);
  syncDraftTableColumnSettingsToTable();
  updateTableScrollY();
}

function getFieldOptions(field: CrudFieldConfig): any[] {
  return optionState[field.key] || field.options || [];
}

function getPlaceholder(field: CrudFieldConfig) {
  if (field.placeholder) {
    return field.placeholder;
  }

  if (
    field.type === 'area-cascader' ||
    field.type === 'org-tree-select' ||
    field.type === 'role-select' ||
    field.type === 'select'
  ) {
    return `请选择${field.label}`;
  }

  return `请输入${field.label}`;
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
  return !!field.multiple;
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
  formState[field.key] = isMultiUploadField(field) ? urls : (urls[0] ?? '');
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
  try {
    const rawFile = options.file as File;
    const uploadFile =
      isImageUploadField(field) && !isMultiUploadField(field)
        ? (await cropImageFile(rawFile)) || rawFile
        : rawFile;
    const url = await uploadFileByFileStorageController(
      uploadFile,
      props.config.apiModuleBase,
      field.uploadPath ||
        (isMultiUploadField(field)
          ? FILE_STORAGE_MULTI_UPLOAD_PATH
          : FILE_STORAGE_SINGLE_UPLOAD_PATH),
    );
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

  if (!field || !modalOpen.value || !isImageUploadField(field)) {
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
  if (!isImageUploadField(field)) {
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
  if (!isImageUploadField(field)) {
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
  if (field.allowInput && !field.multiple) {
    formState[field.key] = keyword;
  }

  if (!isRemoteSearchField(field)) {
    return;
  }

  void loadFieldOptions(field, keyword);
}

function handleSearchSelectSearch(field: CrudFieldConfig, keyword: string) {
  if (field.allowInput && !field.multiple) {
    searchState[field.key] = keyword;
  }

  if (!isRemoteSearchField(field)) {
    return;
  }

  void loadFieldOptions(field, keyword);
}

function handleSelectChange(field: CrudFieldConfig, value: any) {
  if (!field.allowInput || field.multiple || value) {
    return;
  }

  formState[field.key] = undefined;
}

function handleSearchSelectChange(field: CrudFieldConfig, value: any) {
  if (!field.allowInput || field.multiple || value) {
    return;
  }

  searchState[field.key] = undefined;
}

function formatCellValue(field: CrudFieldConfig, value: any) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (field.type === 'switch') {
    return value ? '是' : '否';
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

  const options = getFieldOptions(field);
  const matched = options.find((item) => item.value === value);

  return matched?.label || String(value);
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
    field.type === 'switch' ||
    (field.type === 'select' &&
      (/status|state/i.test(field.key) || /状态/.test(field.label)))
  );
}

function isBooleanEnableField(field: CrudFieldConfig | undefined) {
  if (!field || field.type !== 'switch' || field.valueType !== 'boolean') {
    return false;
  }

  return (
    /^(is)?(enable|enabled|disable|disabled)$/i.test(field.key) ||
    /启用|禁用/.test(field.label)
  );
}

function canQuickUpdateBooleanEnableField(
  field: CrudFieldConfig | undefined,
  record: GenericRecord,
) {
  return isBooleanEnableField(field) && canShowBuiltinEdit(record);
}

function getStatusTagColor(field: CrudFieldConfig | undefined, value: any) {
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

function getConfigField(key: unknown) {
  if (typeof key !== 'string') {
    return undefined;
  }

  return allFieldMap.value[key];
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

function shouldUseCellTooltip(field: CrudFieldConfig | undefined, value: any) {
  if (!field) {
    return false;
  }

  const text = formatCellValue(field, value);
  return (
    [
      'code',
      'css',
      'html',
      'json',
      'string-array',
      'tags',
      'textarea',
    ].includes(field.type || '') || text.length > 28
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
    canUseCurrentStatusEvent(record, '编辑') &&
    (!props.config.editVisibleOn ||
      evaluateCrudVisibleOn(
        props.config.editVisibleOn,
        record,
        userStore.userInfo,
      ))
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
    await updateCrudRecord(
      props.config.updatePath || `${props.config.apiBase}/update`,
      {
        [recordKey.value]: getRecordValue(record, recordKey.value),
        optimisticLock: record.optimisticLock,
        [fieldKey]: checked,
      },
      props.config.apiModuleBase,
    );
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

function formatActionResultKey(key: string) {
  const field = getConfigField(key);
  if (field?.label) {
    return field.label;
  }

  const keyLabelMap: Record<string, string> = {
    id: 'ID',
    name: '名称',
  };

  if (keyLabelMap[key]) {
    return keyLabelMap[key];
  }

  return key
    .replaceAll(/([A-Z])/g, ' $1')
    .replace(/^./, (value) => value.toUpperCase());
}

function formatActionResultValue(key: string, value: any) {
  const field = getConfigField(key);
  if (!field) {
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }

    return String(value);
  }

  if (Array.isArray(value) && (field.multiple || field.type === 'tags')) {
    return getDisplayTagValues(field, value).join(', ');
  }

  return formatCellValue(field, value);
}

const actionResultEntries = computed(() => {
  const data = actionResultData.value;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [];
  }

  return Object.entries(data).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
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

async function runRowAction(
  action: CrudRowAction,
  record: GenericRecord | GenericRecord[],
) {
  if (!action) {
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
  loadTableColumnPreference();
  await loadOptions();
  await loadList();

  if (typeof ResizeObserver !== 'undefined' && listSectionRef.value) {
    listSectionResizeObserver = new ResizeObserver(updateTableScrollY);
    listSectionResizeObserver.observe(listSectionRef.value);
  }

  updateTableScrollY();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleViewportResize);
  window.removeEventListener('paste', handlePasteUpload);
  stopListTableTabsDrag();
  listSectionResizeObserver?.disconnect();
  listSectionResizeObserver = null;
});

watch(modalOpen, (open) => {
  if (!open) {
    hoveredImageUploadTarget.value = null;
  }
});

watch(columnSettingsOpen, (open) => {
  if (open) {
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
  const changed = pruneTableColumnPreference();

  if (changed) {
    saveTableColumnPreference();
  }
});

watch(tableColumnPreferenceStorageKey, () => {
  loadTableColumnPreference();
  updateTableScrollY();
});
</script>

<template>
  <Page
    auto-content-height
    content-class="!bg-transparent !p-0 min-w-0 !overflow-hidden"
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
        @pointerdown="handleListTableTabsPointerDown"
      >
        <Tooltip
          :title="listTableTabsCollapsed ? '展开列表切换' : '收起列表切换'"
        >
          <button
            type="button"
            class="vben-crud-list-tabs-toggle"
            :aria-label="
              listTableTabsCollapsed ? '展开列表切换' : '收起列表切换'
            "
            @click.stop="toggleListTableTabsCollapsed"
          >
            <IconifyIcon
              class="size-4"
              :icon="
                listTableTabsCollapsed
                  ? 'lucide:panel-left-open'
                  : 'lucide:panel-left-close'
              "
            />
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

      <div v-if="searchFieldItems.length > 0" class="vben-crud-section">
        <Form :label-col="{ style: { width: '88px' } }">
          <div class="grid gap-x-4 gap-y-4" :style="searchGridStyle">
            <Form.Item
              v-for="item in visibleSearchFieldItems"
              :key="item.key"
              :label="item.kind === 'range' ? item.label : item.field.label"
              class="mb-0 min-w-0"
            >
              <template
                v-if="item.kind === 'field' && hasSearchFieldSlot(item.field)"
              >
                <slot
                  :name="resolveSearchFieldSlotName(item.field)"
                  :field="item.field"
                  :search-state="searchState"
                ></slot>
              </template>
              <DatePicker.RangePicker
                v-else-if="item.kind === 'range' && item.format !== 'time'"
                v-model:value="searchState[item.key]"
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
                v-model:value="searchState[item.key]"
                class="w-full"
                :placeholder="['开始时间', '结束时间']"
                value-format="HH:mm:ss"
              />
              <Cascader
                v-else-if="item.field.type === 'area-cascader'"
                v-model:value="searchState[item.field.key]"
                :allow-clear="true"
                :change-on-select="true"
                :options="getFieldOptions(item.field)"
                :placeholder="getPlaceholder(item.field)"
                class="w-full"
                show-search
              />
              <TreeSelect
                v-else-if="item.field.type === 'org-tree-select'"
                v-model:value="searchState[item.field.key]"
                :allow-clear="true"
                class="w-full"
                :loading="optionLoadingState[item.field.key]"
                :multiple="item.field.multiple"
                :placeholder="getPlaceholder(item.field)"
                show-search
                :tree-checkable="item.field.multiple"
                :tree-data="getFieldOptions(item.field)"
                tree-default-expand-all
                tree-node-filter-prop="label"
              />
              <AutoComplete
                v-else-if="
                  (item.field.type === 'select' ||
                    item.field.type === 'role-select') &&
                  item.field.allowInput &&
                  !item.field.multiple
                "
                v-model:value="searchState[item.field.key]"
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
                @search="handleSearchSelectSearch(item.field, $event)"
              />
              <Select
                v-else-if="
                  item.field.type === 'select' ||
                  item.field.type === 'role-select'
                "
                v-model:value="searchState[item.field.key]"
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
                @change="(value) => handleSearchSelectChange(item.field, value)"
                @search="handleSearchSelectSearch(item.field, $event)"
              />
              <Select
                v-else-if="item.field.type === 'switch'"
                v-model:value="searchState[item.field.key]"
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
                v-model:value="searchState[item.field.key]"
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
                v-model:value="searchState[item.field.key]"
                class="w-full"
                :placeholder="getPlaceholder(item.field)"
                value-format="HH:mm:ss"
              />
              <InputNumber
                v-else-if="item.field.type === 'number'"
                v-model:value="searchState[item.field.key]"
                :placeholder="getPlaceholder(item.field)"
                class="w-full"
              />
              <Input
                v-else
                v-model:value="searchState[item.field.key]"
                :placeholder="getPlaceholder(item.field)"
                class="w-full"
              />
            </Form.Item>
          </div>

          <div class="mt-4 flex justify-end">
            <div class="flex flex-wrap items-center justify-end gap-2">
              <Button
                v-if="canQuery"
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
              <Button @click="resetSearch">重置</Button>
              <Button
                v-if="showAdvancedSearchToggle"
                type="link"
                class="inline-flex items-center gap-1"
                @click="toggleSearchExpanded"
              >
                {{ searchExpanded ? '收起' : '更多' }}
                <ChevronDown
                  class="size-4 transition-transform"
                  :class="{ 'rotate-180': searchExpanded }"
                />
              </Button>
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
                :disabled="exportableFields.length === 0"
                @click="openExportModal"
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
                <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
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
              v-model:open="columnSettingsOpen"
              placement="bottomRight"
              trigger="click"
              overlay-class-name="vben-crud-column-popover"
            >
              <template #content>
                <div class="w-[380px] max-w-[80vw]">
                  <div class="mb-2 border-b border-border pb-2">
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
                    <div
                      class="mt-2 flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <IconifyIcon
                        class="size-3.5"
                        icon="lucide:grip-vertical"
                      />
                      拖动排序，或使用上下箭头调整列顺序
                    </div>
                  </div>
                  <div class="flex max-h-96 flex-col overflow-auto">
                    <div
                      v-for="field in draftOrderedTableFields"
                      :key="field.key"
                      class="vben-crud-column-setting-row"
                      :class="{
                        'is-dragging':
                          draggedDraftTableColumnKey ===
                          getTableFieldKey(field),
                      }"
                      draggable="true"
                      @dragend="handleDraftTableColumnDragEnd"
                      @dragover="handleDraftTableColumnDragOver"
                      @dragstart="
                        (event) => handleDraftTableColumnDragStart(event, field)
                      "
                      @drop="
                        (event) => handleDraftTableColumnDrop(event, field)
                      "
                    >
                      <span
                        class="vben-crud-column-drag-handle"
                        title="拖动排序"
                      >
                        <IconifyIcon
                          class="size-4"
                          icon="lucide:grip-vertical"
                        />
                      </span>
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
                      <Space :size="2">
                        <button
                          type="button"
                          class="vben-crud-column-pin"
                          :disabled="getDraftTableColumnIndex(field) <= 0"
                          title="上移"
                          @click="moveDraftTableColumn(field, -1)"
                        >
                          <ArrowUp class="size-4" />
                        </button>
                        <button
                          type="button"
                          class="vben-crud-column-pin"
                          :disabled="
                            getDraftTableColumnIndex(field) >=
                            draftOrderedTableFields.length - 1
                          "
                          title="下移"
                          @click="moveDraftTableColumn(field, 1)"
                        >
                          <ArrowDown class="size-4" />
                        </button>
                      </Space>
                      <Space :size="4">
                        <button
                          type="button"
                          class="vben-crud-column-pin"
                          :class="{
                            'is-active':
                              getDraftTableColumnFixedMode(field) === 'left',
                          }"
                          title="固定到左侧"
                          @click="toggleDraftTableColumnFixed(field, 'left')"
                        >
                          <i class="vxe-icon-fixed-left"></i>
                        </button>
                        <button
                          type="button"
                          class="vben-crud-column-pin"
                          :class="{
                            'is-active':
                              getDraftTableColumnFixedMode(field) === 'right',
                          }"
                          title="固定到右侧"
                          @click="toggleDraftTableColumnFixed(field, 'right')"
                        >
                          <i class="vxe-icon-fixed-right"></i>
                        </button>
                      </Space>
                    </div>
                  </div>
                  <div
                    class="mt-3 flex items-center justify-between border-t border-border pt-3"
                  >
                    <Button
                      type="link"
                      class="p-0"
                      :disabled="!hasTableColumnCustomization"
                      @click="resetTableColumns"
                    >
                      恢复默认
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
                :value="getRecordValue(record, column.key)"
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
                      {{ action.label }}
                    </Button>
                  </Popconfirm>
                  <Button
                    v-else
                    :danger="action.danger"
                    size="small"
                    type="link"
                    @click="runRowAction(action, record)"
                  >
                    {{ action.label }}
                  </Button>
                </template>
              </Space>
            </template>
            <template v-else>
              <Switch
                v-if="
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
              <Tag
                v-else-if="isStatusLikeField(getTableField(column.key))"
                :color="
                  getTableField(column.key)?.type === 'switch'
                    ? getRecordValue(record, column.key)
                      ? 'green'
                      : 'default'
                    : getStatusTagColor(
                        getTableField(column.key),
                        getRecordValue(record, column.key),
                      )
                "
              >
                {{
                  getTableField(column.key)?.type === 'switch'
                    ? getRecordValue(record, column.key)
                      ? '启用'
                      : '关闭'
                    : formatCellValue(
                        getTableField(column.key)!,
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
                    getRecordValue(record, column.key),
                  )
                "
                :href="String(getRecordValue(record, column.key) || '')"
                rel="noopener noreferrer"
                target="_blank"
              >
                {{
                  formatCellValue(
                    getTableField(column.key)!,
                    getRecordValue(record, column.key),
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
                  class="text-xs text-muted-foreground"
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
                    getRecordValue(record, column.key),
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
                  <Space :size="4" wrap>
                    <Tag
                      v-for="tag in getDisplayTagValues(
                        getTableField(column.key),
                        getRecordValue(record, column.key),
                      ).slice(0, 3)"
                      :key="tag"
                    >
                      {{ tag }}
                    </Tag>
                    <Tooltip
                      v-if="
                        getDisplayTagValues(
                          getTableField(column.key),
                          getRecordValue(record, column.key),
                        ).length > 3
                      "
                      :title="
                        formatCellValue(
                          getTableField(column.key)!,
                          getRecordValue(record, column.key),
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
                      getRecordValue(record, column.key),
                    )
                  "
                  :title="
                    formatCellValue(
                      getTableField(column.key)!,
                      getRecordValue(record, column.key),
                    )
                  "
                >
                  <span
                    class="inline-block max-w-[240px] truncate align-bottom"
                  >
                    {{
                      formatCellValue(
                        getTableField(column.key)!,
                        getRecordValue(record, column.key),
                      )
                    }}
                  </span>
                </Tooltip>
                <template v-else>
                  {{
                    formatCellValue(
                      getTableField(column.key)!,
                      getRecordValue(record, column.key),
                    )
                  }}
                </template>
              </span>
            </template>
          </template>
        </Table>
      </div>
    </div>

    <Modal
      :confirm-loading="exporting"
      :open="exportModalOpen"
      title="导出 Excel"
      width="520px"
      destroy-on-close
      @cancel="exportModalOpen = false"
      @ok="handleExportConfirm"
    >
      <div class="vben-crud-export-modal">
        <div class="mb-2 border-b border-border pb-2">
          <Checkbox
            :checked="allExportFieldsSelected"
            :indeterminate="exportFieldsIndeterminate"
            @change="
              (event) => setAllExportFieldsSelected(event.target.checked)
            "
          >
            全部字段
          </Checkbox>
          <div
            class="mt-2 flex items-center gap-1 text-xs text-muted-foreground"
          >
            <IconifyIcon class="size-3.5" icon="lucide:arrow-up-down" />
            默认按当前表格列顺序导出，可使用上下箭头调整导出列顺序
          </div>
        </div>
        <div class="flex max-h-[420px] flex-col overflow-auto">
          <div
            v-for="(field, index) in orderedExportFields"
            :key="field.key"
            class="vben-crud-export-field-row"
          >
            <Checkbox
              :checked="exportSelectedFieldKeys.includes(String(field.key))"
              @change="
                (event) =>
                  setExportFieldSelected(field.key, event.target.checked)
              "
            >
              {{ field.label }}
            </Checkbox>
            <Space :size="2">
              <button
                type="button"
                class="vben-crud-column-pin"
                :disabled="index <= 0"
                title="上移"
                @click="moveExportField(field, -1)"
              >
                <ArrowUp class="size-4" />
              </button>
              <button
                type="button"
                class="vben-crud-column-pin"
                :disabled="index >= orderedExportFields.length - 1"
                title="下移"
                @click="moveExportField(field, 1)"
              >
                <ArrowDown class="size-4" />
              </button>
            </Space>
          </div>
        </div>
      </div>
    </Modal>

    <Modal
      v-if="canCreate || (canEdit && editingRecord)"
      :confirm-loading="submitting"
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
      <Form
        layout="vertical"
        class="w-full max-w-full"
        :style="formContainerStyle"
      >
        <div class="grid gap-x-4 gap-y-4" :style="formGridStyle">
          <Form.Item
            v-for="field in visibleFormFields"
            :key="field.key"
            :label="field.label"
            :required="field.required"
            class="mb-0 w-full justify-self-center"
            :class="{
              'col-span-full':
                field.fullRow ||
                field.span === -1 ||
                field.type === 'textarea' ||
                field.type === 'string-array' ||
                field.type === 'tags',
              'md:col-span-2':
                field.span === 2 &&
                !field.fullRow &&
                field.type !== 'textarea' &&
                field.type !== 'string-array' &&
                field.type !== 'tags',
              'max-w-[480px]':
                !field.fullRow &&
                field.span !== -1 &&
                field.type !== 'textarea' &&
                field.type !== 'string-array' &&
                field.type !== 'tags',
            }"
            :style="getFormItemStyle(field)"
          >
            <template v-if="hasFormFieldSlot(field)">
              <slot
                :name="resolveFormFieldSlotName(field)"
                :editing-record="editingRecord"
                :field="field"
                :form-state="formState"
              ></slot>
            </template>
            <Input.Password
              v-else-if="field.type === 'password'"
              v-model:value="formState[field.key]"
              class="w-full"
              :placeholder="getPlaceholder(field)"
            />
            <Cascader
              v-else-if="field.type === 'area-cascader'"
              v-model:value="formState[field.key]"
              :allow-clear="true"
              :change-on-select="true"
              :disabled="field.disabledOnEdit && !!editingRecord"
              :options="getFieldOptions(field)"
              :placeholder="getPlaceholder(field)"
              class="w-full"
              show-search
            />
            <TreeSelect
              v-else-if="field.type === 'org-tree-select'"
              v-model:value="formState[field.key]"
              :allow-clear="true"
              class="w-full"
              :disabled="field.disabledOnEdit && !!editingRecord"
              :loading="optionLoadingState[field.key]"
              :multiple="field.multiple"
              :placeholder="getPlaceholder(field)"
              show-search
              :tree-checkable="field.multiple"
              :tree-data="getFieldOptions(field)"
              tree-default-expand-all
              tree-node-filter-prop="label"
            />
            <div
              v-else-if="isFileUploadField(field)"
              @mouseleave="handleUploadMouseLeave(field)"
              @mousemove="
                handleUploadAreaMouseMove(field, $event as MouseEvent)
              "
            >
              <Upload
                :accept="isImageUploadField(field) ? 'image/*' : undefined"
                :custom-request="(options) => uploadCrudFile(field, options)"
                :file-list="getUploadFileList(field)"
                :item-render="
                  ({ originNode, file }) =>
                    renderUploadItem(field, originNode, file)
                "
                :list-type="isImageUploadField(field) ? 'picture-card' : 'text'"
                :max-count="isMultiUploadField(field) ? undefined : 1"
                :multiple="isMultiUploadField(field)"
                @preview="handleUploadPreview"
                @remove="(file) => removeCrudUploadFile(field, file)"
              >
                <Button
                  v-if="
                    !isImageUploadField(field) && shouldShowUploadTrigger(field)
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
              v-else-if="field.type === 'json'"
              v-model="formState[field.key]"
              :disabled="field.disabledOnEdit && !!editingRecord"
              :modal-style="modalStyle"
              :modal-width="modalWidth"
              :title="field.label"
            />
            <CodeEditorField
              v-else-if="
                field.type === 'code' ||
                field.type === 'css' ||
                field.type === 'html'
              "
              v-model="formState[field.key]"
              :disabled="field.disabledOnEdit && !!editingRecord"
              :language="getCodeEditorLanguage(field)"
              :modal-style="modalStyle"
              :modal-width="modalWidth"
              :title="field.label"
            />
            <Input.TextArea
              v-else-if="
                field.type === 'textarea' || field.type === 'string-array'
              "
              v-model:value="formState[field.key]"
              :auto-size="{ minRows: 3, maxRows: 8 }"
              :placeholder="getPlaceholder(field)"
            />
            <DatePicker
              v-else-if="field.type === 'datetime' || field.type === 'date'"
              v-model:value="formState[field.key]"
              class="w-full"
              :placeholder="getPlaceholder(field)"
              :show-time="field.type === 'datetime'"
              :value-format="
                field.type === 'datetime' ? 'YYYY-MM-DDTHH:mm:ss' : 'YYYY-MM-DD'
              "
            />
            <TimePicker
              v-else-if="field.type === 'time'"
              v-model:value="formState[field.key]"
              class="w-full"
              :placeholder="getPlaceholder(field)"
              value-format="HH:mm:ss"
            />
            <InputNumber
              v-else-if="field.type === 'number'"
              v-model:value="formState[field.key]"
              class="w-full"
              :placeholder="getPlaceholder(field)"
            />
            <AutoComplete
              v-else-if="
                (field.type === 'select' || field.type === 'role-select') &&
                field.allowInput &&
                !field.multiple
              "
              v-model:value="formState[field.key]"
              :allow-clear="true"
              :disabled="field.disabledOnEdit && !!editingRecord"
              :options="getFieldOptions(field)"
              :placeholder="getPlaceholder(field)"
              :filter-option="
                isRemoteSearchField(field) ? false : filterSelectOptionByLabel
              "
              :loading="optionLoadingState[field.key]"
              class="w-full"
              @search="handleSelectSearch(field, $event)"
            />
            <Select
              v-else-if="
                field.type === 'select' || field.type === 'role-select'
              "
              v-model:value="formState[field.key]"
              :allow-clear="true"
              :disabled="field.disabledOnEdit && !!editingRecord"
              :mode="field.multiple ? 'multiple' : undefined"
              :options="getFieldOptions(field)"
              :placeholder="getPlaceholder(field)"
              :filter-option="
                isRemoteSearchField(field) ? false : filterSelectOptionByLabel
              "
              :loading="optionLoadingState[field.key]"
              class="w-full"
              show-search
              @change="(value) => handleSelectChange(field, value)"
              @search="handleSelectSearch(field, $event)"
            />
            <Select
              v-else-if="field.type === 'tags'"
              v-model:value="formState[field.key]"
              :options="getFieldOptions(field)"
              :placeholder="getPlaceholder(field)"
              :filter-option="
                isRemoteSearchField(field) ? false : filterSelectOptionByLabel
              "
              :loading="optionLoadingState[field.key]"
              class="w-full"
              mode="tags"
              show-search
              @search="handleSelectSearch(field, $event)"
            />
            <Switch
              v-else-if="field.type === 'switch'"
              v-model:checked="formState[field.key]"
            />
            <Input
              v-else
              v-model:value="formState[field.key]"
              :disabled="field.disabledOnEdit && !!editingRecord"
              class="w-full"
              :placeholder="getPlaceholder(field)"
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>

    <Modal
      v-model:open="actionResultOpen"
      :footer="null"
      :title="actionResultTitle"
      :width="actionResultMode === 'showForm' ? '70vw' : '720px'"
    >
      <div
        v-if="actionResultMode === 'showQrCode'"
        class="flex flex-col items-center gap-4 py-4"
      >
        <QRCode :value="String(actionResultQrValue || '')" />
        <div
          class="max-w-full break-all text-center text-sm text-muted-foreground"
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
          class="h-[70vh] w-full rounded-lg border border-border"
        ></iframe>
      </div>
      <div
        v-else-if="
          actionResultMode === 'showForm' && actionResultEntries.length > 0
        "
        class="grid gap-4 md:grid-cols-2"
      >
        <div
          v-for="[key, value] in actionResultEntries"
          :key="key"
          class="rounded-lg border border-border bg-muted/30 p-4"
          :class="{
            'md:col-span-2': typeof value === 'object',
          }"
        >
          <div class="mb-2 text-sm font-medium">
            {{ formatActionResultKey(key) }}
          </div>
          <div
            v-if="typeof value === 'object'"
            class="max-h-[24vh] overflow-auto rounded bg-background p-3 text-sm"
          >
            <pre>{{ JSON.stringify(value, null, 2) }}</pre>
          </div>
          <div v-else class="break-all text-sm">
            {{ formatActionResultValue(key, value) }}
          </div>
        </div>
      </div>
      <div
        v-else
        class="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-sm"
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
      class="pointer-events-none fixed z-[9999] rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow"
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
  cursor: grab;
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
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 9999px;
}

.vben-crud-list-tabs-float.is-dragging {
  cursor: grabbing;
}

.vben-crud-list-tabs-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9999px;
}

.vben-crud-list-tabs-toggle:hover {
  color: hsl(var(--primary));
  background: hsl(var(--muted) / 60%);
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
  transition:
    background-color 0.15s ease,
    opacity 0.15s ease;
}

.vben-crud-column-setting-row:hover {
  background: hsl(var(--muted) / 60%);
}

.vben-crud-column-setting-row.is-dragging {
  opacity: 0.45;
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

.vben-crud-column-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  color: hsl(var(--muted-foreground));
  cursor: grab;
}

.vben-crud-column-drag-handle:active {
  cursor: grabbing;
}

.vben-crud-column-pin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: hsl(var(--foreground));
  background: transparent;
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
}

.vben-crud-column-pin:hover,
.vben-crud-column-pin.is-active {
  color: hsl(var(--primary));
}

.vben-crud-column-pin:disabled {
  color: hsl(var(--muted-foreground) / 45%);
  cursor: not-allowed;
}

.vben-crud-column-pin:disabled:hover {
  color: hsl(var(--muted-foreground) / 45%);
}

.vben-crud-export-field-row {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 6px 0;
  border-radius: var(--radius);
}

.vben-crud-export-field-row:hover {
  background: hsl(var(--muted) / 60%);
}

.vben-crud-export-field-row :deep(.ant-checkbox-wrapper) {
  min-width: 0;
  flex: 1;
}

.vben-crud-export-field-row :deep(.ant-checkbox + span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
