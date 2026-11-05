import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCrudUserLoadApi,
  getCrudUserResolveRecords,
  getCrudUserSearchApi,
} from '../crud-user-selector';

const fetchList = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ fetchCrudList: fetchList }));
vi.mock('../../app/api/rbac-service', () => ({
  rbacService: {
    fetchAuthorizedOrgTree: vi.fn(async () => [
      { id: 'org', children: [{ id: 'other-org' }] },
    ]),
    fetchAuthorizedOrgTreeByTenant: vi.fn(async () => [
      { id: 'org', tenantId: 'tenant-a' },
      { id: 'other', tenantId: 'tenant-b' },
    ]),
  },
}));

describe('公共 CRUD 用户选择器数据加载', () => {
  beforeEach(() => fetchList.mockReset());

  it('搜索逐组织分页并区分普通和平台权限路径，自定义候选不自动搜索', async () => {
    const field = {
      key: 'userId',
      label: '用户',
      type: 'user-tree-select' as const,
    };
    fetchList
      .mockResolvedValueOnce({ items: [{ id: '1' }], totals: 2 })
      .mockResolvedValueOnce({ items: [{ id: '2' }], totals: 2 });
    expect(
      await getCrudUserSearchApi(field, '/api')!({
        orgId: 'org',
        keyword: '张',
      }),
    ).toHaveLength(2);
    expect(fetchList.mock.calls[0]?.[1]).toMatchObject({
      orgId: 'org',
      containsName: '张',
      enable: true,
    });
    expect(fetchList.mock.calls[1]?.[1].pageIndex).toBe(2);
    expect(fetchList.mock.calls[0]?.[3]).toEqual({
      globalUserOrgContext: { orgIds: ['org'] },
    });
    fetchList.mockResolvedValueOnce({ items: [], totals: 0 });
    await getCrudUserSearchApi(field, '/api', 'tenant-a')!({
      orgId: 'org',
      keyword: '张',
    });
    expect(fetchList.mock.calls[2]?.[0]).toBe('/User/selectorCandidates');
    expect(fetchList.mock.calls[2]?.[1]).toMatchObject({
      tenantId: 'tenant-a',
      orgId: 'org',
      keyword: '张',
    });
    expect(fetchList.mock.calls[2]?.[3]).toEqual({
      globalUserOrgContext: { tenantId: 'tenant-a', orgIds: ['org'] },
    });
    expect(
      getCrudUserSearchApi({ ...field, userLoadApi: async () => [] }, '/api'),
    ).toBeUndefined();
  });

  it('按组织加载全部分页，默认仅启用用户', async () => {
    fetchList
      .mockResolvedValueOnce({ items: [{ id: '1' }, { id: '2' }], totals: 3 })
      .mockResolvedValueOnce({ items: [{ id: '3' }], totals: 3 });
    const load = getCrudUserLoadApi(
      { key: 'userId', label: '用户', type: 'user-tree-select' },
      '/api',
    );
    expect(
      await load({ orgId: 'org', org: {} as never, userTypes: [] }),
    ).toHaveLength(3);
    expect(fetchList).toHaveBeenNthCalledWith(
      1,
      '/User/list',
      {
        orgId: 'org',
        loadOrg: true,
        enable: true,
        pageIndex: 1,
        pageSize: 500,
      },
      '/api',
      { globalUserOrgContext: { orgIds: ['org'] } },
    );
    expect(fetchList.mock.calls[1]?.[1].pageIndex).toBe(2);
  });

  it('允许业务显式查询停用用户', async () => {
    fetchList.mockResolvedValue({ items: [], totals: 0 });
    const load = getCrudUserLoadApi(
      {
        key: 'userId',
        label: '用户',
        type: 'user-tree-select',
        userEnable: false,
      },
      '/api',
    );
    await load({ orgId: 'org', org: {} as never, userTypes: [] });
    expect(fetchList.mock.calls[0]?.[1].enable).toBe(false);
  });

  it('按服务端限额分批回显多选用户', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => String(i));
    fetchList
      .mockResolvedValueOnce({
        items: ids.slice(0, 100).map((id) => ({ id, name: id })),
        totals: 100,
      })
      .mockResolvedValueOnce({
        items: [{ id: '100', name: '100' }],
        totals: 1,
      });
    const resolve = getCrudUserResolveRecords(
      { key: 'userId', label: '用户', type: 'user-tree-select' },
      '/api',
      'tenant-a',
    );
    expect(await resolve?.(ids)).toHaveLength(101);
    expect(fetchList.mock.calls.map((call) => call[1].pageSize)).toEqual([
      100, 1,
    ]);
  });

  it('普通租户跨授权组织回显时每批都携带完整授权组织上下文', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => String(i));
    fetchList
      .mockResolvedValueOnce({
        items: [{ id: '0', name: '甲', orgId: 'org' }],
        totals: 1,
      })
      .mockResolvedValueOnce({
        items: [{ id: '100', name: '乙', orgId: 'other-org' }],
        totals: 1,
      });
    const resolve = getCrudUserResolveRecords(
      { key: 'userId', label: '用户', type: 'user-tree-select' },
      '/api',
    );
    expect((await resolve?.(ids))?.map((item) => item.name)).toEqual([
      '甲',
      '乙',
    ]);
    expect(fetchList.mock.calls.map((call) => call[1].idList.length)).toEqual([
      100, 1,
    ]);
    expect(fetchList.mock.calls.map((call) => call[3])).toEqual([
      { globalUserOrgContext: { orgIds: ['org', 'other-org'] } },
      { globalUserOrgContext: { orgIds: ['org', 'other-org'] } },
    ]);
  });

  it('显式启用筛选并拒绝不完整分页', async () => {
    fetchList
      .mockResolvedValueOnce({ items: [{ id: '1' }], totals: 2 })
      .mockResolvedValueOnce({ items: [], totals: 2 });
    const load = getCrudUserLoadApi(
      {
        key: 'userId',
        label: '用户',
        type: 'user-tree-select',
        userEnable: true,
      },
      '/api',
    );
    await expect(
      load({ orgId: 'org', org: {} as never, userTypes: [] }),
    ).rejects.toThrow('未完整加载');
    expect(fetchList.mock.calls[0]?.[1].enable).toBe(true);
  });

  it('目标租户用户候选和回显使用受控接口及显式授权组织', async () => {
    const field = {
      key: 'userId',
      label: '用户',
      type: 'user-tree-select' as const,
    };
    fetchList.mockResolvedValue({
      items: [{ id: '1', name: '甲' }],
      totals: 1,
    });
    const load = getCrudUserLoadApi(field, '/api', 'tenant-a');
    expect(
      await load({ orgId: 'org', org: {} as never, userTypes: [] }),
    ).toHaveLength(1);
    expect(fetchList.mock.calls[0]?.[0]).toBe('/User/selectorCandidates');
    expect(fetchList.mock.calls[0]?.[3]).toEqual({
      globalUserOrgContext: { tenantId: 'tenant-a', orgIds: ['org'] },
    });
    await getCrudUserResolveRecords(field, '/api', 'tenant-a')?.(['1']);
    expect(fetchList.mock.calls[1]?.[3]).toEqual({
      globalUserOrgContext: { tenantId: 'tenant-a', orgIds: ['org'] },
    });
  });

  it('自定义加载和回显限制到目标租户及授权组织', async () => {
    const field = {
      key: 'userId',
      label: '用户',
      type: 'user-tree-select' as const,
      userLoadApi: async () => [
        { id: '1', tenantId: 'tenant-a', orgId: 'org' },
        { id: '2', tenantId: 'tenant-a', orgId: 'not-authorized' },
      ],
      userResolveRecords: async () => [
        {
          id: '1',
          kind: 'user' as const,
          name: '甲',
          tenantId: 'tenant-a',
          orgId: 'org',
        },
        {
          id: '2',
          kind: 'user' as const,
          name: '乙',
          tenantId: 'tenant-a',
          orgId: 'not-authorized',
        },
      ],
    };
    const load = getCrudUserLoadApi(field, '/api', 'tenant-a');
    const loaded = await load({
      orgId: 'org',
      org: {} as never,
      userTypes: [],
    });
    expect(loaded.map((item) => item.id)).toEqual(['1']);
    const resolved = await getCrudUserResolveRecords(
      field,
      '/api',
      'tenant-a',
    )?.(['1', '2']);
    expect(resolved?.map((item) => item.id)).toEqual(['1']);
  });

  it('已有用户按 ID 查询回显，并过滤服务端额外返回项', async () => {
    fetchList.mockResolvedValue({
      items: [
        { id: '1', name: '甲' },
        { id: '2', name: '乙' },
      ],
      totals: 2,
    });
    const resolve = getCrudUserResolveRecords(
      { key: 'userId', label: '用户', type: 'user-tree-select' },
      '/api',
    );
    expect(await resolve?.(['1'])).toEqual([
      { id: '1', kind: 'user', name: '甲', raw: { id: '1', name: '甲' } },
    ]);
    expect(fetchList.mock.calls[0]?.[3]).toEqual({
      globalUserOrgContext: { orgIds: ['org', 'other-org'] },
    });
  });
});
