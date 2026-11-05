import { RequestClient } from '@vben/runtime/request';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadChannelReferencePage } from '../customer/channel-partner-reference';
import { loadReferenceCandidates } from '../reference-candidate-options';

const state = vi.hoisted(() => ({ post: vi.fn(), tree: vi.fn() }));
vi.mock('@levin/admin-framework', () => ({
  requestClient: { post: (...args: unknown[]) => state.post(...args) },
}));
vi.mock(
  '@levin/admin-framework/framework-commons/app/api/rbac-service',
  () => ({
    rbacService: { fetchAuthorizedOrgTreeByTenant: state.tree },
  }),
);
vi.mock('../api-module', () => ({
  OAK_BASE_API_MODULE: '/com.levin.oak.base/V1/api',
}));

describe('受控候选请求的实际 URL', () => {
  beforeEach(() => {
    state.tree.mockReset();
    state.tree.mockResolvedValue([{ id: 'org-b', tenantId: 'tenant-b' }]);
    state.post.mockReset();
  });

  it('默认 API baseURL 非空时，各候选请求只包含一次模块前缀', async () => {
    const paths: string[] = [];
    const client = new RequestClient({
      baseURL: '/com.levin.oak.base/V1/api',
      adapter: async (config) => {
        paths.push(client.instance.getUri(config).split('?')[0] || '');
        return {
          config,
          data: { items: [], totals: 0 },
          headers: {},
          status: 200,
          statusText: 'OK',
        };
      },
    });
    client.addResponseInterceptor({ fulfilled: (response) => response.data });
    state.post.mockImplementation((...args) =>
      client.post(...(args as [string, unknown, any])),
    );

    await loadReferenceCandidates('legalSubjects', 'tenant-b');
    await loadReferenceCandidates('partners', 'tenant-b');
    await loadChannelReferencePage('tenant-b', 1);

    expect(paths).toEqual([
      '/com.levin.oak.base/V1/api/ReferenceCandidates/legalSubjects',
      '/com.levin.oak.base/V1/api/ReferenceCandidates/partners',
      '/com.levin.oak.base/V1/api/ChannelPartnerCandidates/list',
    ]);
  });
});
