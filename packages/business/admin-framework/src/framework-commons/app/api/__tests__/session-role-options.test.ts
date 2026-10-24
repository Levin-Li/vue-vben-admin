import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), register: vi.fn() }));
vi.mock('../../../api', () => ({ fetchOptions: mocks.fetch }));
vi.mock('../../session-resources', () => ({
  registerAdminSessionInitializer: mocks.register,
}));

async function setup() {
  const module = await import('../session-role-options');
  const task = mocks.register.mock.calls.at(-1)?.[1] as {
    clear: () => void;
    load: () => Promise<void>;
  };
  return { ...module, task };
}

beforeEach(() => {
  vi.resetModules();
  mocks.fetch.mockReset();
  mocks.register.mockReset();
});

describe('页面角色目录', () => {
  it('同页按实际启用的租户、领域和组织范围缓存，返回旧范围复用其已完成结果', async () => {
    const { getSessionRoleOptions } = await setup();
    const org = await import('../../global-org-context-state');
    const domain = await import('../../global-domain-context-state');
    org.setGlobalUserOrgContextEnabled(true);
    org.setCurrentGlobalUserOrgRecord({ id: 'tenant-a', kind: 'tenant' });
    mocks.fetch.mockResolvedValue([{ label: '范围角色', value: 'ROLE' }]);
    await getSessionRoleOptions(undefined, '/scoped');
    await getSessionRoleOptions(undefined, '/scoped');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);

    org.setCurrentGlobalUserOrgRecord({ id: 'tenant-b', kind: 'tenant' });
    await getSessionRoleOptions(undefined, '/scoped');
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    org.setCurrentGlobalUserOrgRecord({ id: 'tenant-a', kind: 'tenant' });
    await getSessionRoleOptions(undefined, '/scoped');
    expect(mocks.fetch).toHaveBeenCalledTimes(2);

    domain.setCurrentGlobalDomainIds(['domain-a']);
    await getSessionRoleOptions(undefined, '/scoped');
    domain.setCurrentGlobalDomainIds(['domain-a'], true);
    await getSessionRoleOptions(undefined, '/scoped');
    expect(mocks.fetch).toHaveBeenCalledTimes(4);

    org.setCurrentGlobalUserOrgRecord({
      id: 'org-a',
      kind: 'org',
      tenantId: 'tenant-a',
    });
    await getSessionRoleOptions(undefined, '/scoped');
    org.setCurrentGlobalUserOrgRecord({
      id: 'user-a',
      kind: 'user',
      orgId: 'org-a',
      tenantId: 'tenant-a',
    });
    await getSessionRoleOptions(undefined, '/scoped');
    expect(mocks.fetch).toHaveBeenCalledTimes(6);
  });

  it('组织范围关闭时不把不会发送的租户、组织选择纳入缓存键', async () => {
    const { getSessionRoleOptions } = await setup();
    const org = await import('../../global-org-context-state');
    mocks.fetch.mockResolvedValue([{ label: '角色', value: 'ROLE' }]);
    org.setCurrentGlobalUserOrgRecord({ id: 'tenant-a', kind: 'tenant' });
    await getSessionRoleOptions(undefined, '/disabled');
    org.setCurrentGlobalUserOrgRecord({ id: 'tenant-b', kind: 'tenant' });
    await getSessionRoleOptions(undefined, '/disabled');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('范围切换期间的迟到响应丢弃，不能污染原范围缓存', async () => {
    const { getSessionRoleOptions } = await setup();
    const org = await import('../../global-org-context-state');
    org.setGlobalUserOrgContextEnabled(true);
    org.setCurrentGlobalUserOrgRecord({ id: 'tenant-a', kind: 'tenant' });
    let resolveOld!: (result: unknown[]) => void;
    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const old = getSessionRoleOptions(undefined, '/changing');
    await Promise.resolve();
    org.setCurrentGlobalUserOrgRecord({ id: 'tenant-b', kind: 'tenant' });
    mocks.fetch.mockResolvedValue([{ label: '当前范围', value: 'CURRENT' }]);
    await getSessionRoleOptions(undefined, '/changing');
    org.setCurrentGlobalUserOrgRecord({ id: 'tenant-a', kind: 'tenant' });
    resolveOld([{ label: '迟到范围', value: 'OLD' }]);
    expect(await old).toEqual([]);
    expect(await getSessionRoleOptions(undefined, '/changing')).toEqual([
      { label: '当前范围', value: 'CURRENT' },
    ]);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });

  it('登录初始化不预取角色目录', async () => {
    const { task } = await setup();
    await task.load();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('同页二十次相同请求合并一次，不同页面分别加载', async () => {
    const { getSessionRoleOptions } = await setup();
    mocks.fetch.mockResolvedValue([
      { label: '平台管理员', value: 'ADMIN' },
      { label: '普通用户', value: 'USER' },
    ]);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        getSessionRoleOptions(undefined, '/page-a'),
      ),
    );
    expect(results.every((result) => result.length === 2)).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await getSessionRoleOptions(undefined, '/page-b');
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it('新关键词仍发送服务端查询，同页相同关键词仅请求一次', async () => {
    const { getSessionRoleOptions } = await setup();
    mocks.fetch.mockResolvedValueOnce([
      { label: '前五百项角色', value: 'FIRST' },
    ]);
    await getSessionRoleOptions(undefined, '/page-search');
    mocks.fetch.mockResolvedValueOnce([
      { label: '目录后面的角色', value: 'REMOTE' },
    ]);
    const results = await Promise.all([
      getSessionRoleOptions('  远程角色  ', '/page-search'),
      getSessionRoleOptions('远程角色', '/page-search'),
    ]);
    expect(results[0]).toEqual([{ label: '目录后面的角色', value: 'REMOTE' }]);
    expect(results[1]).toEqual(results[0]);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch.mock.calls[1]?.[3]).toEqual({
      codeForKey: false,
      pageIndex: 1,
      pageSize: 500,
      containsName: '远程角色',
    });
  });

  it('按实际模块地址隔离请求，等价地址共享缓存且空模块保留根路径语义', async () => {
    const { getSessionRoleOptions } = await setup();
    mocks.fetch.mockResolvedValue([{ label: '角色', value: 'ROLE' }]);
    await getSessionRoleOptions(undefined, '/same-page', '/custom/V1/api');
    await getSessionRoleOptions(undefined, '/same-page', ' /custom/V1/api/ ');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0]?.[4]).toBe('/custom/V1/api');
    await getSessionRoleOptions(undefined, '/same-page', '');
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch.mock.calls[1]?.[4]).toBe('');
    await getSessionRoleOptions(undefined, '/same-page');
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(mocks.fetch.mock.calls[2]?.[4]).toBe('/com.levin.oak.base/V1/api');
  });

  it('默认按页面路径缓存，分页筛选参数变化仍复用目录', async () => {
    const { getSessionRoleOptions } = await setup();
    const previous = window.location.href;
    mocks.fetch.mockResolvedValue([{ label: '角色', value: 'ROLE' }]);
    try {
      window.history.replaceState(null, '', '/role-page?pageIndex=1');
      await getSessionRoleOptions();
      window.history.replaceState(null, '', '/role-page?pageIndex=2&name=test');
      await getSessionRoleOptions();
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState(null, '', previous);
    }
  });

  it.each([false, true])(
    '空目录或失败在同页保留结果，不反复请求：%s',
    async (failure) => {
      const { getSessionRoleOptions } = await setup();
      if (failure) mocks.fetch.mockRejectedValue(new Error('unavailable'));
      else mocks.fetch.mockResolvedValue([]);
      expect(await getSessionRoleOptions(undefined, '/empty')).toEqual([]);
      expect(await getSessionRoleOptions(undefined, '/empty')).toEqual([]);
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('换号清空同页缓存，旧请求迟到不能回填或向旧调用者暴露结果', async () => {
    const { getSessionRoleOptions, task } = await setup();
    let resolveOld!: (result: unknown[]) => void;
    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const old = getSessionRoleOptions(undefined, '/same-page');
    await Promise.resolve();
    task.clear();
    mocks.fetch.mockResolvedValueOnce([{ label: '新账号', value: 'NEW' }]);
    expect(await getSessionRoleOptions(undefined, '/same-page')).toEqual([
      { label: '新账号', value: 'NEW' },
    ]);
    resolveOld([{ label: '旧账号', value: 'OLD' }]);
    expect(await old).toEqual([]);
    expect(await getSessionRoleOptions(undefined, '/same-page')).toEqual([
      { label: '新账号', value: 'NEW' },
    ]);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
