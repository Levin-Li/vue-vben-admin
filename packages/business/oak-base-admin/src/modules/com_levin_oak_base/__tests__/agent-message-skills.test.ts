import { beforeEach, describe, expect, it, vi } from 'vitest';

import { messageAgentSkills } from '../agent-message-skills';

const mocks = vi.hoisted(() => ({
  messages: { list: vi.fn(), retrieve: vi.fn(), unreadCount: vi.fn() },
  audit: { list: vi.fn(), retrieve: vi.fn() },
  mailbox: {
    list: vi.fn(),
    retrieve: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  },
  tenant: { value: undefined as string | undefined },
  org: { value: undefined as string | undefined },
  access: { accessToken: 'session' },
  actor: { userInfo: { id: 'u1', platformUser: true, tenantId: 't1' } },
  allowed: true,
}));
vi.mock('@levin/admin-framework', () => ({
  currentGlobalTenantId: mocks.tenant,
  currentGlobalOrgId: mocks.org,
  agentExactKeys: (args: Record<string, unknown>, keys: string[]) => {
    if (Object.keys(args).some((key) => !keys.includes(key)))
      throw new Error('未登记字段');
  },
  agentId: (value: unknown) => {
    if (typeof value !== 'string' || !/^[\w.-]{1,128}$/.test(value))
      throw new Error('ID格式错误');
    return value;
  },
  agentLimit: (value: unknown, maximum: number) => {
    const size = value ?? 20;
    if (!Number.isInteger(size) || Number(size) < 1 || Number(size) > maximum)
      throw new Error('分页越界');
    return Number(size);
  },
}));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => mocks.access,
  useUserStore: () => mocks.actor,
}));
vi.mock('@levin/admin-framework/framework-commons/api-authorize', () => ({
  hasResAuthorizeMeta: () => true,
  getResAuthorizeMeta: (method: unknown) => ({
    onlyRequireAuthenticated: Object.values(mocks.messages).includes(
      method as any,
    ),
  }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => mocks.allowed }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('../api/user-message-service', () => ({
  userMessageService: mocks.messages,
}));
vi.mock('../api/notification-audit-service', () => ({
  notificationAuditService: mocks.audit,
}));
vi.mock('../api/support-mailbox-setting-service', () => ({
  supportMailboxSettingService: mocks.mailbox,
}));

function skill(suffix: string) {
  const found = messageAgentSkills.find((entry) => entry.id.endsWith(suffix));
  if (!found) throw new Error('缺少技能');
  return found;
}
async function run(suffix: string, args: Record<string, unknown> = {}) {
  const execute = skill(suffix).execute;
  if (!execute) throw new Error('不是查询技能');
  return execute(args, false);
}
async function preview(enabled = true) {
  const handler = skill('supportMailboxSetting.setEnabled').preview;
  if (!handler) throw new Error('不是写入技能');
  return handler({ id: 'm1', tenantId: 't1', orgId: 'o1', enabled });
}
const record = {
  id: 'm1',
  tenantId: 't1',
  orgId: 'o1',
  optimisticLock: 2,
  enabled: false,
  status: 'Failed',
  attemptCount: 1,
  priority: 'High',
  readTime: null,
  email: '私密邮箱',
  outboundConfigRef: '私密凭证',
  summary: '私密摘要',
  title: '私密主题',
  actionTarget: { url: '私密链接' },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.allowed = true;
  mocks.actor.userInfo.platformUser = true;
  mocks.actor.userInfo.id = 'u1';
  mocks.actor.userInfo.tenantId = 't1';
  mocks.access.accessToken = 'session';
  mocks.tenant.value = undefined;
  mocks.org.value = undefined;
});

describe('消息与支持邮箱 Agent 技能', () => {
  it('个人消息使用字符串详情参数且默认全部，只要求当前认证', async () => {
    mocks.allowed = false;
    mocks.messages.list.mockResolvedValue({ items: [record], totals: 1 });
    mocks.messages.retrieve.mockResolvedValue(record);
    mocks.messages.unreadCount.mockResolvedValue(4);
    expect(skill('userMessage.list').available?.()).toBe(true);
    const listed = await run('userMessage.list', { limit: 3 });
    const detail = await run('userMessage.retrieve', { id: 'm1' });
    expect(mocks.messages.list).toHaveBeenCalledWith({
      pageSize: 3,
      pageIndex: 1,
      unreadOnly: false,
    });
    expect(mocks.messages.retrieve).toHaveBeenCalledWith('m1');
    expect(JSON.stringify([listed, detail])).not.toContain('私密');
    await expect(run('userMessage.unreadCount')).resolves.toMatchObject({
      data: { unreadCount: 4 },
    });
    await expect(run('userMessage.list', { tenantId: 't2' })).rejects.toThrow(
      '未登记',
    );
    mocks.access.accessToken = '';
    expect(skill('userMessage.unreadCount').available?.()).toBe(false);
    await expect(run('userMessage.unreadCount')).rejects.toThrow('权限');
  });
  it.each([
    ['notificationAudit.list', 'audit', 'list'],
    ['supportMailboxSetting.list', 'mailbox', 'list'],
    ['supportMailboxSetting.retrieve', 'mailbox', 'retrieve'],
  ] as const)('%s 使用固定方法和显式摘要', async (suffix, resource, action) => {
    mocks[resource][action].mockResolvedValue(
      action === 'list' ? { items: [record], totals: 1 } : record,
    );
    const result = await run(
      suffix,
      action === 'list'
        ? { tenantId: 't1', orgId: 'o1', limit: 2 }
        : { id: 'm1', tenantId: 't1', orgId: 'o1' },
    );
    expect(result.count).toBe(1);
    expect(JSON.stringify(result.data)).not.toContain('私密');
    expect(mocks[resource][action]).toHaveBeenCalledWith(
      action === 'list'
        ? { tenantId: 't1', orgId: 'o1', pageIndex: 1, pageSize: 2 }
        : { id: 'm1', tenantId: 't1', orgId: 'o1' },
    );
  });
  it('通知详情保留有界投递尝试结果，排除理由和核验引用', async () => {
    mocks.audit.retrieve.mockResolvedValue({
      delivery: record,
      attempts: Array.from({ length: 25 }, (_, index) => ({
        attemptNo: index + 1,
        outcome: 'Failed',
        reason: '私密原因',
      })),
      reviews: [{ reason: '私密原因', verificationRef: '私密引用' }],
    });
    const result = await run('notificationAudit.retrieve', {
      id: 'n1',
      tenantId: 't1',
    });
    expect(mocks.audit.retrieve).toHaveBeenCalledWith({
      id: 'n1',
      tenantId: 't1',
    });
    expect(result.count).toBe(20);
    expect(result.data).toMatchObject({
      attemptsTruncated: true,
      delivery: { status: 'Failed' },
    });
    expect(JSON.stringify(result.data)).not.toContain('私密');
  });
  it.each([true, false])(
    '预览无写入，确认通过原方法只执行一次并核验：%s',
    async (enabled) => {
      const original = { ...record, enabled: !enabled };
      const verified = { ...original, enabled, optimisticLock: 3 };
      mocks.mailbox.retrieve
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(original)
        .mockResolvedValue(verified);
      const pending = await preview(enabled);
      expect(mocks.mailbox.enable).not.toHaveBeenCalled();
      expect(mocks.mailbox.disable).not.toHaveBeenCalled();
      await expect(pending.execute()).resolves.toContain('已执行并核验');
      const writer = enabled ? mocks.mailbox.enable : mocks.mailbox.disable;
      expect(writer).toHaveBeenCalledExactlyOnceWith({
        id: 'm1',
        tenantId: 't1',
        orgId: 'o1',
        optimisticLock: 2,
        orgIdList: ['o1'],
      });
      await expect(pending.execute()).rejects.toThrow('已提交');
      await expect(pending.recheck()).resolves.toBe(true);
      expect(writer).toHaveBeenCalledTimes(1);
    },
  );
  it('版本变化和权限撤销均在写入前拒绝', async () => {
    mocks.mailbox.retrieve
      .mockResolvedValueOnce(record)
      .mockResolvedValue({ ...record, optimisticLock: 3 });
    const pending = await preview();
    await expect(pending.execute()).rejects.toThrow('已变化');
    expect(mocks.mailbox.enable).not.toHaveBeenCalled();
    mocks.mailbox.retrieve.mockResolvedValue(record);
    const revoked = await preview();
    mocks.allowed = false;
    await expect(revoked.execute()).rejects.toThrow('权限');
    await expect(revoked.recheck()).rejects.toThrow('权限');
  });
  it('选择范围变化或目标范围不符时不写入', async () => {
    mocks.tenant.value = 't1';
    mocks.org.value = 'o1';
    mocks.mailbox.retrieve.mockResolvedValue(record);
    const pending = await preview();
    mocks.org.value = 'o2';
    await expect(pending.execute()).rejects.toThrow('范围');
    mocks.org.value = 'o1';
    mocks.mailbox.retrieve.mockResolvedValue({ ...record, orgId: 'o2' });
    await expect(preview()).rejects.toThrow('范围');
    expect(mocks.mailbox.enable).not.toHaveBeenCalled();
  });
  it('已有目标状态不重复写，失败结果只能只读复查', async () => {
    mocks.mailbox.retrieve.mockResolvedValue(record);
    const unchanged = await preview(false);
    await expect(unchanged.execute()).resolves.toContain('无需重复');
    expect(mocks.mailbox.disable).not.toHaveBeenCalled();
    mocks.mailbox.enable.mockRejectedValue(new Error('网络结果未知'));
    const uncertain = await preview();
    await expect(uncertain.execute()).rejects.toThrow('未知');
    await expect(uncertain.execute()).rejects.toThrow('已提交');
    await expect(uncertain.recheck()).resolves.toBe(false);
    expect(mocks.mailbox.enable).toHaveBeenCalledTimes(1);
  });
  it('普通租户启停使用服务端注入租户，保留明确组织范围', async () => {
    mocks.actor.userInfo.platformUser = false;
    const masked = { ...record, tenantId: null };
    mocks.mailbox.retrieve
      .mockResolvedValueOnce(masked)
      .mockResolvedValueOnce(masked)
      .mockResolvedValue({ ...masked, enabled: true, optimisticLock: 3 });
    const pending = await preview();
    await pending.execute();
    expect(mocks.mailbox.enable).toHaveBeenCalledWith({
      id: 'm1',
      orgId: 'o1',
      orgIdList: ['o1'],
      optimisticLock: 2,
    });
    expect(mocks.mailbox.enable.mock.calls[0]?.[0]).not.toHaveProperty(
      'tenantId',
    );
  });
  it('脱敏租户不能覆盖真实租户或在身份切换后执行', async () => {
    mocks.actor.userInfo.platformUser = false;
    mocks.mailbox.retrieve.mockResolvedValue({ ...record, tenantId: null });
    const pending = await preview();
    mocks.actor.userInfo.id = 'other-user';
    await expect(pending.execute()).rejects.toThrow('身份');
    await expect(pending.recheck()).rejects.toThrow('身份');
    expect(mocks.mailbox.enable).not.toHaveBeenCalled();
    mocks.actor.userInfo.id = 'u1';
    mocks.mailbox.retrieve.mockResolvedValue({
      ...record,
      tenantId: 'other-tenant',
    });
    await expect(preview()).rejects.toThrow('范围');
    mocks.actor.userInfo.platformUser = true;
    mocks.mailbox.retrieve.mockResolvedValue({ ...record, tenantId: null });
    await expect(preview()).rejects.toThrow('范围');
  });
  it('目录不开放已读、通知重试或发送', () => {
    expect(
      messageAgentSkills
        .filter((entry) => entry.risk === 'confirm')
        .map((entry) => entry.id),
    ).toEqual(['com.levin.oak.base.supportMailboxSetting.setEnabled']);
    expect(messageAgentSkills.map((entry) => entry.id).join(',')).not.toMatch(
      /markRead|\.send|\.retry/,
    );
  });
});
