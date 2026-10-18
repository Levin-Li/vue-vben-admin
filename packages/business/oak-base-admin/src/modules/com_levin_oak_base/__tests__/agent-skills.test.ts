import { beforeEach, describe, expect, it, vi } from 'vitest';

import { oakBaseAgentSkills } from '../agent-skills';

const mocks = vi.hoisted(() => ({
  selectedOrg: { value: undefined as string | undefined },
  selectedTenant: { value: undefined as string | undefined },
  retrieve: vi.fn(),
  setEnabled: vi.fn(),
  list: vi.fn(),
  ticketList: vi.fn(),
  ticketRetrieve: vi.fn(),
  get: vi.fn(),
  permissions: new Set<string>(),
}));

vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({
    hasPermission: (permission: string[]) =>
      permission.some((item) => mocks.permissions.has(item)),
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);

vi.mock('@levin/admin-framework', () => ({
  currentGlobalOrgId: mocks.selectedOrg,
  currentGlobalTenantId: mocks.selectedTenant,
  agentExactKeys: (value: Record<string, unknown>, allowed: string[]) => {
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      throw new Error('未登记字段');
  },
  agentId: (value: unknown) => {
    if (typeof value !== 'string' || !value) throw new Error('ID 格式');
    return value;
  },
  agentLimit: (value: unknown, max: number) => {
    if (!Number.isInteger(value) || Number(value) > max)
      throw new Error('条数');
    return Number(value);
  },
}));
vi.mock('../api/ticket-queue-service', () => ({
  ticketQueueService: {
    list: mocks.list,
    retrieve: mocks.retrieve,
    setEnabled: mocks.setEnabled,
  },
}));
vi.mock('../api/ticket-service', () => ({
  ticketService: {
    list: mocks.ticketList,
    retrieve: mocks.ticketRetrieve,
  },
}));
vi.mock('../api/_module', () => ({ oakBaseGet: mocks.get }));

beforeEach(() => {
  mocks.selectedOrg.value = undefined;
  mocks.selectedTenant.value = undefined;
  mocks.retrieve.mockReset();
  mocks.setEnabled.mockReset();
  mocks.list.mockReset();
  mocks.ticketList.mockReset();
  mocks.ticketRetrieve.mockReset();
  mocks.get.mockReset();
  mocks.permissions.clear();
});

describe('基础模块 Agent 技能', () => {
  it('异常列表响应不能作为零条业务事实返回', async () => {
    mocks.ticketList.mockResolvedValue({ message: 'unexpected' });
    mocks.list.mockResolvedValue({ items: null });
    const ticket = oakBaseAgentSkills.find((skill) =>
      skill.id.endsWith('ticket.list'),
    );
    const queue = oakBaseAgentSkills.find((skill) =>
      skill.id.endsWith('ticketQueue.list'),
    );
    if (!ticket?.execute || !queue?.execute) throw new Error('缺少查询技能');
    await expect(ticket.execute({ limit: 10 }, false)).rejects.toThrow(
      '返回格式',
    );
    await expect(
      queue.execute({ tenantId: 't1', orgId: 'o1', limit: 10 }, false),
    ).rejects.toThrow('返回格式');
  });

  it('队列启停范围与当前选择不一致时不读取或修改目标', async () => {
    mocks.selectedTenant.value = 'selected-tenant';
    mocks.selectedOrg.value = 'selected-org';
    const skill = oakBaseAgentSkills.find((entry) =>
      entry.id.endsWith('ticketQueue.setEnabled'),
    );
    if (!skill?.preview) throw new Error('缺少队列预览技能');
    await expect(
      skill.preview({
        id: 'q1',
        tenantId: 'another-tenant',
        orgId: 'selected-org',
        enabled: true,
      }),
    ).rejects.toThrow('范围');
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.setEnabled).not.toHaveBeenCalled();
  });

  it('工单分析按当前用户接口分页且不向模型发送联系人或正文', async () => {
    const listSkill = oakBaseAgentSkills.find((item) =>
      item.id.endsWith('ticket.list'),
    );
    const detailSkill = oakBaseAgentSkills.find((item) =>
      item.id.endsWith('ticket.retrieve'),
    );
    if (!listSkill?.execute || !detailSkill?.execute) {
      throw new Error('缺少工单分析技能');
    }
    const ticket = {
      id: 'ticket-1',
      tenantId: 'tenant-a',
      orgId: 'org-a',
      status: 'Open',
      priority: 'High',
      queueId: 'queue-1',
      assigneeId: 'user-1',
      requesterEmail: 'private@example.com',
      supportEmail: 'private-support@example.com',
      title: '私人主题',
      message: '敏感正文',
    };
    mocks.ticketList.mockResolvedValueOnce({ items: [ticket], totals: 1 });
    mocks.ticketRetrieve.mockResolvedValueOnce(ticket);

    const listed = await listSkill.execute({ limit: 5, pageIndex: 1 }, false);
    const retrieved = await detailSkill.execute({ id: 'ticket-1' }, false);
    expect(mocks.ticketList).toHaveBeenCalledWith({
      tenantId: undefined,
      orgId: undefined,
      queueId: undefined,
      status: undefined,
      pageIndex: 1,
      pageSize: 5,
    });
    expect(mocks.ticketRetrieve).toHaveBeenCalledWith({
      id: 'ticket-1',
      tenantId: undefined,
      orgId: undefined,
    });
    expect(JSON.stringify([listed.data, retrieved.data])).not.toMatch(
      /private@example.com|private-support@example.com|敏感正文|私人主题/,
    );
    expect(listed.count).toBe(1);
    expect(retrieved.count).toBe(1);
  });

  it('无效工单状态在调用 API 前拒绝', async () => {
    const skill = oakBaseAgentSkills.find((item) =>
      item.id.endsWith('ticket.list'),
    );
    if (!skill?.execute) throw new Error('缺少工单查询技能');
    await expect(skill.execute({ status: 'Open;DROP' }, false)).rejects.toThrow(
      '工单状态格式',
    );
    expect(mocks.ticketList).not.toHaveBeenCalled();
  });

  it('仅将当前用户有权限的工单技能加入目录', () => {
    const queueSkills = oakBaseAgentSkills.filter((item) =>
      item.id.includes('ticketQueue.'),
    );
    expect(queueSkills.map((item) => item.available?.())).toEqual([
      false,
      false,
      false,
    ]);
    mocks.permissions.add('list');
    mocks.permissions.add('retrieve');
    expect(queueSkills.map((item) => item.available?.())).toEqual([
      true,
      true,
      false,
    ]);
    mocks.permissions.add('setEnabled');
    expect(queueSkills.map((item) => item.available?.())).toEqual([
      true,
      true,
      true,
    ]);
  });
  it('无需先点击组织选择器，使用明确范围经当前用户接口预览、执行和核验', async () => {
    const skill = oakBaseAgentSkills.find((item) =>
      item.id.endsWith('ticketQueue.setEnabled'),
    );
    if (!skill?.preview) throw new Error('缺少队列启停技能');
    const queue = {
      id: 'q1',
      tenantId: 't1',
      orgId: 'o1',
      name: '主队列',
      enabled: true,
      optimisticLock: 2,
    };
    mocks.retrieve
      .mockResolvedValueOnce(queue)
      .mockResolvedValueOnce(queue)
      .mockResolvedValueOnce({ ...queue, enabled: false, optimisticLock: 3 });
    const pending = await skill.preview({
      id: 'q1',
      enabled: false,
      tenantId: 't1',
      orgId: 'o1',
    });
    expect(mocks.setEnabled).not.toHaveBeenCalled();
    await expect(pending.execute()).resolves.toContain('已执行并核验');
    expect(mocks.setEnabled).toHaveBeenCalledWith({
      tenantId: 't1',
      orgId: 'o1',
      id: 'q1',
      optimisticLock: 2,
      enabled: false,
    });
  });

  it('访问日志诊断窗口超过 24 小时不调用后端', async () => {
    const skill = oakBaseAgentSkills.find((item) =>
      item.id.endsWith('accessLog.diagnose'),
    );
    if (!skill?.execute) throw new Error('缺少访问日志诊断技能');
    await expect(
      skill.execute(
        {
          from: '2026-10-01T00:00:00',
          to: '2026-10-03T00:00:00',
        },
        true,
      ),
    ).rejects.toThrow('24 小时');
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('固定来源 ERROR 日志只通过受限查询接口取证据', async () => {
    const skill = oakBaseAgentSkills.find((item) =>
      item.id.endsWith('errorFiles.diagnose'),
    );
    if (!skill?.execute) throw new Error('缺少 ERROR 日志诊断技能');
    mocks.get.mockResolvedValueOnce({
      items: [{ exceptionType: 'IllegalStateException', fingerprint: 'abc' }],
      truncated: false,
    });
    const result = await skill.execute(
      {
        from: '2026-10-18T08:00:00',
        to: '2026-10-18T09:00:00',
        limit: 10,
      },
      true,
    );
    expect(result.count).toBe(1);
    expect(mocks.get).toHaveBeenCalledWith('/AccessLogDiagnostics/errorFiles', {
      params: {
        from: '2026-10-18T08:00:00',
        to: '2026-10-18T09:00:00',
        limit: 10,
      },
    });
  });

  it('相同异常指纹在送往模型前归并并保留出现次数', async () => {
    const skill = oakBaseAgentSkills.find((item) =>
      item.id.endsWith('errorFiles.diagnose'),
    );
    if (!skill?.execute) throw new Error('缺少 ERROR 日志诊断技能');

    // 三条脱敏证据中有两条同源，模型应看到两组及准确的重复次数。
    mocks.get.mockResolvedValueOnce({
      items: [
        {
          fingerprint: 'same',
          time: '2026-10-18T08:01:00',
          exceptionType: 'IllegalStateException',
        },
        {
          fingerprint: 'other',
          time: '2026-10-18T08:02:00',
          exceptionType: 'TimeoutException',
        },
        {
          fingerprint: 'same',
          time: '2026-10-18T08:03:00',
          exceptionType: 'IllegalStateException',
        },
      ],
      truncated: false,
    });

    const result = await skill.execute(
      { from: '2026-10-18T08:00:00', to: '2026-10-18T09:00:00', limit: 10 },
      true,
    );
    const data = result.data as {
      groups: Array<{ count: number; firstSeen: string; lastSeen: string }>;
    };
    expect(result.count).toBe(3);
    expect(data.groups).toHaveLength(2);
    expect(data.groups[0]).toMatchObject({
      count: 2,
      firstSeen: '2026-10-18T08:01:00',
      lastSeen: '2026-10-18T08:03:00',
    });
  });
});
