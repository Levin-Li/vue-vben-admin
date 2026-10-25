import { getResAuthorizeMeta } from '@levin/admin-framework/framework-commons/api-authorize';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import { describe, expect, it, vi } from 'vitest';

import { modelMetadataCache } from '../../views/domain-data-dynamic-model/model-metadata';
import { dataModelService } from '../data-model-service';

describe('动态记录永久删除请求', () => {
  it('以 DELETE 请求体发送模型标识、记录 ID 和读取时的版本', async () => {
    const transport = vi
      .spyOn(
        dataModelService as unknown as {
          request: (options: unknown) => Promise<unknown>;
        },
        'request',
      )
      .mockResolvedValue(undefined);
    await dataModelService.deleteRecord(
      'invoice',
      '405eb392-1a91-4df2-bcd0-ed67fd7fef83',
      3,
    );
    expect(transport).toHaveBeenCalledWith({
      method: 'DELETE',
      path: 'deleteRecord',
      data: {
        key: 'invoice',
        id: '405eb392-1a91-4df2-bcd0-ed67fd7fef83',
        expectedVersion: 3,
      },
    });
    transport.mockRestore();
  });
});

it('运行时接口仅要求认证，管理草稿仍使用传统资源权限', () => {
  for (const method of [
    'catalog',
    'records',
    'queryRecords',
    'record',
    'editRecord',
    'createRecord',
    'updateRecord',
    'setEnabled',
    'deleteRecord',
    'formContext',
    'executeOperation',
  ]) {
    expect(buildApiMethodPermissions(dataModelService, method)).toEqual([]);
    expect(
      getResAuthorizeMeta(
        (dataModelService as unknown as Record<string, object>)[method],
      ).onlyRequireAuthenticated,
    ).toBe(true);
  }
  expect(
    buildApiMethodPermissions(dataModelService, 'getDefinition'),
  ).not.toEqual([]);
  expect(buildApiMethodPermissions(dataModelService, 'saveFields')).not.toEqual(
    [],
  );
});

it('编辑与启停均绑定客户端读取时的版本', async () => {
  const transport = vi
    .spyOn(
      dataModelService as unknown as {
        request: (options: unknown) => Promise<unknown>;
      },
      'request',
    )
    .mockResolvedValue({});
  await dataModelService.updateRecord(
    'invoice',
    'id-1',
    { amount: '12.34' },
    5,
  );
  expect(transport).toHaveBeenLastCalledWith({
    method: 'PUT',
    path: 'updateRecord',
    data: {
      key: 'invoice',
      id: 'id-1',
      values: { amount: '12.34' },
      expectedVersion: 5,
    },
  });
  await dataModelService.setEnabled('invoice', 'id-1', false, 6);
  expect(transport).toHaveBeenLastCalledWith({
    method: 'PUT',
    path: 'setEnabled',
    data: { key: 'invoice', id: 'id-1', enable: false, expectedVersion: 6 },
  });
  transport.mockRestore();
});

it('固定查询协议只发送queryValues，不附带自由filters结构', async () => {
  const transport = vi
    .spyOn(
      dataModelService as unknown as {
        request: (options: unknown) => Promise<unknown>;
      },
      'request',
    )
    .mockResolvedValue({ items: [], total: 0 });
  await dataModelService.queryRecords('invoice', {
    queryValues: { __query_f_a_gte: '12345678901234567890.12' },
    pageIndex: 2,
    pageSize: 20,
  });
  expect(transport).toHaveBeenCalledWith({
    method: 'POST',
    path: 'queryRecords',
    data: {
      key: 'invoice',
      page: 1,
      size: 20,
      queryValues: { __query_f_a_gte: '12345678901234567890.12' },
    },
  });
  transport.mockRestore();
});

it('自定义记录动作不提交可伪造赋值，对象动作独立提交业务值scope和去重键', async () => {
  const transport = vi
    .spyOn(
      dataModelService as unknown as {
        request: (options: unknown) => Promise<unknown>;
      },
      'request',
    )
    .mockResolvedValue({});
  await dataModelService.executeOperation('invoice', 'CUSTOM_confirm', 'r', 8);
  expect(transport).toHaveBeenLastCalledWith({
    method: 'POST',
    path: 'executeOperation',
    data: {
      key: 'invoice',
      operationCode: 'CUSTOM_confirm',
      id: 'r',
      expectedVersion: 8,
    },
  });
  await dataModelService.executeOperation(
    'invoice',
    'CUSTOM_create',
    undefined,
    undefined,
    { amount: '1.23' },
    { orgId: 'o' },
    'once',
  );
  expect(transport).toHaveBeenLastCalledWith({
    method: 'POST',
    path: 'executeOperation',
    data: {
      key: 'invoice',
      operationCode: 'CUSTOM_create',
      values: { amount: '1.23' },
      scope: { orgId: 'o' },
      requestKey: 'once',
    },
  });
  transport.mockRestore();
});

it('写入开始与完成均失效，写入期间重取的旧投影不能存留', async () => {
  let finish: (value: unknown) => void = () => {};
  const transport = vi
    .spyOn(
      dataModelService as unknown as {
        request: (options: unknown) => Promise<unknown>;
      },
      'request',
    )
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const pending = dataModelService.save({
    key: 'invoice',
    name: 'invoice',
    title: '发票',
    scopeKind: 'PRIVATE',
  });
  const loader = vi
    .fn()
    .mockResolvedValueOnce([{ version: 1 }])
    .mockResolvedValueOnce([{ version: 2 }]);
  expect(
    await modelMetadataCache.read('actor-write', 'catalog', loader),
  ).toEqual([{ version: 1 }]);
  finish({ key: 'invoice', version: 2, fields: [] });
  await pending;
  expect(
    await modelMetadataCache.read('actor-write', 'catalog', loader),
  ).toEqual([{ version: 2 }]);
  expect(loader).toHaveBeenCalledTimes(2);
  transport.mockRestore();
});

it('旧命名升级使用预览版本与指纹，并保持结构同步资源权限', async () => {
  const transport = vi
    .spyOn(
      dataModelService as unknown as {
        request: (options: unknown) => Promise<unknown>;
      },
      'request',
    )
    .mockResolvedValue({});
  await dataModelService.previewNamingMigration('legacy');
  expect(transport).toHaveBeenLastCalledWith({
    method: 'GET',
    path: 'previewNamingMigration',
    params: { key: 'legacy' },
  });
  await dataModelService.migrateNaming('legacy', 7, 'checked-fingerprint');
  expect(transport).toHaveBeenLastCalledWith({
    method: 'POST',
    path: 'migrateNaming',
    data: {
      key: 'legacy',
      expectedVersion: 7,
      fingerprint: 'checked-fingerprint',
    },
  });
  expect(buildApiMethodPermissions(dataModelService, 'migrateNaming')).toEqual(
    buildApiMethodPermissions(dataModelService, 'sync'),
  );
  transport.mockRestore();
});
