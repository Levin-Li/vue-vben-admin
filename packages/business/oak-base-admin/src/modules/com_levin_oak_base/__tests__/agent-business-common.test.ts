import { ResAuthorize } from '@levin/admin-framework/framework-commons/api-authorize';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  agentPermission,
  agentReadSkills,
  projectAgentRecord,
} from '../agent-business-common';

const state = vi.hoisted(() => ({
  tenant: { value: undefined as string | undefined },
  org: { value: undefined as string | undefined },
  user: { tenantId: 'tenant', platformUser: true },
  token: 'session',
  permitted: true,
}));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({ accessToken: state.token }),
  useUserStore: () => ({ userInfo: state.user }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => state.permitted }),
}));
vi.mock('@levin/admin-framework', () => ({
  currentGlobalTenantId: state.tenant,
  currentGlobalOrgId: state.org,
  agentExactKeys: (args: Record<string, unknown>, keys: string[]) => {
    if (Object.keys(args).some((key) => !keys.includes(key)))
      throw new Error('未登记');
  },
  agentId: (value: unknown) => {
    if (typeof value !== 'string' || !/^[\w.-]{1,128}$/.test(value))
      throw new Error('ID');
    return value;
  },
  agentLimit: (value: unknown, max: number) => {
    const limit = value === undefined ? Math.min(20, max) : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > max)
      throw new Error('分页');
    return limit;
  },
}));

function readSkills(options: Parameters<typeof agentReadSkills>[0]) {
  const values = agentReadSkills(options).map((skill) => {
    if (!skill.execute) throw new Error('缺少执行器');
    return { ...skill, execute: skill.execute };
  });
  const first = values[0];
  const second = values[1];
  if (!first || !second) throw new Error('缺少查询技能');
  return [first, second] as const;
}
// 真实注解区分缺失授权与仅需登录接口。
function authorizedService(authOnly = false) {
  const service = { list: vi.fn(), retrieve: vi.fn() };
  for (const method of ['list', 'retrieve'] as const)
    ResAuthorize(
      authOnly
        ? { onlyRequireAuthenticated: true }
        : { domain: 'test', type: '业务', action: method },
    )(service, method, Object.getOwnPropertyDescriptor(service, method) ?? {});
  return service;
}
beforeEach(() => {
  state.tenant.value = undefined;
  state.org.value = undefined;
  state.token = 'session';
  state.permitted = true;
  state.user = { tenantId: 'tenant', platformUser: true };
});

describe('业务 Agent 固定查询边界', () => {
  it('真实授权元数据区分权限、登录过期与未声明授权', () => {
    const authenticated = authorizedService(true);
    expect(agentPermission(authenticated, 'list')).toBe(true);
    state.token = '';
    expect(agentPermission(authenticated, 'list')).toBe(false);
    expect(agentPermission({ list: vi.fn() }, 'list')).toBe(false);
    state.permitted = false;
    expect(agentPermission(authorizedService(), 'list')).toBe(false);
  });
  it('分页、选定范围、固定过滤与服务绑定正确', async () => {
    const service = authorizedService();
    service.list.mockResolvedValue({
      items: [{ id: 'one', secret: 'hidden' }],
      totals: 55,
    });
    state.tenant.value = 'tenant';
    state.org.value = 'org';
    const skill = readSkills({
      resource: 'test',
      title: '测试',
      service,
      fields: ['id'],
      filters: { enable: { kind: 'boolean' } },
    })[0];
    const result = await skill.execute(
      { limit: 10, pageIndex: 2, enable: false },
      false,
    );
    expect(service.list).toHaveBeenCalledWith({
      tenantId: 'tenant',
      orgId: 'org',
      pageIndex: 2,
      pageSize: 10,
      enable: false,
    });
    expect(service.list.mock.contexts[0]).toBe(service);
    expect(result).toMatchObject({
      count: 1,
      data: { items: [{ id: 'one' }], hasMore: true, total: 55 },
    });
  });
  it.each([
    { limit: 21 },
    { pageIndex: 6 },
    { select: 'secret' },
    { code: 'x;sql' },
    { enable: 'false' },
    { time: 'bad' },
  ])('非法条件在请求前拒绝 %o', async (args) => {
    const service = authorizedService();
    const skill = readSkills({
      resource: 'test',
      title: '测试',
      service,
      fields: ['id'],
      filters: {
        code: { kind: 'code' },
        enable: { kind: 'boolean' },
        time: { kind: 'time' },
      },
    })[0];
    await expect(skill.execute(args, false)).rejects.toThrow();
    expect(service.list).not.toHaveBeenCalled();
  });
  it('范围冲突和执行前权限撤销均拒绝', async () => {
    const service = authorizedService();
    const skill = readSkills({
      resource: 'test',
      title: '测试',
      service,
      fields: ['id'],
    })[0];
    state.tenant.value = 'selected';
    await expect(skill.execute({ tenantId: 'other' }, false)).rejects.toThrow(
      '范围',
    );
    state.permitted = false;
    await expect(skill.execute({}, false)).rejects.toThrow('无权');
    expect(service.list).not.toHaveBeenCalled();
  });
  it('无效列表响应报告错误，空详情明确返回零条', async () => {
    const service = authorizedService();
    service.list.mockResolvedValue({ error: true });
    service.retrieve.mockResolvedValue(null);
    const [list, retrieve] = readSkills({
      resource: 'test',
      title: '测试',
      service,
      fields: ['id'],
    });
    await expect(list.execute({}, false)).rejects.toThrow('格式');
    await expect(retrieve.execute({ id: 'one' }, false)).resolves.toMatchObject(
      { count: 0, data: null },
    );
  });
  it('租户用户通用查询不提交受保护 tenantId，显式异租户拒绝', async () => {
    state.user.platformUser = false;
    state.tenant.value = 'tenant';
    const service = authorizedService();
    service.list.mockResolvedValue({ items: [], totals: 0 });
    const [list] = readSkills({
      resource: 'test',
      title: '测试',
      service,
      fields: ['id'],
    });
    await list.execute({}, false);
    expect(service.list).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 20 });
    state.tenant.value = undefined;
    await expect(list.execute({ tenantId: 'other' }, false)).rejects.toThrow(
      '当前登录',
    );
  });
  it('投影限制长文本、数组和嵌套对象', () => {
    expect(
      projectAgentRecord(
        {
          id: 'one',
          text: 'x'.repeat(300),
          nested: { secret: true },
          values: Array.from({ length: 15 }, () => 'y'.repeat(200)),
          secret: 'private',
          invalid: Number.NaN,
        },
        ['id', 'text', 'nested', 'values', 'invalid'],
      ),
    ).toEqual({
      id: 'one',
      text: 'x'.repeat(160),
      values: Array.from({ length: 10 }, () => 'y'.repeat(160)),
    });
  });
});
