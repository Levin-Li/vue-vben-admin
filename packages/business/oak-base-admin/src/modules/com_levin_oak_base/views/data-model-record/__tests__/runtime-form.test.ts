/* eslint-disable @typescript-eslint/no-non-null-assertion -- 固定测试契约明确提供被调用的接口与断言索引，缺失会使测试失败。 */
import type {
  DataModelDefinition,
  DataModelFormContext,
  DataModelOperationCode,
  DataModelOperationParameter,
} from '../../../api/data-model-service';

import {
  fieldAllowed,
  validatePolicy,
} from '@levin/admin-framework/framework-commons/data-attr-policy';
import { evaluateCrudVisibleOn } from '@levin/admin-framework/framework-commons/shared/crud-visible-on';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDynamicCrudAdapter } from '../standard-crud-adapter';

const service = vi.hoisted(() => ({
  queryRecords: vi.fn(),
  formContext: vi.fn(),
  createRecord: vi.fn(),
  editRecord: vi.fn(),
  updateRecord: vi.fn(),
  record: vi.fn(),
  setEnabled: vi.fn(),
  deleteRecord: vi.fn(),
  executeOperation: vi.fn(),
}));
vi.mock('../../../api/data-model-service', () => ({
  dataModelService: service,
}));
vi.mock('../../domain-data-dynamic-model/model-metadata', () => ({
  modelMetadataCache: {
    read: (_context: string, _key: string, loader: () => Promise<unknown>) =>
      loader(),
  },
}));

const field = (
  name: string,
  type = 'STRING',
  source = 'BUSINESS',
): DataModelOperationParameter => ({
  name,
  title: name,
  type,
  source,
  nullable: false,
});
function model(
  codes: DataModelOperationCode[] = [
    'QUERY',
    'CREATE',
    'EDIT',
    'DETAIL',
    'DELETE',
    'SET_ENABLED',
  ],
): DataModelDefinition {
  const business = [
    field('occurredAt', 'DATETIME'),
    field('amount', 'MONEY'),
    field('metadata', 'JSON'),
    field('name'),
  ];
  return {
    key: 'demo',
    name: 'demo',
    title: '示例',
    namingVersion: 2,
    fields: business.map((item) => ({
      ...item,
      key: item.name.toLowerCase(),
      type: item.type as 'STRING',
      nullable: false,
      defaultValue:
        item.name === 'amount'
          ? '123456789012345678901234567890.12'
          : undefined,
    })),
    systemFields: [
      'id',
      'optimisticLock',
      'enable',
      'editable',
      'tenantId',
      'orgId',
      'ownerId',
      'domainId',
    ].map((name) => ({
      key: `RECORD_SYSTEM.${name}`,
      name,
      title: name,
      type: 'STRING',
      nullable: true,
      source: 'RECORD_SYSTEM',
    })),
    operations: codes.map((code) => ({
      code,
      title: code,
      path: code,
      method: 'POST',
      permissionExpr: `permission:${code}`,
      authorized: true,
      available: true,
      enabled: true,
      requestParams: business,
      responseParams: business,
      standardAction: code.startsWith('CUSTOM_') ? undefined : code,
      target: code.startsWith('CUSTOM_') ? 'OBJECT' : 'RECORD',
      executionType: code.startsWith('CUSTOM_') ? 'CREATE_RECORD' : 'STANDARD',
    })),
    operationFields: {
      LIST: ['id', 'optimisticLock', 'editable', 'name', 'amount'],
      DETAIL: ['id', 'name', 'amount'],
      CREATE: business.map((item) => item.name),
      EDIT: business.map((item) => item.name),
    },
    queryInputs: [
      {
        key: '__query_f_name_contains',
        field: 'name',
        title: '名称包含',
        type: 'STRING',
        operator: 'CONTAINS',
        defaultVisible: true,
      },
    ],
  };
}
let context: DataModelFormContext;
beforeEach(() => {
  vi.resetAllMocks();
  context = {
    fields: model().operations![1]!.requestParams,
    scope: {},
    options: {},
  };
  service.formContext.mockImplementation(async () => context);
  service.queryRecords.mockResolvedValue({ items: [], total: 12 });
  service.createRecord.mockResolvedValue({ id: 'new', optimisticLock: 0 });
  service.deleteRecord.mockResolvedValue(undefined);
  service.setEnabled.mockResolvedValue({});
  service.executeOperation.mockResolvedValue({});
});

describe('后端元数据适配公共CRUD', () => {
  it('混合类型按接口顺序，金融数字始终text/string，默认金额完整保存', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    const amount = adapter.config.fields.find((item) => item.key === 'amount')!;
    expect([amount.type, amount.valueType]).toEqual(['text', 'string']);
    expect(
      adapter.config.fields
        .filter((item) => item.formCreate)
        .map((item) => item.key),
    ).toEqual(['occurredAt', 'amount', 'metadata', 'name']);
    const defaults = await adapter.config.prepareCreate!();
    await adapter.config.apiService!.create!(defaults);
    expect(service.createRecord.mock.calls[0]![1].amount).toBe(
      '123456789012345678901234567890.12',
    );
    expect(adapter.config.pageDisplaySettingCode).toBe(
      '/clob/V1/DataModelRecord/demo',
    );
  });

  it('仅QUERY授权不会放开标准写操作，每个配置属性均有明确策略', async () => {
    const adapter = createDynamicCrudAdapter(model(['QUERY']), () => 'actor');
    expect([
      adapter.config.allowCreate,
      adapter.config.allowEdit,
      adapter.config.allowDelete,
    ]).toEqual([false, false, false]);
    const policy = await adapter.config.dataAttrPolicyProvider!('list');
    validatePolicy(policy);
    expect(fieldAllowed(policy, 'output', 'name')).toBe(true);
    expect(fieldAllowed(policy, 'output', 'metadata')).toBe(false);
    expect(fieldAllowed(policy, 'input', '__query_f_name_contains')).toBe(true);
    expect(fieldAllowed(policy, 'input', 'tenantId')).toBe(false);
    await expect(adapter.config.prepareCreate!()).rejects.toThrow('未授权');
  });

  it('查询只发送固定参数值且把total适配标准分页totals', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    const result = await adapter.config.apiService!.list!({
      __query_f_name_contains: 'a%_',
      op: 'GT',
      name: 'injected',
      pageIndex: 2,
      pageSize: 20,
    });
    expect(service.queryRecords).toHaveBeenCalledWith('demo', {
      pageIndex: 2,
      pageSize: 20,
      queryValues: { __query_f_name_contains: 'a%_' },
    });
    expect(result.totals).toBe(12);
  });

  it('高级模式只传条件树，切回简单模式只传原查询参数', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    adapter.setAdvancedQuery(true);
    expect(
      adapter.config.fields.find(
        (item) => item.key === '__query_f_name_contains',
      )?.search,
    ).toBe(false);
    adapter.advancedQuery.tree = {
      type: 'NOT',
      child: { type: 'PARAM', key: '__query_f_name_contains', value: '归档' },
    };
    await adapter.config.apiService!.list!({
      __query_f_name_contains: '隐藏旧值',
    });
    expect(service.queryRecords).toHaveBeenLastCalledWith('demo', {
      pageIndex: 1,
      pageSize: 20,
      conditionTree: {
        type: 'NOT',
        child: { type: 'PARAM', key: '__query_f_name_contains', value: '归档' },
      },
    });
    adapter.setAdvancedQuery(false);
    expect(
      adapter.config.fields.find(
        (item) => item.key === '__query_f_name_contains',
      )?.search,
    ).toBe(true);
    await adapter.config.apiService!.list!({
      __query_f_name_contains: '当前简单值',
    });
    expect(service.queryRecords).toHaveBeenLastCalledWith('demo', {
      pageIndex: 1,
      pageSize: 20,
      queryValues: { __query_f_name_contains: '当前简单值' },
    });
  });

  it('编辑先读完整EDIT对象，未改日期微秒原样提交，冲突不重试', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    const original = {
      id: 'row',
      optimisticLock: 4,
      occurredAt: '2026-10-22T02:20:30.123456Z',
      amount: '88888888888888888888888.99',
      metadata: { a: 1 },
      name: 'before',
    };
    service.editRecord.mockResolvedValue(original);
    expect(await adapter.config.loadEditRecord!({ id: 'row' })).toMatchObject(
      original,
    );
    service.updateRecord.mockRejectedValue(new Error('版本冲突'));
    await expect(
      adapter.config.apiService!.update!({
        ...original,
        occurredAt: '2026-10-22T02:20:30Z',
        name: 'after',
      }),
    ).rejects.toThrow('重新加载');
    expect(service.updateRecord).toHaveBeenCalledTimes(1);
    expect(service.updateRecord).toHaveBeenCalledWith(
      'demo',
      'row',
      {
        occurredAt: original.occurredAt,
        amount: original.amount,
        metadata: original.metadata,
        name: 'after',
      },
      4,
      {},
    );
  });

  it('内置编辑删除遵守公共visibleOn的__record上下文，正常记录不被误隐藏', () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    for (const expression of [
      adapter.config.editVisibleOn,
      adapter.config.deleteVisibleOn,
    ]) {
      expect(
        evaluateCrudVisibleOn(expression, { id: 'row', editable: true }, {}),
      ).toBe(true);
      expect(
        evaluateCrudVisibleOn(expression, { id: 'row', editable: false }, {}),
      ).toBe(false);
    }
  });
  it('不可编辑记录禁止编辑启停删除，详情读取仍可用', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    await expect(
      adapter.config.loadEditRecord!({ id: 'row', editable: false }),
    ).rejects.toThrow('不可编辑');
    expect(
      adapter.config.rowActions!.every(
        (action) => action.visible!({ editable: false }) === false,
      ),
    ).toBe(true);
    expect(() =>
      adapter.config.apiService!.delete!({ id: 'row' }, undefined, {
        id: 'row',
        editable: false,
        optimisticLock: 1,
      }),
    ).toThrow('不可编辑');
    await adapter.config.apiService!.retrieve!({ id: 'row' });
    expect(service.record).toHaveBeenCalledWith('demo', 'row');
  });

  it('删除必须使用完整行的乐观锁，缺失版本拒绝', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    await adapter.config.apiService!.delete!({ id: 'row' }, undefined, {
      id: 'row',
      optimisticLock: 9,
    });
    expect(service.deleteRecord).toHaveBeenCalledWith('demo', 'row', 9);
    expect(() => adapter.config.apiService!.delete!({ id: 'row' })).toThrow(
      '缺少有效版本',
    );
  });

  it('custom对象独立授权复用同一新增表单并携带固定去重键', async () => {
    const adapter = createDynamicCrudAdapter(
      model(['CUSTOM_create']),
      () => 'actor',
    );
    expect(adapter.allowed('QUERY')).toBe(false);
    adapter.chooseCreate('CUSTOM_create');
    await adapter.config.prepareCreate!();
    expect(adapter.config.createPermission).toBe('permission:CUSTOM_create');
    expect(service.formContext).toHaveBeenCalledWith(
      'demo',
      'CUSTOM_create',
      undefined,
      undefined,
    );
    await adapter.config.apiService!.create!({ name: 'custom' });
    await adapter.config.apiService!.create!({ name: 'custom' });
    expect(service.executeOperation.mock.calls[0]![6]).toBe(
      service.executeOperation.mock.calls[1]![6],
    );
    expect(service.createRecord).not.toHaveBeenCalled();
  });

  it('scope联动仅携带接口允许项，隐藏可信默认保留但不夹带tenant/domain', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    context = {
      fields: [
        field('orgId', 'STRING', 'SCOPE'),
        field('ownerId', 'STRING', 'SCOPE'),
      ],
      scope: {
        tenantId: 'tenant',
        domainId: 'domain',
        orgId: 'org-a',
        ownerId: 'owner',
      },
      options: {},
    };
    await adapter.config.prepareCreate!();
    const state: Record<string, unknown> = {};
    await adapter.changeScope('orgId', 'org-b', state);
    expect(service.formContext.mock.calls[1]![3]).toEqual({
      orgId: 'org-b',
      ownerId: null,
    });
    await adapter.config.apiService!.create!({ orgId: 'org-b' });
    expect(service.createRecord.mock.calls[0]![3]).toEqual({
      orgId: 'org-b',
      ownerId: 'owner',
    });
  });

  it('旧命名模型禁止进入公共CRUD', () => {
    expect(() =>
      createDynamicCrudAdapter(
        { ...model(), requiresNamingMigration: true },
        () => 'actor',
      ),
    ).toThrow('升级字段命名');
  });
  it('接口scope候选保留UI开关，租户/领域缺省隐藏且不附加静态角色限制', () => {
    const definition = model();
    const create = definition.operations!.find(
      (item) => item.code === 'CREATE',
    )!;
    create.requestParams.push(
      { ...field('tenantId', 'STRING', 'SCOPE'), referenceType: 'TENANT' },
      { ...field('domainId', 'STRING', 'SCOPE'), referenceType: 'DOMAIN' },
      { ...field('orgId', 'STRING', 'SCOPE'), referenceType: 'ORG' },
    );
    definition.queryInputs![0]!.defaultVisible = false;
    const adapter = createDynamicCrudAdapter(definition, () => 'actor');
    expect(
      adapter.config.fields.find((item) => item.key === 'tenantId'),
    ).toMatchObject({
      formCreate: true,
      defaultHidden: { create: true, edit: true },
      defaultVisibleRoleCodes: [],
    });
    expect(
      adapter.config.fields.find((item) => item.key === 'domainId'),
    ).toMatchObject({
      formCreate: true,
      defaultHidden: { create: true, edit: true },
      defaultVisibleRoleCodes: [],
    });
    expect(
      adapter.config.fields.find(
        (item) => item.key === '__query_f_name_contains',
      )?.defaultHidden?.query,
    ).toBe(true);
  });
  it('公共表头排序只映射已授权LIST标量字段，JSON与未返回字段拒绝', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    expect(
      adapter.config.fields.find((item) => item.key === 'amount')?.sortable,
    ).toBeUndefined();
    await adapter.config.apiService!.list!({
      orderBy: 'amount',
      orderDir: 'Desc',
    });
    expect(service.queryRecords).toHaveBeenCalledWith('demo', {
      pageIndex: 1,
      pageSize: 20,
      queryValues: {},
      sortBy: 'amount',
      sortDirection: 'DESC',
    });
    expect(
      adapter.config.fields.find((item) => item.key === 'metadata')?.sortable,
    ).toBe(false);
    await expect(
      adapter.config.apiService!.list!({
        orderBy: 'metadata',
        orderDir: 'Asc',
      }),
    ).rejects.toThrow('不支持排序');
    await expect(
      adapter.config.apiService!.list!({
        orderBy: 'occurredAt',
        orderDir: 'Asc',
      }),
    ).rejects.toThrow('不支持排序');
  });
  it('归属候选迟到响应不能覆盖更晚的选择或隐藏默认值', async () => {
    const adapter = createDynamicCrudAdapter(model(), () => 'actor');
    const scoped = {
      fields: [
        field('orgId', 'STRING', 'SCOPE'),
        field('ownerId', 'STRING', 'SCOPE'),
      ],
      scope: { orgId: 'initial', ownerId: null },
      options: {},
    };
    context = scoped;
    await adapter.config.prepareCreate!();
    let first!: (value: DataModelFormContext) => void;
    let second!: (value: DataModelFormContext) => void;
    service.formContext
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            second = resolve;
          }),
      );
    const state: Record<string, unknown> = {};
    const older = adapter.changeScope('orgId', 'older', state);
    const newer = adapter.changeScope('orgId', 'newer', state);
    second({ ...scoped, scope: { orgId: 'newer', ownerId: null } });
    await newer;
    first({ ...scoped, scope: { orgId: 'older', ownerId: 'old-owner' } });
    await older;
    expect(state).toEqual({ orgId: 'newer', ownerId: null });
    expect(adapter.config.defaultFormValues).toMatchObject({
      orgId: 'newer',
      ownerId: null,
    });
  });
  it('仅服务端实际返回的只读scope可展示，篡改值不会进入默认或提交', async () => {
    const definition = model();
    const parameter = {
      ...field('tenantId', 'STRING', 'SCOPE'),
      referenceType: 'TENANT' as const,
      readOnly: true,
      serverManaged: true,
    };
    definition
      .operations!.find((item) => item.code === 'CREATE')!
      .requestParams.push(parameter);
    const adapter = createDynamicCrudAdapter(definition, () => 'actor');
    expect(
      fieldAllowed(
        await adapter.config.dataAttrPolicyProvider!('create'),
        'input',
        'tenantId',
      ),
    ).toBe(false);
    context = {
      fields: [parameter, field('name')],
      scope: { tenantId: 'trusted' },
      options: {},
    };
    await adapter.config.prepareCreate!();
    expect(
      fieldAllowed(
        await adapter.config.dataAttrPolicyProvider!('create'),
        'input',
        'tenantId',
      ),
    ).toBe(true);
    expect(
      adapter.config.fields.find((item) => item.key === 'tenantId')?.readOnly,
    ).toBe(true);
    expect(adapter.config.createSubmitKeys).not.toContain('tenantId');
    expect(adapter.config.defaultFormValues).not.toHaveProperty('tenantId');
    await adapter.config.apiService!.create!({
      tenantId: 'tampered',
      name: 'new',
    });
    expect(service.createRecord).toHaveBeenCalledWith(
      'demo',
      { name: 'new' },
      expect.any(String),
      {},
    );
  });
});
