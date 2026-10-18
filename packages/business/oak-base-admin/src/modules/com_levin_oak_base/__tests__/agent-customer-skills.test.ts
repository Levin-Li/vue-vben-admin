import { beforeEach, describe, expect, it, vi } from 'vitest';

import { customerAgentSkills } from '../agent-customer-skills';

const state = vi.hoisted(() => {
  const service = () => ({ list: vi.fn(), retrieve: vi.fn(), update: vi.fn() });
  return {
    customer: service(),
    partner: service(),
    supplierPartner: service(),
    channelPartner: service(),
    legalSubject: service(),
    org: service(),
    tenant: { value: undefined as string | undefined },
    selectedOrg: { value: undefined as string | undefined },
    user: { tenantId: 'tenant', platformUser: true },
    permitted: true,
  };
});
vi.mock('@levin/admin-framework', () => ({
  currentGlobalTenantId: state.tenant,
  currentGlobalOrgId: state.selectedOrg,
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
vi.mock('@levin/admin-framework/framework-commons/api-authorize', () => ({
  hasResAuthorizeMeta: () => true,
  getResAuthorizeMeta: () => ({}),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: object, method: string) => [method],
  }),
);
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => state.permitted }),
}));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({ accessToken: 'session' }),
  useUserStore: () => ({ userInfo: state.user }),
}));
vi.mock('../api/customer-service', () => ({ customerService: state.customer }));
vi.mock('../api/partner-service', () => ({ partnerService: state.partner }));
vi.mock('../api/supplier-partner-service', () => ({
  supplierPartnerService: state.supplierPartner,
}));
vi.mock('../api/channel-partner-service', () => ({
  channelPartnerService: state.channelPartner,
}));
vi.mock('../api/legal-subject-service', () => ({
  legalSubjectService: state.legalSubject,
}));
vi.mock('../api/org-service', () => ({ orgService: state.org }));

const domains = [
  'customer',
  'partner',
  'supplierPartner',
  'channelPartner',
  'legalSubject',
  'org',
] as const;
const writable = ['customer', 'supplierPartner', 'channelPartner'] as const;
const row = {
  id: 'one',
  tenantId: 'tenant',
  orgId: 'org',
  optimisticLock: 3,
  level: 'A',
  groupName: '普通',
  enable: true,
};
function skill(resource: string, action: string) {
  const found = customerAgentSkills.find(
    (entry) => entry.id === `com.levin.oak.base.${resource}.${action}`,
  );
  if (!found) throw new Error('未找到技能');
  const execute = found.execute;
  const preview = found.preview;
  return {
    ...found,
    execute: (...args: Parameters<NonNullable<typeof execute>>) => {
      if (!execute) throw new Error('缺少查询');
      return execute(...args);
    },
    preview: (...args: Parameters<NonNullable<typeof preview>>) => {
      if (!preview) throw new Error('缺少预览');
      return preview(...args);
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  state.permitted = true;
  state.user = { tenantId: 'tenant', platformUser: true };
  state.tenant.value = undefined;
  state.selectedOrg.value = undefined;
});

describe('客户、合作伙伴与组织 Agent 技能', () => {
  it.each(domains)('%s 显式绑定列表和详情并过滤敏感资料', async (resource) => {
    const data = {
      ...row,
      contactEmail: 'private@example.com',
      bankAccount: { account: 'secret' },
      unifiedCreditNo: 'secret',
      exInfo: 'secret',
    };
    state[resource].list.mockResolvedValue({ items: [data], totals: 1 });
    state[resource].retrieve.mockResolvedValue(data);
    const listed = await skill(resource, 'list').execute({ limit: 5 }, false);
    const retrieved = await skill(resource, 'retrieve').execute(
      { id: 'one' },
      false,
    );
    expect(state[resource].list).toHaveBeenCalledWith({
      pageIndex: 1,
      pageSize: 5,
    });
    expect(state[resource].retrieve).toHaveBeenCalledWith({ id: 'one' });
    expect(JSON.stringify([listed, retrieved])).not.toMatch(
      /private@example|bankAccount|unifiedCreditNo|exInfo|secret/,
    );
  });
  it('基类合作伙伴不开放不存在的普通更新接口', () => {
    expect(
      customerAgentSkills.filter((entry) => entry.id.endsWith('updateProfile')),
    ).toHaveLength(3);
    expect(
      customerAgentSkills.some((entry) =>
        entry.id.endsWith('.partner.updateProfile'),
      ),
    ).toBe(false);
  });
  it.each(writable)('%s 预览后按版本更新指定字段并核验', async (resource) => {
    state[resource].retrieve
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, level: 'B', optimisticLock: 4 });
    const pending = await skill(resource, 'updateProfile').preview({
      id: 'one',
      level: 'B',
    });
    expect(state[resource].update).not.toHaveBeenCalled();
    await expect(pending.execute()).resolves.toContain('已执行并核验');
    expect(state[resource].update).toHaveBeenCalledWith({
      id: 'one',
      tenantId: 'tenant',
      orgId: 'org',
      optimisticLock: 3,
      level: 'B',
    });
  });
  it('拒绝归属和身份修改、空补丁、无效类型', async () => {
    for (const args of [
      { id: 'one', ownerId: 'other' },
      { id: 'one', legalSubjectId: 'other' },
      { id: 'one' },
      { id: 'one', enable: 'false' },
    ])
      await expect(
        skill('customer', 'updateProfile').preview(args),
      ).rejects.toThrow();
    expect(state.customer.retrieve).not.toHaveBeenCalled();
  });
  it('版本变化、权限撤销和范围切换阻止写入及复查', async () => {
    state.customer.retrieve
      .mockResolvedValueOnce(row)
      .mockResolvedValue({ ...row, optimisticLock: 4 });
    const pending = await skill('customer', 'updateProfile').preview({
      id: 'one',
      groupName: '重点',
    });
    await expect(pending.execute()).rejects.toThrow('已变化');
    state.permitted = false;
    await expect(pending.recheck()).rejects.toThrow('权限');
    state.permitted = true;
    state.user = { tenantId: 'tenant', platformUser: true };
    state.tenant.value = 'other';
    await expect(pending.execute()).rejects.toThrow('范围');
    expect(state.customer.update).not.toHaveBeenCalled();
  });
  it('租户用户响应 tenantId 被屏蔽时仍按可信登录租户核验且写请求省略租户', async () => {
    state.user.platformUser = false;
    state.tenant.value = 'tenant';
    const masked = { ...row, tenantId: null };
    state.customer.retrieve
      .mockResolvedValueOnce(masked)
      .mockResolvedValueOnce(masked)
      .mockResolvedValueOnce({ ...masked, level: 'B' });
    const pending = await skill('customer', 'updateProfile').preview({
      id: 'one',
      level: 'B',
    });
    await expect(pending.execute()).resolves.toContain('已执行并核验');
    expect(
      state.customer.retrieve.mock.calls.every(
        ([args]) => !Object.hasOwn(args, 'tenantId'),
      ),
    ).toBe(true);
    expect(state.customer.update).toHaveBeenCalledWith({
      id: 'one',
      orgId: 'org',
      optimisticLock: 3,
      level: 'B',
    });
  });
  it('提交结果不确定时禁止重发，只读复查能确认已生效', async () => {
    state.customer.retrieve
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, enable: false });
    state.customer.update.mockRejectedValueOnce(new Error('断网'));
    const pending = await skill('customer', 'updateProfile').preview({
      id: 'one',
      enable: false,
    });
    await expect(pending.execute()).rejects.toThrow('断网');
    await expect(pending.execute()).rejects.toThrow('不可重复');
    await expect(pending.recheck()).resolves.toBe(true);
    expect(state.customer.update).toHaveBeenCalledTimes(1);
  });
});
