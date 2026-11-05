import { RequestClient } from '@vben/runtime/request';

import { describe, expect, it, vi } from 'vitest';

import {
  getCrudUserLoadApi,
  getCrudUserResolveRecords,
} from '../crud-user-selector';

const request = vi.hoisted(() => vi.fn());
vi.mock('../../runtime', () => ({ requestClient: { get: request } }));
vi.mock('../../app/api/rbac-service', () => ({
  rbacService: {
    fetchAuthorizedOrgTree: vi.fn(async () => [{ id: 'org' }]),
    fetchAuthorizedOrgTreeByTenant: vi.fn(async () => [
      { id: 'org', tenantId: 'tenant' },
    ]),
  },
}));

describe('公共用户选择器请求路径', () => {
  it('加载及回显均使用页面配置的模块前缀', async () => {
    request.mockResolvedValue({
      items: [{ id: 'u', name: '用户' }],
      totals: 1,
    });
    const field = {
      key: 'ownerId',
      label: '负责人',
      type: 'user-tree-select' as const,
    };
    const base = '/com.levin.oak.base/V1/api';
    await getCrudUserLoadApi(
      field,
      base,
    )({ orgId: 'org', org: {} as never, userTypes: [] });
    await getCrudUserResolveRecords(field, base)?.(['u']);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/com.levin.oak.base/V1/api/User/list',
      '/com.levin.oak.base/V1/api/User/list',
    ]);
  });

  it('真实请求客户端在非空默认 baseURL 下不会重复用户接口前缀', async () => {
    const paths: string[] = [];
    const client = new RequestClient({
      baseURL: '/com.levin.oak.base/V1/api',
      adapter: async (config) => {
        paths.push(client.instance.getUri(config).split('?')[0] || '');
        return {
          config,
          data: { items: [{ id: 'u', name: '用户' }], totals: 1 },
          headers: {},
          status: 200,
          statusText: 'OK',
        };
      },
    });
    client.addResponseInterceptor({ fulfilled: (response) => response.data });
    request.mockImplementation((url, config) => client.get(url, config));
    const field = {
      key: 'ownerId',
      label: '负责人',
      type: 'user-tree-select' as const,
    };
    const base = '/com.levin.oak.base/V1/api';
    await getCrudUserLoadApi(
      field,
      base,
      'tenant',
    )({
      orgId: 'org',
      org: {} as never,
      userTypes: [],
    });
    await getCrudUserResolveRecords(field, base, 'tenant')?.(['u']);
    expect(paths).toEqual([
      '/com.levin.oak.base/V1/api/User/selectorCandidates',
      '/com.levin.oak.base/V1/api/User/selectorCandidates',
    ]);
  });
});
