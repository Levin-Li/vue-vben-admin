import type { SelectOption } from '#/api';

export type CrudFieldType =
  | 'area-cascader'
  | 'code'
  | 'css'
  | 'date'
  | 'datetime'
  | 'file'
  | 'html'
  | 'image'
  | 'json'
  | 'number'
  | 'org-tree-select'
  | 'password'
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
  areaCascader?: CrudAreaCascaderConfig;
  defaultValue?: any;
  disabledOnEdit?: boolean;
  form?: boolean;
  formCreate?: boolean;
  formEdit?: boolean;
  fullRow?: boolean;
  fixed?: 'left' | 'right' | boolean;
  key: string;
  label: string;
  layoutGroup?: string;
  layoutNewRow?: boolean;
  layoutOrder?: number;
  loadOptions?: (keyword?: string) => Promise<SelectOption[]>;
  multiple?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  remoteSearch?: boolean;
  required?: boolean;
  search?: boolean;
  searchParamName?: string;
  span?: number;
  table?: boolean;
  type?: CrudFieldType;
  uploadPath?: string;
  valueType?: 'boolean' | 'number' | 'string';
  visibleForSaasUser?: boolean;
  width?: number;
}

export interface CrudRowAction {
  action?: string;
  actionData?: string;
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

export interface CrudPageConfig {
  apiBase: string;
  apiModuleBase?: string;
  allowCreate?: boolean;
  allowDelete?: boolean;
  allowEdit?: boolean;
  allowRetrieve?: boolean;
  createPath?: string;
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
  fields: CrudFieldConfig[];
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
