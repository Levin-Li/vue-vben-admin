import type { DataAttrPolicy } from '@levin/admin-framework/framework-commons/data-attr-policy';
import type { CrudDataAttrOperation } from '@levin/admin-framework/framework-commons/shared/crud-data-attr-access';
import type {
  CrudFieldConfig,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import type {
  DataModelDefinition,
  DataModelFormContext,
  DataModelOperationCode,
  DataModelOperationParameter,
  DataModelRecord,
  DataModelRecordScope,
} from '../../api/data-model-service';

import { reactive } from 'vue';

import { dataModelService } from '../../api/data-model-service';
import { modelMetadataCache } from '../data-model/model-metadata';
import { loadModelCrudPage } from '../data-model/model-page-adapter';
import { isModelActionAllowed, modelDisplayCode } from './dynamic-page-display';
import { recordFailure } from './record-errors';
import {
  operationFormFields,
  recordDefaultValues,
  recordDisplayValue,
  recordExpectedVersion,
  recordScopeValues,
  toCrudField,
} from './record-fields';
import { buildRecordQueryValues } from './record-query';
import { scopeFieldDescription } from './scope-field-description';

const operationCodes: Record<CrudDataAttrOperation, DataModelOperationCode> = {
  batchCreate: 'CREATE',
  create: 'CREATE',
  delete: 'DELETE',
  list: 'QUERY',
  retrieve: 'DETAIL',
  update: 'EDIT',
};
const responseViews = {
  list: 'LIST',
  retrieve: 'DETAIL',
  create: 'CREATE',
  update: 'EDIT',
  delete: 'DELETE_CONFIRM',
  batchCreate: 'CREATE',
} as const;
const sortableTypes = new Set([
  'BIG_INTEGER',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'DECIMAL',
  'INTEGER',
  'MONEY',
  'STRING',
  'TIME',
  'UUID',
]);
const identityFields = ['id', 'optimisticLock'];

function recordRequest<T>(request: Promise<T>, fallback: string): Promise<T> {
  return request.catch((error: unknown) => {
    throw new Error(recordFailure(error, fallback));
  });
}

function queryType(type: string, hasOptions: boolean): CrudFieldConfig['type'] {
  if (hasOptions || type === 'BOOLEAN') return 'select';
  const types: Record<string, CrudFieldConfig['type']> = {
    DATETIME: 'datetime',
    DATE: 'date',
    TIME: 'time',
  };
  return types[type] || 'text';
}
function fieldWidth(
  type: string | undefined,
  control: string | undefined,
): number {
  if (type === 'MONEY') return 300;
  if (control === 'datetime') return 220;
  return 180;
}

// 公共渲染器消费扁平属性；HTTP回调才组装受控values/scope，不生成列名或自由查询操作符。
export function createDynamicCrudAdapter(
  model: DataModelDefinition,
  context: () => string,
) {
  if (model.requiresNamingMigration || model.namingVersion === 1)
    throw new Error('模型需要先升级字段命名，升级并同步后才能打开页面');
  const form = reactive<{
    context?: DataModelFormContext;
    operation: DataModelOperationCode;
    original?: DataModelRecord;
  }>({ operation: 'CREATE' });
  const queryContext = reactive<{ value?: DataModelFormContext }>({});
  let pendingCreate: DataModelOperationCode = 'CREATE';
  let requestKey = '';
  let formGeneration = 0;
  const allowed = (code: DataModelOperationCode) =>
    isModelActionAllowed(model, code);
  const operation = (code: DataModelOperationCode) =>
    model.operations?.find((item) => item.code === code);
  const parameters = (code: DataModelOperationCode) =>
    operation(code)?.requestParams || [];
  const writable = (record: Record<string, unknown>) =>
    record.editable !== false;
  function assertOperation(
    code: DataModelOperationCode,
    record?: Record<string, unknown>,
  ) {
    if (!allowed(code)) throw new Error('当前操作不可用或未授权');
    if (record && !writable(record))
      throw new Error('记录不可编辑，请重新读取');
  }
  const parameterFields = (code: DataModelOperationCode) =>
    operationFormFields(parameters(code), model.fields);
  const initialCreate = parameterFields('CREATE');
  const initialEdit = parameterFields('EDIT');
  const listNames = new Set(model.operationFields?.LIST || []);
  const detailNames = new Set(model.operationFields?.DETAIL || []);
  const allNames = new Set([
    ...(model.systemFields || [])
      .filter((field) => field.source === 'RECORD_SYSTEM')
      .map((field) => field.name),
    ...model.fields.map((field) => field.name),
  ]);
  function fieldFromParameter(
    parameter: DataModelOperationParameter,
  ): CrudFieldConfig {
    return {
      key: parameter.name,
      label: parameter.title,
      help: scopeFieldDescription(parameter),
      type: 'select',
      options: parameter.options,
      required: parameter.nullable === false,
      readOnly: Boolean(parameter.readOnly || parameter.serverManaged),
      search: false,
      form: true,
    };
  }
  const fields: CrudFieldConfig[] = [...allNames].map((name) => {
    const business = model.fields.find((field) => field.name === name);
    const system = model.systemFields?.find(
      (field) => field.source === 'RECORD_SYSTEM' && field.name === name,
    );
    const create = initialCreate.find((field) => field.name === name);
    const edit = initialEdit.find((field) => field.name === name);
    const scope = [create, edit].find((field) => field?.source === 'SCOPE');
    const base: CrudFieldConfig = business
      ? toCrudField(business)
      : {
          key: name,
          label: system?.title || name,
          type: system?.type === 'DATETIME' ? 'datetime' : 'text',
        };
    return {
      ...base,
      ...(scope ? fieldFromParameter(scope) : {}),
      valueType:
        business && ['BIG_INTEGER', 'DECIMAL', 'MONEY'].includes(business.type)
          ? 'string'
          : undefined,
      ...(name === 'enable'
        ? {
            type: 'select' as const,
            valueType: 'boolean' as const,
            options: [
              { label: '启用', value: true },
              { label: '禁用', value: false },
            ],
          }
        : {}),
      form: Boolean(create || edit),
      formCreate: Boolean(create),
      formEdit: Boolean(edit),
      readOnly: scope ? Boolean(scope.readOnly) : !business,
      table: listNames.has(name),
      detail: detailNames.has(name),
      search: false,
      sortable:
        listNames.has(name) &&
        sortableTypes.has(business?.type || system?.type || ''),
      defaultHidden: {
        list: !business && !['createTime', 'enable'].includes(name),
        ...(scope?.referenceType === 'TENANT' ||
        scope?.referenceType === 'DOMAIN'
          ? { create: true, edit: true }
          : {}),
      },
      ...(scope ? { defaultVisibleRoleCodes: [] } : {}),
      layoutGroup: business?.permissionGroupKey || undefined,
      layoutGroupTitle: model.permissionGroups?.find(
        (group) => group.key === business?.permissionGroupKey,
      )?.title,
      cellSingleLine: true,
      cellTooltip: true,
      width: fieldWidth(business?.type, base.type),
      tableValue:
        business?.options?.length || business?.type === 'JSON'
          ? (record) => recordDisplayValue(business, record[name])
          : undefined,
    };
  });
  for (const input of model.queryInputs || []) {
    const business = model.fields.find((field) => field.name === input.field);
    const base = business
      ? toCrudField({
          ...business,
          name: input.key,
          title: input.title,
          options: input.options,
        })
      : {
          key: input.key,
          label: input.title,
          type: queryType(input.type, Boolean(input.options?.length)),
        };
    fields.push({
      ...base,
      key: input.key,
      label: input.title,
      required: false,
      search: true,
      defaultHidden: { query: input.defaultVisible === false },
      searchParamName: input.key,
      form: false,
      table: false,
      detail: false,
      options:
        input.options ||
        (input.type === 'BOOLEAN'
          ? [
              { label: '启用', value: true },
              { label: '禁用', value: false },
            ]
          : undefined),
    });
  }

  function activeFormFields() {
    return operationFormFields(
      form.context?.fields || parameters(form.operation),
      model.fields,
      form.context?.scope,
    );
  }
  async function loadContext(
    code: DataModelOperationCode,
    id?: string,
    scope?: DataModelRecordScope,
    fresh = false,
  ) {
    const cacheKey = `standard-form:${model.key}:${code}:${id || ''}:${form.original?.optimisticLock ?? ''}:${JSON.stringify(scope || {})}`;
    return modelMetadataCache.read(
      context(),
      cacheKey,
      () => dataModelService.formContext(model.key, code, id, scope),
      fresh,
    );
  }
  function syncFormFields() {
    const active = activeFormFields();
    for (const field of config.fields) {
      if ((model.queryInputs || []).some((input) => input.key === field.key))
        continue;
      const parameter = active.find((item) => item.name === field.key);
      field.form = Boolean(parameter);
      if (form.operation === 'EDIT') field.formEdit = Boolean(parameter);
      else field.formCreate = Boolean(parameter);
      if (parameter) {
        field.required = !parameter.nullable;
        field.readOnly = Boolean(parameter.readOnly);
        field.formLabel = parameter.title;
        if (parameter.options) field.options = parameter.options;
        if (parameter.source === 'SCOPE') {
          field.defaultVisibleRoleCodes = [];
          field.help = scopeFieldDescription(parameter);
          if (
            parameter.referenceType === 'TENANT' ||
            parameter.referenceType === 'DOMAIN'
          )
            field.defaultHidden = {
              ...field.defaultHidden,
              create: true,
              edit: true,
            };
        }
      }
    }
    config.createSubmitKeys = active
      .filter((field) => !field.readOnly)
      .map((field) => field.name);
  }
  async function prepareCreate() {
    const request = ++formGeneration;
    const code = pendingCreate;
    pendingCreate = 'CREATE';
    assertOperation(code);
    const received = await loadContext(code);
    if (request !== formGeneration) throw new Error('表单已切换，请重新打开');
    form.operation = code;
    form.original = undefined;
    requestKey = crypto.randomUUID();
    form.context = received;
    syncFormFields();
    const defaults = {
      ...recordDefaultValues(activeFormFields()),
      ...received.scope,
    };
    config.defaultFormValues = {
      ...recordDefaultValues(
        activeFormFields().filter(
          (field) => !field.readOnly && field.source === 'BUSINESS',
        ),
      ),
      ...recordScopeValues(activeFormFields(), received.scope),
    };
    return defaults;
  }
  async function loadEditRecord(row: Record<string, unknown>) {
    const request = ++formGeneration;
    assertOperation('EDIT', row);
    const latest = await dataModelService.editRecord(model.key, String(row.id));
    recordExpectedVersion(latest);
    if (request !== formGeneration) throw new Error('表单已切换，请重新打开');
    form.original = latest;
    const received = await loadContext('EDIT', latest.id);
    if (request !== formGeneration) throw new Error('表单已切换，请重新打开');
    form.operation = 'EDIT';
    form.context = received;
    syncFormFields();
    return { ...latest, ...received.scope };
  }
  async function changeScope(
    name: string,
    value: string | undefined,
    state: Record<string, unknown>,
  ) {
    const active = activeFormFields();
    const current = active.find((field) => field.name === name);
    if (
      !current ||
      current.readOnly ||
      current.serverManaged ||
      current.source !== 'SCOPE'
    )
      return;
    const next = { ...form.context?.scope, [name]: value ?? null };
    if (name === 'tenantId') {
      next.orgId = null;
      next.ownerId = null;
    } else if (name === 'orgId') next.ownerId = null;
    const request = ++formGeneration;
    const received = await loadContext(
      form.operation,
      form.original?.id,
      recordScopeValues(active, next),
      true,
    );
    if (request !== formGeneration) return;
    form.context = received;
    Object.assign(state, form.context.scope);
    syncFormFields();
    config.defaultFormValues = {
      ...config.defaultFormValues,
      ...recordScopeValues(activeFormFields(), form.context.scope),
    };
  }
  function payload(input: Record<string, unknown>) {
    const active = activeFormFields();
    const values: Record<string, unknown> = {};
    for (const field of active) {
      if (
        field.source !== 'BUSINESS' ||
        field.readOnly ||
        !Object.hasOwn(input, field.name)
      )
        continue;
      let value = input[field.name];
      const original = form.original?.[field.name];
      // 公共日期控件只负责交互；未变的秒级投影恢复原始微秒值。
      if (
        original &&
        value &&
        (field.type === 'DATETIME' || field.type === 'TIME')
      ) {
        const normalize = (item: unknown) =>
          field.type === 'DATETIME'
            ? new Date(String(item)).toISOString().slice(0, 19)
            : String(item).slice(0, 8);
        if (normalize(value) === normalize(original)) value = original;
      }
      if (field.type === 'DATETIME' && value && value !== original)
        value = new Date(String(value)).toISOString();
      values[field.name] = value;
    }
    return {
      values,
      scope: recordScopeValues(active, { ...form.context?.scope, ...input }),
    };
  }
  async function policy(op: CrudDataAttrOperation): Promise<DataAttrPolicy> {
    let code = operationCodes[op];
    if (op === 'create' && form.operation !== 'EDIT') code = form.operation;
    const granted = allowed(code);
    let inputFields: string[] = [];
    if (op === 'list')
      inputFields = (model.queryInputs || []).map((field) => field.key);
    else if (op === 'create' || op === 'update')
      inputFields = activeFormFields()
        // 只读归属由已返回formContext提供展示入口；提交仍由独立只读/归属白名单排除。
        .filter(
          (field) =>
            !field.readOnly ||
            (field.source === 'SCOPE' &&
              form.context?.fields.some(
                (returned) =>
                  returned.source === 'SCOPE' && returned.name === field.name,
              )),
        )
        .map((field) => field.name);
    const inputNames = new Set(inputFields);
    if (op === 'list')
      for (const key of [
        'pageIndex',
        'pageSize',
        'modelKey',
        'orderBy',
        'orderDir',
      ])
        inputNames.add(key);
    if (op !== 'create') for (const key of identityFields) inputNames.add(key);
    const outputNames = new Set(
      code.startsWith('CUSTOM_')
        ? operation(code)?.responseParams.map((field) => field.name) || []
        : model.operationFields?.[responseViews[op]] ||
            operation(code)?.responseParams.map((field) => field.name) ||
            [],
    );
    const keys = new Set([
      ...config.fields.map((field) => field.key),
      ...identityFields,
      ...inputNames,
    ]);
    const root = (names: Set<string>) => ({
      kind: 'object' as const,
      fields: [...keys].map((key) => ({
        name: key,
        wireName: key,
        nodeId: 'value',
        groupIds: granted && names.has(key) ? [] : ['denied'],
      })),
    });
    return {
      id: `${model.key}:${code}`,
      operation: code,
      restricted: true,
      methods: [],
      pathPatterns: [],
      groups: [{ id: 'denied', name: '未授予', allowed: false }],
      nodes: {
        input: root(inputNames),
        output: root(outputNames),
        value: { kind: 'value' },
      },
      requestRoots: [{ location: 'body', parameterIndex: 0, nodeId: 'input' }],
      viewRoots: { request: ['input'], response: ['output'] },
      responseRoot: 'output',
    };
  }
  const permission = (code: DataModelOperationCode) =>
    operation(code)?.permissionExpr || '__dynamic_operation_unavailable__';
  const config: CrudPageConfig = reactive({
    apiBase: `/DataModel/${model.key}`,
    title: model.title,
    pageDisplaySettingCode: modelDisplayCode(model.key),
    recordKey: 'id',
    domainObject: true,
    createButtonVisible: false,
    fields,
    detailFields: fields.filter((field) => field.detail),
    allowCreate: allowed('CREATE'),
    allowEdit: allowed('EDIT'),
    allowDelete: allowed('DELETE'),
    allowRetrieve: allowed('DETAIL'),
    allowExport: allowed('QUERY'),
    queryPermission: permission('QUERY'),
    createPermission: permission('CREATE'),
    editPermission: permission('EDIT'),
    deletePermission: permission('DELETE'),
    detailPermission: permission('DETAIL'),
    editVisibleOn: '__record.editable !== false',
    deleteVisibleOn: '__record.editable !== false',
    initialQuery: {},
    defaultQuery: { pageSize: 20 },
    defaultFormValues: {},
    dataAttrPolicyProvider: policy,
    prepareCreate,
    loadEditRecord,
    apiService: {
      list: async (input: Record<string, unknown> = {}) => {
        assertOperation('QUERY');
        const queryValues = buildRecordQueryValues(
          model.queryInputs || [],
          input,
        );
        let sorting: { sortBy?: string; sortDirection?: 'ASC' | 'DESC' } = {};
        if (input.orderBy !== undefined) {
          const sortedField = config.fields.find(
            (field) => field.key === input.orderBy && field.sortable,
          );
          if (!sortedField) throw new Error('当前字段不支持排序或未获授权');
          sorting = {
            sortBy: sortedField.key,
            sortDirection:
              String(input.orderDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
          };
        }
        return loadModelCrudPage(
          Number(input.pageIndex || 1),
          Number(input.pageSize || 20),
          (page, size) =>
            dataModelService.queryRecords(model.key, {
              pageIndex: page + 1,
              pageSize: size,
              queryValues,
              ...sorting,
            }),
          context,
        );
      },
      retrieve: (input: Record<string, unknown>) => {
        assertOperation('DETAIL');
        return dataModelService.record(model.key, String(input.id));
      },
      create: (input: Record<string, unknown>) => {
        assertOperation(form.operation);
        const data = payload(input);
        const request =
          form.operation === 'CREATE'
            ? dataModelService.createRecord(
                model.key,
                data.values,
                requestKey,
                data.scope,
              )
            : dataModelService.executeOperation(
                model.key,
                form.operation,
                undefined,
                undefined,
                data.values,
                data.scope,
                requestKey,
              );
        return recordRequest(request, '创建失败，请重新读取后重试');
      },
      update: (input: Record<string, unknown>) => {
        assertOperation('EDIT', form.original);
        const data = payload(input);
        return dataModelService
          .updateRecord(
            model.key,
            String(input.id),
            data.values,
            recordExpectedVersion(input),
            data.scope,
          )
          .catch((error: unknown) => {
            throw new Error(recordFailure(error, '保存失败，请重新读取后重试'));
          });
      },
      delete: (
        input: Record<string, unknown>,
        _options?: unknown,
        row?: Record<string, unknown>,
      ) => {
        assertOperation('DELETE', row);
        return recordRequest(
          dataModelService.deleteRecord(
            model.key,
            String(input.id),
            recordExpectedVersion(row || input),
          ),
          '删除失败，请重新读取后重试',
        );
      },
    },
    rowActions: (model.operations || [])
      .filter(
        (item) =>
          allowed(item.code) &&
          (item.code === 'SET_ENABLED' ||
            (item.target === 'RECORD' &&
              item.executionType === 'UPDATE_FIELDS')),
      )
      .map((item) => ({
        label: item.title,
        displayKey: item.code,
        permission: item.permissionExpr,
        confirmText: item.confirmText,
        visible: writable,
        handler: (row: Record<string, unknown>) => {
          assertOperation(item.code, row);
          const request =
            item.code === 'SET_ENABLED'
              ? dataModelService.setEnabled(
                  model.key,
                  String(row.id),
                  row.enable !== true,
                  recordExpectedVersion(row),
                )
              : dataModelService.executeOperation(
                  model.key,
                  item.code,
                  String(row.id),
                  recordExpectedVersion(row),
                );
          return recordRequest(request, '操作失败，请重新读取后重试');
        },
      })),
  });
  return {
    config,
    form,
    queryContext,
    allowed,
    customCreates: (model.operations || []).filter(
      (item) =>
        allowed(item.code) &&
        !item.standardAction &&
        item.target === 'OBJECT' &&
        item.executionType === 'CREATE_RECORD',
    ),
    chooseCreate(code: DataModelOperationCode) {
      assertOperation(code);
      pendingCreate = code;
      config.allowCreate = true;
      config.createPermission = permission(code);
    },
    changeScope,
    async loadQueryContext() {
      if ((model.queryInputs || []).some((field) => field.referenceType))
        queryContext.value = await loadContext('QUERY');
    },
  };
}
