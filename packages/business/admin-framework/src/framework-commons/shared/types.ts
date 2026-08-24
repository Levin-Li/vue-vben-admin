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
}

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
  defaultValue?: any;
  disabledOnEdit?: boolean | ((context: { userInfo: unknown }) => boolean);
  export?: boolean;
  fixed?: 'left' | 'right' | boolean;
  form?: boolean;
  formCreate?: boolean;
  formEdit?: boolean;
  formVisibleForSuperAdmin?: boolean;
  fullRow?: boolean;
  help?: string;
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
  layoutNewRow?: boolean;
  layoutOrder?: number;
  loadOptions?: (keyword?: string) => Promise<SelectOption[]>;
  maxLength?: number;
  multiple?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  remoteSearch?: boolean;
  required?: boolean;
  search?: boolean;
  searchOrder?: number;
  searchParamName?: string;
  showEmptyImage?: boolean;
  sortable?: boolean;
  span?: number;
  table?: boolean;
  tableValue?: (record: Record<string, any>) => any;
  type?: CrudFieldType;
  uploadPath?: string;
  valueType?: 'boolean' | 'number' | 'string';
  visibleForPlatformUser?: boolean;
  width?: number;
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
  transformSubmit?: (
    values: Record<string, any>,
    editingRecord: null | Record<string, any>,
  ) => Promise<Record<string, any>> | Record<string, any>;
  updatePath?: string;
}
