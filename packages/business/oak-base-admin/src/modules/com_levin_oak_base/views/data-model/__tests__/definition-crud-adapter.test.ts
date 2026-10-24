/* eslint-disable @typescript-eslint/no-non-null-assertion -- 固定测试契约明确提供被调用的接口与断言索引，缺失会使测试失败。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  definitionCrudConfig,
  definitionManagementQuery,
} from '../definition-crud-adapter';
import { loadModelCrudPage } from '../model-page-adapter';

const service = vi.hoisted(() => ({
  queryModels: vi.fn(),
  save: vi.fn(),
  getDefinition: vi.fn(),
}));
vi.mock('../../../api/data-model-service', () => ({
  dataModelService: service,
}));
vi.mock('../../../api/_module', () => ({
  OAK_BASE_API_MODULE: '/com.levin.oak.base/V1/api',
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, action: string) => [
      `actual:${action}`,
    ],
  }),
);
function config() {
  return definitionCrudConfig({
    context: () => 'actor',
    scopes: [{ label: '私人', value: 'PRIVATE' }],
    ownerAllowed: false,
    ownerLoader: async () => [],
    rowActions: [],
  });
}
beforeEach(() => {
  vi.resetAllMocks();
});

describe('模型定义直接配置公共CRUD', () => {
  it('仅映射后端声明的查询与排序，保留literal contains值并转换时间offset', () => {
    expect(
      definitionManagementQuery({
        key: 'a%_',
        enabled: false,
        orderBy: 'title',
        orderDir: 'Asc',
        extra: 'no',
        createdFrom: '2026-10-22T00:00:00Z',
      }),
    ).toEqual({
      key: 'a%_',
      enabled: false,
      sortBy: 'title',
      sortDirection: 'ASC',
      createdFrom: '2026-10-22T00:00:00.000Z',
    });
    expect(
      definitionManagementQuery({
        orderBy: 'title;DROP TABLE',
        orderDir: 'DESC',
      }),
    ).toEqual({});
  });
  it('明确声明公共列表与表单能力，保留查询专用字段和只读字段的排除', () => {
    const value = config();
    const columns = value.fields
      .filter((field) => field.table)
      .map((field) => field.key);
    expect(columns).toEqual(
      expect.arrayContaining(['key', 'name', 'title', 'enabled', 'createdAt']),
    );
    const inputs = value.fields
      .filter((field) => field.form !== false)
      .map((field) => field.key);
    expect(inputs).toEqual(
      expect.arrayContaining([
        'key',
        'name',
        'title',
        'description',
        'scopeKind',
        'tenantShared',
        'orgShared',
      ]),
    );
    expect(inputs).not.toEqual(expect.arrayContaining(['createdAt']));
    expect(columns).not.toContain('createdFrom');
    expect(
      value.fields.find((field) => field.key === 'createdFrom'),
    ).toMatchObject({ form: false, table: false });
  });
  it('无可信组织时新建表单不预选私人或平台归属', async () => {
    const value = config();
    const draft = await value.prepareCreate!();
    expect(draft && draft.scopeKind).toBeUndefined();
    const scopeField = value.fields.find((field) => field.key === 'scopeKind');
    expect(scopeField?.defaultValue).toBeUndefined();
    expect(scopeField?.required).toBe(true);
    expect(() =>
      value.apiService!.create!({ key: 'new', name: '新', title: '新' }),
    ).toThrow('请选择归属范围');
    expect(service.save).not.toHaveBeenCalled();
  });
  it('公共分页使用真实queryModels及资源/字段授权目标', async () => {
    service.queryModels.mockResolvedValue({
      items: [{ key: 'demo' }],
      total: 25,
    });
    const value = config();
    expect(
      await value.apiService!.list!({
        pageIndex: 2,
        pageSize: 20,
        enabled: true,
      }),
    ).toEqual({ items: [{ key: 'demo' }], totals: 25 });
    expect(service.queryModels).toHaveBeenCalledWith({
      page: 1,
      size: 20,
      enabled: true,
    });
    expect(value.queryPermission).toEqual(['actual:queryModels']);
    expect(value.dataAttrTargets?.list).toEqual({
      method: 'GET',
      path: '/com.levin.oak.base/V1/api/DataModel/queryModels',
    });
    expect(value.dataAttrTargets?.update).toEqual({
      method: 'POST',
      path: '/com.levin.oak.base/V1/api/DataModel/save',
    });
    expect(value.dataAttrPolicyProvider).toBeUndefined();
  });
  it('公共编辑提交读取的定义版本，保护scope/key，新增不继承旧编辑状态', async () => {
    const value = config();
    service.getDefinition.mockResolvedValue({
      key: 'demo',
      name: '旧名',
      title: '旧标题',
      version: 8,
      tenantId: 'tenant',
      scopeKind: 'ORG',
      fields: [],
    });
    await value.loadEditRecord!({
      key: 'demo',
      name: '旧名',
      title: '旧标题',
      version: 8,
      tenantId: 'tenant',
      scopeKind: 'ORG',
      fields: [],
    });
    await value.apiService!.update!({
      key: 'injected',
      title: '新标题',
      scopeKind: 'PLATFORM',
      version: 0,
      tenantId: 'evil',
    });
    expect(service.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: 'demo',
        version: 8,
        scopeKind: 'ORG',
        title: '新标题',
      }),
    );
    expect(service.save.mock.calls[0]![0]).not.toHaveProperty('tenantId');
    await value.prepareCreate!();
    await value.apiService!.create!({
      key: 'new',
      name: '新',
      title: '新',
      scopeKind: 'PRIVATE',
    });
    expect(service.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: 'new',
        version: undefined,
        scopeKind: 'PRIVATE',
      }),
    );
  });
});

describe('公共导出分页与身份隔离', () => {
  it('逻辑大页按后端100条上限聚合，后一逻辑页不重复前页', async () => {
    const fetch = vi.fn(async (page: number, size: number) => ({
      items: Array.from(
        { length: Math.max(0, Math.min(size, 350 - page * size)) },
        (_, index) => page * size + index,
      ),
      total: 350,
    }));
    const result = await loadModelCrudPage(2, 150, fetch, () => 'actor');
    expect(result.items).toEqual(
      Array.from({ length: 150 }, (_, index) => index + 150),
    );
    expect(fetch.mock.calls).toEqual([
      [1, 100],
      [2, 100],
    ]);
  });
  it('导出分页中主体变化后丢弃已获得结果', async () => {
    let actor = 'a';
    await expect(
      loadModelCrudPage(
        1,
        200,
        async () => {
          actor = 'b';
          return { items: [1], total: 1 };
        },
        () => actor,
      ),
    ).rejects.toThrow('身份或数据范围已变化');
  });
});
