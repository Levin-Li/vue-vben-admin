import type {
  CrudFieldConfig,
  CrudPageConfig,
  CrudRowAction,
} from '@levin/admin-framework/framework-commons/shared/types';

import type {
  DataModelDefinition,
  DataModelDefinitionSort,
  DataModelManagementQuery,
  DataModelScopeKind,
} from '../../api/data-model-service';
import type { DataModelBaseDraft } from './model-form';

import { formatDateTime } from '@vben/runtime/utils';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { dataModelService } from '../../api/data-model-service';
import {
  baseDraftOf,
  scopeKindOf,
  scopeOptions,
  toBaseSaveInput,
} from './model-form';
import { loadModelCrudPage } from './model-page-adapter';

const sortable = new Set([
  'createdAt',
  'enabled',
  'key',
  'name',
  'syncedVersion',
  'title',
  'version',
]);
export function definitionManagementQuery(
  input: Record<string, unknown>,
): DataModelManagementQuery {
  const query: DataModelManagementQuery = {};
  for (const key of [
    'key',
    'name',
    'title',
    'createdFrom',
    'createdTo',
  ] as const) {
    if (typeof input[key] === 'string' && input[key] !== '')
      query[key] =
        key === 'createdFrom' || key === 'createdTo'
          ? new Date(input[key]).toISOString()
          : input[key];
  }
  if (typeof input.enabled === 'boolean') query.enabled = input.enabled;
  if (typeof input.orderBy === 'string' && sortable.has(input.orderBy)) {
    query.sortBy = input.orderBy as DataModelDefinitionSort;
    query.sortDirection =
      String(input.orderDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
  return query;
}
export function definitionCrudConfig(options: {
  context: () => string;
  ownerAllowed: boolean;
  ownerLoader: NonNullable<CrudPageConfig['fields'][number]['loadOptions']>;
  rowActions: CrudRowAction[];
  scopes: Array<{ label: string; value: DataModelScopeKind }>;
}): CrudPageConfig {
  let editing: DataModelDefinition | undefined;
  const save = (input: Record<string, unknown>) => {
    const draft = {
      ...baseDraftOf(editing),
      ...input,
      ...(editing
        ? {
            key: editing.key,
            version: editing.version,
            scopeKind: scopeKindOf(editing),
          }
        : {}),
    } as DataModelBaseDraft;
    return dataModelService.save(toBaseSaveInput(draft, options.ownerAllowed));
  };
  const api = `${OAK_BASE_API_MODULE}/DataModel`;
  return {
    apiBase: '/DataModel',
    apiModuleBase: OAK_BASE_API_MODULE,
    queryPermission: buildApiMethodPermissions(dataModelService, 'queryModels'),
    createPermission: buildApiMethodPermissions(dataModelService, 'save'),
    editPermission: buildApiMethodPermissions(dataModelService, 'save'),
    title: '领域模型定义',
    recordKey: 'key',
    allowDelete: false,
    allowRetrieve: true,
    detailPermission: buildApiMethodPermissions(
      dataModelService,
      'getDefinition',
    ),
    dataAttrTargets: {
      list: { method: 'GET', path: `${api}/queryModels` },
      create: { method: 'POST', path: `${api}/save` },
      update: { method: 'POST', path: `${api}/save` },
      retrieve: { method: 'GET', path: `${api}/get` },
    },
    dataAttrConditionKeys: ['version'],
    createSubmitKeys: ['scopeKind', 'tenantShared', 'orgShared'],
    prepareCreate: async () => {
      editing = undefined;
      return baseDraftOf();
    },
    loadEditRecord: async (row) => {
      editing = await dataModelService.getDefinition(String(row.key));
      return { ...editing, ...baseDraftOf(editing) };
    },
    apiService: {
      list: (input: Record<string, unknown> = {}) => {
        const query = definitionManagementQuery(input);
        return loadModelCrudPage(
          Number(input.pageIndex || 1),
          Number(input.pageSize || 20),
          (page, size) =>
            dataModelService.queryModels({ ...query, page, size }),
          options.context,
        );
      },
      retrieve: (input: Record<string, unknown>) =>
        dataModelService.getDefinition(String(input.key)),
      create: save,
      update: save,
    },
    fields: (
      [
        {
          key: 'key',
          label: '模型标识',
          required: true,
          type: 'text',
          search: true,
          sortable: true,
          disabledOnEdit: true,
          width: 210,
          validator: (value) =>
            /^[a-z][a-z0-9_]{0,47}$/.test(String(value || ''))
              ? undefined
              : '须为1～48位小写字母、数字或下划线，以字母开头',
        },
        {
          key: 'name',
          label: '名称',
          required: true,
          type: 'text',
          search: true,
          sortable: true,
          width: 180,
        },
        {
          key: 'title',
          label: '中文标题',
          required: true,
          type: 'text',
          search: true,
          sortable: true,
          width: 180,
        },
        { key: 'description', label: '说明', type: 'textarea', table: false },
        {
          key: 'scopeKind',
          label: '归属范围',
          type: 'select',
          options: options.scopes,
          required: true,
          disabledOnEdit: true,
          width: 180,
          tableValue: (row) =>
            scopeOptions.find(
              (item) => item.value === scopeKindOf(row as DataModelDefinition),
            )?.label || '—',
        },
        {
          key: 'tenantShared',
          label: '跨租户共享定义',
          type: 'switch',
          table: false,
        },
        {
          key: 'orgShared',
          label: '跨组织共享定义',
          type: 'switch',
          table: false,
        },
        {
          key: 'ownerId',
          label: '私人模型所有者',
          type: 'select',
          form: options.ownerAllowed,
          table: false,
          loadOptions: options.ownerLoader,
          remoteSearch: true,
        },
        {
          key: 'enabled',
          label: '启用状态',
          type: 'select',
          valueType: 'boolean',
          options: [
            { label: '启用', value: true },
            { label: '禁用', value: false },
          ],
          readOnly: true,
          form: false,
          search: true,
          sortable: true,
          width: 110,
        },
        {
          key: 'createdAt',
          label: '创建时间',
          tableValue: (row: Record<string, unknown>) =>
            row.createdAt ? formatDateTime(String(row.createdAt)) : '—',
          type: 'datetime',
          form: false,
          readOnly: true,
          sortable: true,
          width: 190,
        },
        {
          key: 'createdFrom',
          label: '创建时间起',
          type: 'datetime',
          search: true,
          form: false,
          table: false,
          detail: false,
        },
        {
          key: 'createdTo',
          label: '创建时间止',
          type: 'datetime',
          search: true,
          form: false,
          table: false,
          detail: false,
        },
        {
          key: 'version',
          label: '定义版本',
          type: 'text',
          form: false,
          readOnly: true,
          sortable: true,
          width: 110,
        },
        {
          key: 'syncedVersion',
          label: '同步版本',
          type: 'text',
          form: false,
          readOnly: true,
          sortable: true,
          width: 110,
        },
        {
          key: 'syncState',
          label: '同步状态',
          type: 'text',
          form: false,
          readOnly: true,
          width: 160,
          tableValue: (row) => {
            if (row.requiresNamingMigration) return '需升级字段命名';
            return row.syncedVersion > 0 && row.syncedVersion === row.version
              ? '已同步'
              : '待同步';
          },
        },
      ] satisfies CrudFieldConfig[]
    ).map((field) => ({
      table: true,
      form: true,
      cellSingleLine: true,
      cellTooltip: true,
      ...field,
    })),
    rowActions: options.rowActions,
    initialQuery: {},
    defaultQuery: { pageSize: 20 },
  };
}
