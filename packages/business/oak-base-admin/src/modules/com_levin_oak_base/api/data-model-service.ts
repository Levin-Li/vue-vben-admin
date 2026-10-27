import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { invalidateDataModelMetadata } from '../views/domain-data-dynamic-model/model-metadata';
import { OAK_BASE_API_MODULE } from './_module';

export type DataModelFieldType =
  | 'BIG_INTEGER'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'DECIMAL'
  | 'INTEGER'
  | 'JSON'
  | 'MONEY'
  | 'STRING'
  | 'TEXT'
  | 'TIME'
  | 'UUID';

export interface DataModelField {
  createEnabled?: boolean;
  defaultValue?: boolean | number | string;
  description?: string;
  detailEnabled?: boolean;
  editEnabled?: boolean;
  formEnabled?: boolean;
  key: string;
  length?: number;
  listEnabled?: boolean;
  name: string;
  nullable: boolean;
  optionRef?: string;
  options?: Array<{ label: string; value: boolean | number | string }>;
  optionSource?: 'DICT' | 'ENUM' | 'FIXED';
  permissionGroupKey?: null | string;
  precision?: number;
  queryEnabled?: boolean;
  queryOperators?: DataModelQueryOperator[];
  scale?: number;
  title: string;
  type: DataModelFieldType;
}

export type DataModelQueryOperator =
  | 'CONTAINS'
  | 'EQ'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE';

export interface DataModelFilter {
  field: string;
  operator: DataModelQueryOperator;
  value: boolean | number | string;
}

export type DataModelConditionDefinition =
  | { child: DataModelConditionDefinition; type: 'NOT' }
  | { children: DataModelConditionDefinition[]; type: 'AND' | 'OR' }
  | { key: string; type: 'PARAM' };

export interface DataModelDefinition {
  createdAt?: string;
  creator?: string;
  description?: string;
  domainId?: string;
  editable?: boolean;
  enabled?: boolean;
  fields: DataModelField[];
  key: string;
  lastSyncActor?: string;
  lastSyncAt?: string;
  lastSyncError?: string;
  lastSyncResult?: string;
  name: string;
  namingVersion?: number;
  operationDefinitions?: DataModelOperationDefinition[];
  operationFields?: Partial<
    Record<
      'CREATE' | 'DELETE_CONFIRM' | 'DETAIL' | 'EDIT' | 'LIST' | 'QUERY',
      string[]
    >
  >;
  operations?: DataModelOperation[];
  orderCode?: number;
  orgId?: string;
  orgShared?: boolean;
  ownerId?: string;
  permissionGroups?: DataModelPermissionGroup[];
  queryInputs?: DataModelQueryInput[];
  remark?: string;
  requiresNamingMigration?: boolean;
  scopeKind?: DataModelScopeKind;
  syncedVersion?: number;
  synchronized?: boolean;
  systemFields?: DataModelSystemField[];
  tenantId?: string;
  tenantShared?: boolean;
  title: string;
  updatedAt?: string;
  version?: number;
}

export interface DataModelPermissionGroup {
  confidentialLevel: number;
  description?: string;
  key: string;
  title: string;
}

export type DataModelOperationCode =
  | 'CREATE'
  | 'DELETE'
  | 'DETAIL'
  | 'EDIT'
  | 'QUERY'
  | 'SET_ENABLED'
  | `CUSTOM_${string}`;

export interface DataModelOperationParameter {
  controlledFilter?: boolean;
  defaultValue?: unknown;
  defaultVisible?: boolean;
  description?: string;
  name: string;
  nullable?: boolean;
  operators?: string[];
  options?: Array<{ label: string; value: boolean | number | string }>;
  readOnly?: boolean;
  referenceType?: 'DOMAIN' | 'ORG' | 'TENANT' | 'USER';
  serverManaged?: boolean;
  source?: string;
  title: string;
  type: string;
  wirePath?: string;
}

export interface DataModelOperation {
  actionType?: DataModelActionType;
  authorized: boolean;
  available: boolean;
  classification?: DataModelOperationClassification;
  code: DataModelOperationCode;
  confirmText?: string;
  enabled?: boolean;
  executionType?: 'CREATE_RECORD' | 'STANDARD' | 'UPDATE_FIELDS';
  httpMethod?: string;
  method: string;
  path: string;
  permissionExpr: string;
  requestDefinition?: Record<string, unknown>;
  requestParams: DataModelOperationParameter[];
  requestPath?: string;
  responseDefinition?: Record<string, unknown>;
  responseParams: DataModelOperationParameter[];
  standardAction?: DataModelOperationCode;
  target?: 'OBJECT' | 'RECORD';
  title: string;
}

export interface DataModelQueryInput {
  defaultVisible: boolean;
  description?: string;
  field: string;
  key: string;
  operator: DataModelQueryOperator;
  options?: Array<{ label: string; value: boolean | number | string }>;
  referenceType?: string;
  source?: string;
  title: string;
  type: string;
}

export interface DataModelOperationDefinition {
  actionType?: DataModelActionType;
  assignments?: Record<string, unknown>;
  classification?: DataModelOperationClassification;
  code: DataModelOperationCode;
  conditionTree?: DataModelConditionDefinition;
  confirmText?: string;
  enabled: boolean;
  executionType: 'CREATE_RECORD' | 'STANDARD' | 'UPDATE_FIELDS';
  httpMethod?: string;
  queryInputOptions?: DataModelQueryInput[];
  queryInputs?: DataModelQueryInput[];
  requestDefinition?: Record<string, unknown>;
  requestFieldOptions?: DataModelOperationParameter[];
  requestFields: string[];
  requestPath?: string;
  responseDefinition?: Record<string, unknown>;
  responseFieldOptions?: DataModelOperationParameter[];
  responseFields: string[];
  standardAction?: DataModelOperationCode | null;
  target: 'OBJECT' | 'RECORD';
  title: string;
}

export type DataModelActionType =
  | 'CREATE'
  | 'DELETE'
  | 'DETAIL'
  // 兼容旧目录中的动作类型；保存扩展接口时统一转换为新值。
  | 'EXECUTE'
  | 'EXTENSION_CREATE'
  | 'EXTENSION_UPDATE'
  | 'QUERY'
  | 'SET_ENABLED'
  | 'UPDATE';

export type DataModelOperationClassification = 'EXTENSION' | 'STANDARD';

export type DataModelRecordScope = Partial<
  Record<'domainId' | 'orgId' | 'ownerId' | 'tenantId', null | string>
>;
export interface DataModelScopeOption {
  id: string;
  name: string;
  orgId?: string;
  parentId?: string;
  tenantId?: string;
}
export interface DataModelFormContext {
  fields: DataModelOperationParameter[];
  options: Partial<Record<keyof DataModelRecordScope, DataModelScopeOption[]>>;
  scope: DataModelRecordScope;
}

export interface DataModelSystemField {
  description?: string;
  key: string;
  name: string;
  nullable: boolean;
  source: 'MODEL_ATTRIBUTE' | 'RECORD_SYSTEM';
  title: string;
  type: string;
}

export type DataModelScopeKind = 'ORG' | 'PLATFORM' | 'PRIVATE' | 'TENANT';

export interface SaveDataModelInput {
  description?: string;
  key: string;
  name: string;
  orgShared?: boolean;
  ownerId?: string;
  scopeKind: DataModelScopeKind;
  tenantShared?: boolean;
  title: string;
  version?: number;
}

export interface SaveDataModelFieldsInput {
  expectedVersion: number;
  fields: DataModelField[];
  key: string;
  permissionGroups?: DataModelPermissionGroup[];
}

export interface DataModelNamingPreview {
  definitionVersion: number;
  fingerprint: string;
  key: string;
  namingVersion: number;
  risks: string[];
  sql: string[];
  targetNamingVersion: number;
}

export interface DataModelPreview {
  definitionVersion: number;
  fingerprint: string;
  key: string;
  risks: string[];
  sql: string[];
}

export interface DataModelPage<T> {
  items: T[];
  total: number;
}

export type DataModelDefinitionSort =
  | 'createdAt'
  | 'enabled'
  | 'key'
  | 'name'
  | 'syncedVersion'
  | 'title'
  | 'version';
export interface DataModelManagementQuery {
  createdFrom?: string;
  createdTo?: string;
  enabled?: boolean;
  key?: string;
  name?: string;
  page?: number;
  size?: number;
  sortBy?: DataModelDefinitionSort;
  sortDirection?: 'ASC' | 'DESC';
  title?: string;
}
export interface DataModelManagementPage extends DataModelPage<DataModelDefinition> {
  page: number;
  size: number;
}

export interface GeneratedDataModelMenu {
  id: string;
  params: { modelKey: string };
  path: string;
  sourceFilePath: string;
  viewPath: string;
}

export type DataModelRecord = Record<string, unknown> & { id: string };

// 对应 com.levin.oak.base.controller.BizDataModelController；所有写操作仍由后端校验管理员及行级范围。
@Service({
  basePath: '/DataModel',
  controllerClass: 'com.levin.oak.base.controller.BizDataModelController',
  title: '数据模型',
  type: '系统数据-数据模型',
})
export class DataModelService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async catalog(): Promise<DataModelDefinition[]> {
    return this.get<DataModelDefinition[]>('catalog');
  }

  @CRUD.Op({ label: '新增记录', opRefTargetType: 'None' })
  @ResAuthorize({ onlyRequireAuthenticated: true })
  async createRecord(
    key: string,
    data: Record<string, unknown>,
    requestKey: string,
    scope?: DataModelRecordScope,
  ): Promise<DataModelRecord> {
    invalidateDataModelMetadata();
    return this.post<DataModelRecord>('createRecord', {
      data: { key, requestKey, values: data, ...(scope ? { scope } : {}) },
    }).finally(invalidateDataModelMetadata);
  }

  @CRUD.Op({
    label: '删除定义',
    opRefTargetType: 'SingleRow',
    confirmText: '仅当数据表尚未创建或表内没有记录时才能删除，确定继续吗？',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '删除定义',
  })
  async deleteModel(key: string, expectedVersion: number): Promise<void> {
    await this.deleteRequest<unknown>('deleteModel', {
      data: { key, expectedVersion },
    }).finally(invalidateDataModelMetadata);
  }

  @CRUD.Op({
    label: '永久删除记录',
    opRefTargetType: 'SingleRow',
    confirmText: '此操作将永久删除记录且不可恢复，确定继续吗？',
  })
  @ResAuthorize({ onlyRequireAuthenticated: true })
  async deleteRecord(
    key: string,
    id: string,
    expectedVersion: number,
  ): Promise<void> {
    invalidateDataModelMetadata();
    await this.deleteRequest<unknown>('deleteRecord', {
      data: { key, id, expectedVersion },
    }).finally(invalidateDataModelMetadata);
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async editRecord(key: string, id: string): Promise<DataModelRecord> {
    return this.get<DataModelRecord>('editRecord', { params: { key, id } });
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async executeOperation(
    key: string,
    operationCode: DataModelOperationCode,
    id?: string,
    expectedVersion?: number,
    values?: Record<string, unknown>,
    scope?: DataModelRecordScope,
    requestKey?: string,
  ): Promise<DataModelRecord> {
    invalidateDataModelMetadata();
    return this.post<DataModelRecord>('executeOperation', {
      data: {
        key,
        operationCode,
        ...(id === undefined ? {} : { id }),
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
        ...(values === undefined ? {} : { values }),
        ...(scope === undefined ? {} : { scope }),
        ...(requestKey === undefined ? {} : { requestKey }),
      },
    }).finally(invalidateDataModelMetadata);
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async formContext(
    key: string,
    operationCode: DataModelOperationCode,
    id?: string,
    scope?: DataModelRecordScope,
  ): Promise<DataModelFormContext> {
    return this.post('formContext', {
      data: { key, operationCode, id, scope },
    });
  }

  @CRUD.Op({ label: '添加到菜单', opRefTargetType: 'SingleRow' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '生成菜单',
  })
  async generateMenu(key: string): Promise<GeneratedDataModelMenu> {
    return this.post('generateMenu', { data: { key } });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '查询',
  })
  async getDefinition(key: string): Promise<DataModelDefinition> {
    return this.get<DataModelDefinition>('get', { params: { key } });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '查询',
  })
  async list(): Promise<DataModelDefinition[]> {
    return this.get<DataModelDefinition[]>('list');
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '同步结构',
  })
  async migrateNaming(
    key: string,
    expectedVersion: number,
    fingerprint: string,
  ): Promise<Record<string, unknown>> {
    invalidateDataModelMetadata();
    return this.post<Record<string, unknown>>('migrateNaming', {
      data: { key, expectedVersion, fingerprint },
    }).finally(invalidateDataModelMetadata);
  }

  @CRUD.Op({ label: '预览结构', opRefTargetType: 'SingleRow' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '预览结构',
  })
  async preview(key: string): Promise<DataModelPreview> {
    return this.get<DataModelPreview>('preview', { params: { key } });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '同步结构',
  })
  async previewNamingMigration(key: string): Promise<DataModelNamingPreview> {
    return this.get('previewNamingMigration', { params: { key } });
  }

  @CRUD.ListTable({})
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '查询',
  })
  async queryModels(
    params: DataModelManagementQuery,
  ): Promise<DataModelManagementPage> {
    return this.get<DataModelManagementPage>('queryModels', { params });
  }

  @CRUD.ListTable({})
  @ResAuthorize({ onlyRequireAuthenticated: true })
  async queryRecords(
    key: string,
    params: {
      pageIndex?: number;
      pageSize?: number;
      queryValues?: Record<string, boolean | number | string>;
      sortBy?: string;
      sortDirection?: 'ASC' | 'DESC';
    },
  ): Promise<DataModelPage<DataModelRecord>> {
    return this.post('queryRecords', {
      data: {
        key,
        page: Math.max(0, Number(params.pageIndex || 1) - 1),
        size: Number(params.pageSize || 20),
        queryValues: params.queryValues || {},
        ...(params.sortBy
          ? { sortBy: params.sortBy, sortDirection: params.sortDirection }
          : {}),
      },
    });
  }

  @ResAuthorize({ onlyRequireAuthenticated: true })
  async record(key: string, id: string): Promise<DataModelRecord> {
    return this.get<DataModelRecord>('record', { params: { key, id } });
  }

  @CRUD.ListTable({})
  @ResAuthorize({ onlyRequireAuthenticated: true })
  async records(
    key: string,
    params: { pageIndex?: number; pageSize?: number },
  ): Promise<DataModelPage<DataModelRecord>> {
    const page = Math.max(0, Number(params.pageIndex || 1) - 1);
    const size = Number(params.pageSize || 20);
    return this.get<DataModelPage<DataModelRecord>>('records', {
      params: { key, page, size },
    });
  }

  @CRUD.Op({ label: '保存模型', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '维护',
  })
  async save(data: SaveDataModelInput): Promise<DataModelDefinition> {
    invalidateDataModelMetadata();
    return this.post<DataModelDefinition>('save', { data }).finally(
      invalidateDataModelMetadata,
    );
  }

  @CRUD.Op({ label: '字段管理', opRefTargetType: 'SingleRow' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '维护字段',
  })
  async saveFields(
    data: SaveDataModelFieldsInput,
  ): Promise<DataModelDefinition> {
    invalidateDataModelMetadata();
    return this.post<DataModelDefinition>('saveFields', { data }).finally(
      invalidateDataModelMetadata,
    );
  }
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '维护字段',
  })
  async saveOperations(
    key: string,
    expectedVersion: number,
    operations: DataModelOperationDefinition[],
  ): Promise<DataModelDefinition> {
    invalidateDataModelMetadata();
    return this.post<DataModelDefinition>('saveOperations', {
      data: { key, expectedVersion, operations },
    }).finally(invalidateDataModelMetadata);
  }

  @CRUD.Op({ label: '启停记录', opRefTargetType: 'SingleRow' })
  @ResAuthorize({ onlyRequireAuthenticated: true })
  async setEnabled(
    key: string,
    id: string,
    enable: boolean,
    expectedVersion: number,
  ): Promise<DataModelRecord> {
    invalidateDataModelMetadata();
    return this.put<DataModelRecord>('setEnabled', {
      data: { key, id, enable, expectedVersion },
    }).finally(invalidateDataModelMetadata);
  }

  @CRUD.Op({ label: '启停模型', opRefTargetType: 'SingleRow' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '启停模型',
  })
  async setModelEnabled(
    key: string,
    enabled: boolean,
  ): Promise<DataModelDefinition> {
    invalidateDataModelMetadata();
    return this.put<DataModelDefinition>('setModelEnabled', {
      data: { key, enabled },
    }).finally(invalidateDataModelMetadata);
  }

  @CRUD.Op({ label: '同步结构', opRefTargetType: 'SingleRow' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-数据模型',
    action: '同步结构',
  })
  async sync(
    key: string,
    expectedVersion: number,
    fingerprint: string,
  ): Promise<Record<string, unknown>> {
    invalidateDataModelMetadata();
    return this.post<Record<string, unknown>>('sync', {
      data: { key, expectedVersion, fingerprint },
    }).finally(invalidateDataModelMetadata);
  }

  @CRUD.Op({ label: '编辑记录', opRefTargetType: 'SingleRow' })
  @ResAuthorize({ onlyRequireAuthenticated: true })
  async updateRecord(
    key: string,
    id: string,
    data: Record<string, unknown>,
    expectedVersion: number,
    scope?: DataModelRecordScope,
  ): Promise<DataModelRecord> {
    invalidateDataModelMetadata();
    return this.put<DataModelRecord>('updateRecord', {
      data: {
        key,
        id,
        values: data,
        expectedVersion,
        ...(scope ? { scope } : {}),
      },
    }).finally(invalidateDataModelMetadata);
  }
}

export const dataModelService = new DataModelService();
