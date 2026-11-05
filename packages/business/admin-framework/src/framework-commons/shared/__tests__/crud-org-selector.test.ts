import { describe, expect, it, vi } from 'vitest';

import { getCrudOrgLoadApi } from '../crud-org-selector';

const fetchTree = vi.hoisted(() => vi.fn());
vi.mock('../../app/api/rbac-service', () => ({
  rbacService: { fetchAuthorizedOrgTreeByTenant: fetchTree },
}));

describe('公共 CRUD 组织选择器适配', () => {
  it('无页面候选时交给通用选择器加载当前授权组织', () => {
    expect(
      getCrudOrgLoadApi({
        key: 'orgId',
        label: '所属组织',
        type: 'org-tree-select',
      }),
    ).toBeUndefined();
  });

  it('默认授权树请求显式传递租户并过滤错误租户', async () => {
    fetchTree.mockResolvedValue([
      { id: 'a', tenantId: 'a' },
      { id: 'b', tenantId: 'b' },
    ]);
    const load = getCrudOrgLoadApi({ key: 'orgId', label: '组织' }, 'a');
    expect(await load?.({} as never)).toEqual([
      { id: 'a', tenantId: 'a', children: [] },
    ]);
    expect(fetchTree).toHaveBeenCalledWith('a');
  });

  it('所选租户范围只保留有匹配归属的组织，调用业务限定加载器', async () => {
    const tenantLoadOptions = vi.fn(async () => [
      { value: 'a', label: '甲', tenantId: 'a' },
      { value: 'b', label: '乙', tenantId: 'b' },
      { value: 'missing', label: '无归属' },
    ]);
    const load = getCrudOrgLoadApi(
      { key: 'orgId', label: '组织', tenantLoadOptions },
      'a',
    );
    expect(await load?.({} as never)).toEqual([
      { value: 'a', label: '甲', tenantId: 'a', children: [] },
    ]);
    expect(tenantLoadOptions).toHaveBeenCalledWith('a', '');
  });

  it('保留页面显式远程候选和固定树候选的优先级', async () => {
    const options = [
      {
        label: '组织甲',
        value: 'org-a',
        children: [{ label: '组织乙', value: 'org-b' }],
      },
    ];
    const loadOptions = vi.fn(async () => options);
    const remote = getCrudOrgLoadApi({
      key: 'orgId',
      label: '所属组织',
      type: 'org-tree-select',
      loadOptions,
      options: [],
    });
    const staticLoader = getCrudOrgLoadApi({
      key: 'orgId',
      label: '所属组织',
      type: 'org-tree-select',
      options,
    });

    expect(await remote?.({} as never)).toEqual(options);
    expect(loadOptions).toHaveBeenCalledWith('');
    expect(await staticLoader?.({} as never)).toEqual(options);
  });
});
