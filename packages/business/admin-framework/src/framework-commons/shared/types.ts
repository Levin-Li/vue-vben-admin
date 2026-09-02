import type { SelectOption } from '../api';

import type { CrudExportConverter } from './crud-value-converter';

export type CrudFieldType =
  | 'area-cascader'
  | 'code'
  | 'css'
  | 'cron'
  | 'date'
  | 'datetime'
  | 'file'
  | 'html'
  | 'image'
  | 'json'
  | 'number'
  | 'org-tree-select'
  | 'password'
  | 'qrcode'
  | 'role-select'
  | 'select'
  | 'string-array'
  | 'switch'
  | 'tags'
  | 'tenant'
  | 'time'
  | 'text'
  | 'textarea';

export interface CrudAreaCascaderConfig {
  cityCodeKey?: string;
  cityNameKey?: string;
  districtAdminCodeKey?: string;
  districtCodeKey?: string;
  districtNameKey?: string;
  provinceCodeKey?: string;
  provinceNameKey?: string;
  /** 单字段行政编码的提交和回显字段。 */
  valueKey?: string;
}

export interface CrudComplexGroupConfig {
  /** 页面内分组标识。 */
  key: string;
  /** 提交到后端的嵌套属性名。 */
  submitKey: string;
  /** 扁平字段到嵌套对象属性的映射。 */
  fieldMappings: Record<string, string>;
  title: string;
}

export type CrudDynamicText =
  | string
  | ((formState: Record<string, any>) => string);

export type CrudOptionSource = 'dictionary' | 'enum';
export type CrudOptionLoader = ((keyword?: string) => Promise<SelectOption[]>) & {
  optionSource?: CrudOptionSource;
};

export interface CrudFieldConfig {
  '@JsonSchema'?: Record<string, any> | string;
  '@JsonSchemaInline'?: boolean;
  '@JsonSchemaMode'?: 'inline' | 'popup';
  '@Jsonschema'?: Record<string, any> | string;
  '@JsonschemaInline'?: boolean;
  '@JsonschemaMode'?: 'inline' | 'popup';
  allowInput?: boolean;
  areaCascader?: CrudAreaCascaderConfig;
  cellSingleLine?: boolean;
  cellTooltip?: boolean;
  complexGroupKey?: string;
  defaultValue?: any;
  /** 由页面展示设置注入的轻量区块元数据，不参与提交。 */
  displayGroup?: CrudPageDisplayGroupConfig;
  disabledOnEdit?: boolean | ((context: { userInfo: unknown }) => boolean);
  export?: boolean;
  fixed?: 'left' | 'right' | boolean;
  form?: boolean;
  formCreate?: boolean;
  formEdit?: boolean;
  /** 仅在表单中使用的动态字段标题，不影响列表与导出标题。 */
  formLabel?: CrudDynamicText;
  formVisibleForSuperAdmin?: boolean;
  fullRow?: boolean;
  help?: CrudDynamicText;
  key: string;
  label: string;
  JsonSchema?: Record<string, any> | string;
  JsonSchemaInline?: boolean;
  JsonSchemaMode?: 'inline' | 'popup';
  Jsonschema?: Record<string, any> | string;
  JsonschemaInline?: boolean;
  JsonschemaMode?: 'inline' | 'popup';
  jsonSchema?: Record<string, any> | string;
  jsonSchemaInline?: boolean;
  jsonSchemaMode?: 'inline' | 'popup';
  layoutGroup?: string;
  layoutGroupTitle?: string;
  layoutNewRow?: boolean;
  layoutOrder?: number;
  loadOptions?: CrudOptionLoader;
  maxLength?: number;
  multiple?: boolean | ((formState: Record<string, any>) => boolean);
  maxUploadCount?: number | ((formState: Record<string, any>) => number);
  options?: SelectOption[];
  placeholder?: CrudDynamicText;
  remoteSearch?: boolean;
  required?: boolean;
  search?: boolean;
  searchOrder?: number;
  searchParamName?: string;
  showEmptyImage?: boolean;
  sortable?: boolean;
  span?: number;
  table?: boolean;
  tableMaxWidth?: number;
  tableValue?: (record: Record<string, any>) => any;
  type?: CrudFieldType;
  uploadPath?: string;
  /** 返回校验错误文本时阻止提交；空值是否允许仍由 required 决定。 */
  validator?: (value: any, formState: Record<string, any>) => string | undefined;
  valueType?: 'boolean' | 'number' | 'string';
  visibleForPlatformUser?: boolean;
  width?: number;
}

export interface CrudDisplayDependencyRule {
  fieldKeys: string[];
}

export interface CrudDisplayExclusiveRule {
  fieldKeys: string[];
}

export interface CrudDisplayRule {
  dependsOn?: CrudDisplayDependencyRule;
  exclusiveWith?: CrudDisplayExclusiveRule;
  expression?: string;
}

export interface CrudDisplayDefaultValue {
  applyWhen?: 'initialize' | 'initialize-or-first-visible';
  value?: any;
}

export interface CrudPageDisplayFieldConfig {
  defaultValue?: CrudDisplayDefaultValue;
  hidden?: boolean;
  inputDisplay?: 'default' | 'inline-options';
  key: string;
  label?: string;
  layoutGroup?: string;
  order?: number;
  visibleRoleCodes?: string[];
  visibility?: CrudDisplayRule;
}

/** 表单/详情中的轻量展示区块；用于视觉分隔，不产生额外的数据容器。 */
export interface CrudPageDisplayGroupConfig {
  displayStyle?: 'border' | 'card' | 'default' | 'newline';
  /** 保存配置使用的稳定分组标识。 */
  key: string;
  /** 区块标题；为空时使用分组标识。 */
  title?: string;
  /** 同一视图中区块的展示顺序。 */
  order?: number;
  /** 首次打开表单或详情时是否展开，默认展开。 */
  defaultExpanded?: boolean;
  /** 首次打开时默认展示的字段行数；all 表示展示全部。 */
  defaultExpandedRows?: CrudPageDisplayQueryCollapsedRows;
}

export interface CrudPageDisplayGroupedViewConfig {
  fields: CrudPageDisplayFieldConfig[];
  groups?: CrudPageDisplayGroupConfig[];
  /** 未归入任何分组字段的默认展开行数。 */
  unassignedExpandedRows?: CrudPageDisplayQueryCollapsedRows;
  /** 无归属分组在当前视图全部分组中的展示顺序。 */
  unassignedOrder?: number;
}

export interface CrudPageDisplayFormViewConfig
  extends CrudPageDisplayGroupedViewConfig {
  modalMaxHeight?: string;
  modalMaxWidth?: string;
}

export interface CrudPageDisplayEditViewConfig
  extends CrudPageDisplayFormViewConfig {
  /** 为当前编辑表单提交的已上传字段启用服务端空值强制更新。默认开启。 */
  autoForceUpdateField?: boolean;
}

export interface CrudPageDisplayQueryViewConfig
  extends CrudPageDisplayGroupedViewConfig {
  autoSearch?: boolean;
  collapsedRows?: CrudPageDisplayQueryCollapsedRows;
  defaultExpanded?: boolean;
}

export interface CrudPageDisplayHeaderConfig extends CrudPageDisplayFieldConfig {
  maxWidth?: number;
  minWidth?: number;
  overflowStrategy?: 'ellipsis' | 'wrap';
  title?: string;
  valueDisplay?: { expression?: string; mode: 'default' | 'script' };
  visible?: { expression?: string; mode: 'always' | 'hidden' | 'script' };
  width?: number | 'auto';
}

export type CrudPageDisplayQueryCollapsedRows =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 'all';

export interface CrudPageDisplayConfig {
  create?: CrudPageDisplayFormViewConfig;
  detail?: CrudPageDisplayFormViewConfig;
  edit?: CrudPageDisplayEditViewConfig;
  list?: {
    defaultMaxColumnWidth?: number;
    defaultMinColumnWidth?: number;
    defaultOverflowStrategy?: 'ellipsis' | 'wrap';
    headers: CrudPageDisplayHeaderConfig[];
  };
  query?: CrudPageDisplayQueryViewConfig;
  version: 1;
}

export interface CrudRowAction {
  action?: string;
  actionData?: string;
  badgeCount?: (record: Record<string, any>) => number;
  confirmText?: string;
  confirmTitle?: string;
  danger?: boolean;
  failAction?: string;
  handler: (payload: any) => Promise<any>;
  label: string;
  opRefTargetListName?: string;
  opRefTargetType?: string;
  permission?: string | string[];
  reloadAfterAction?: boolean;
  resultActionData?: string;
  successAction?: string;
  successMessage?: false | string;
  visible?: (record: Record<string, any>) => boolean;
  visibleOn?: string;
}

export type CrudPathConfig =
  | string
  | ((
      values: Record<string, any>,
      editingRecord: null | Record<string, any>,
    ) => string);

export interface CrudApiService {
  batchCreate?: (data?: any, options?: any) => Promise<any>;
  create?: (data?: any, options?: any) => Promise<any>;
  delete?: (params?: any, options?: any) => Promise<any>;
  list?: (params?: any, options?: any) => Promise<any>;
  retrieve?: (params?: any, options?: any) => Promise<any>;
  update?: (data?: any, options?: any) => Promise<any>;
}

export interface CrudExportTemplateField {
  alias?: string;
  converter?: CrudExportConverter;
  key: string;
  label?: string;
  order?: number;
  selected?: boolean;
}

export interface CrudExportTemplateConfig {
  fieldAliases?: Record<string, string>;
  fieldOrderKeys?: string[];
  fields?: CrudExportTemplateField[];
  selectedFieldKeys?: string[];
  version?: number;
}

export interface CrudExportTemplateRecord {
  category?: string;
  code?: string;
  config?: any;
  editable?: boolean;
  fileType?: string;
  groupName?: string;
  id?: number | string;
  name: string;
  orgId?: null | string;
  orgShared?: boolean;
  ownerId?: null | string;
  targetType?: string;
  tenantId?: null | string;
  tenantShared?: boolean;
  type?: string;
}

export interface CrudExportTemplateContext {
  apiBase: string;
  apiModuleBase?: string;
  listPath: string;
  listTableName?: string;
  listTitle: string;
  targetType: string;
  title: string;
}

export interface CrudExportTemplateService {
  create?: (
    data: Record<string, any>,
    context: CrudExportTemplateContext,
  ) => Promise<any>;
  delete?: (
    params: Record<string, any>,
    context: CrudExportTemplateContext,
  ) => Promise<any>;
  list?: (
    params: Record<string, any>,
    context: CrudExportTemplateContext,
  ) => Promise<
    CrudExportTemplateRecord[] | { items?: CrudExportTemplateRecord[] }
  >;
}

export interface CrudListTableConfig {
  allowCreate?: boolean;
  allowDelete?: boolean;
  allowEdit?: boolean;
  allowRetrieve?: boolean;
  key: string;
  label?: string;
  listPath?: string;
  name?: string;
  tableName?: string;
  title?: string;
}

export interface CrudPageConfig {
  apiBase: string;
  apiModuleBase?: string;
  apiService?: CrudApiService;
  allowCreate?: boolean;
  allowDelete?: boolean;
  allowEdit?: boolean;
  allowRetrieve?: boolean;
  createPath?: CrudPathConfig;
  createPermission?: string | string[];
  complexGroups?: CrudComplexGroupConfig[];
  defaultFormValues?: Record<string, any>;
  defaultQuery?: Record<string, any>;
  deletePath?: string;
  deletePermission?: string | string[];
  deleteVisibleOn?: string;
  detailPath?: string;
  detailPermission?: string | string[];
  detailVisibleOn?: string;
  description?: string;
  editPermission?: string | string[];
  editVisibleOn?: string;
  exportTemplateService?: CrudExportTemplateService;
  fields: CrudFieldConfig[];
  formMaxColumns?: number;
  listPath?: string;
  listTables?: CrudListTableConfig[];
  modalWidth?: number | string;
  recordKey?: string;
  permissionDomain?: string;
  permissionResourceName?: string;
  permissionTypePrefix?: string;
  queryPermission?: string | string[];
  rowActions?: CrudRowAction[];
  searchCollapsedCount?: number;
  tableName?: string;
  title: string;
  /** 页面展示设置编码的路由缺失兜底；正常情况下使用当前页面完整路由路径。 */
  uiSettingCode?: string;
  transformSubmit?: (
    values: Record<string, any>,
    editingRecord: null | Record<string, any>,
  ) => Promise<Record<string, any>> | Record<string, any>;
  updatePath?: string;
}
