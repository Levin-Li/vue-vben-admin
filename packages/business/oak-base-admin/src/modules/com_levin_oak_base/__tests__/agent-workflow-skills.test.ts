import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workflowAgentSkills } from '../agent-workflow-skills';

const mocks = vi.hoisted(() => ({
  request: { list: vi.fn(), retrieve: vi.fn() },
  definition: { list: vi.fn() },
  expense: { retrieve: vi.fn() },
  runtime: {
    todo: vi.fn(),
    done: vi.fn(),
    started: vi.fn(),
    copied: vi.fn(),
    task: vi.fn(),
    instance: vi.fn(),
  },
  management: { instances: vi.fn(), instance: vi.fn() },
  tenant: { value: undefined as string | undefined },
  org: { value: undefined as string | undefined },
  access: { accessToken: 'session' },
  actor: { userInfo: { platformUser: true, tenantId: 't1' } },
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
    onlyRequireAuthenticated:
      method === mocks.runtime.task || method === mocks.runtime.instance,
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
vi.mock('../api/workflow-request-service', () => ({
  workflowRequestService: mocks.request,
}));
vi.mock('../api/workflow-definition-service', () => ({
  workflowDefinitionService: mocks.definition,
}));
vi.mock('../api/workflow-expense-service', () => ({
  workflowExpenseService: mocks.expense,
}));
vi.mock('../api/workflow-runtime-service', () => ({
  workflowRuntimeService: mocks.runtime,
}));
vi.mock('../api/workflow-management-service', () => ({
  workflowManagementService: mocks.management,
}));

function skill(suffix: string) {
  const found = workflowAgentSkills.find((item) => item.id.endsWith(suffix));
  if (!found?.execute) throw new Error('缺少技能');
  return found;
}
async function run(suffix: string, args: Record<string, unknown> = {}) {
  const execute = skill(suffix).execute;
  if (!execute) throw new Error('缺少执行方法');
  return execute(args, false);
}
const record = {
  id: 'r1',
  taskId: 'task1',
  instanceId: 'instance1',
  status: 'Running',
  outcome: 'Pending',
  executionStatus: 'Running',
  effectStatus: 'Pending',
  formItems: ['秘密'],
  businessFields: ['秘密'],
  timeline: ['秘密'],
  lastError: '秘密',
  reviewNote: '秘密',
  resultSummary: '秘密',
  amount: '100',
  claimedAmount: '100',
  receiptsReady: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.allowed = true;
  mocks.actor.userInfo.platformUser = true;
  mocks.access.accessToken = 'session';
  mocks.tenant.value = undefined;
  mocks.org.value = undefined;
});

describe('流程 Agent 受控只读技能', () => {
  it.each([
    ['workflowRequest.list', 'request', 'list'],
    ['workflowRequest.retrieve', 'request', 'retrieve'],
    ['workflowDefinition.list', 'definition', 'list'],
    ['workflowExpense.retrieve', 'expense', 'retrieve'],
  ] as const)(
    '%s 绑定真实固定方法且只返回显式摘要',
    async (suffix, resource, action) => {
      const fn = (mocks[resource] as Record<string, ReturnType<typeof vi.fn>>)[
        action
      ];
      if (!fn) throw new Error('缺少服务方法');
      fn.mockResolvedValue(
        action === 'list' ? { items: [record], totals: 1 } : record,
      );
      const result = await run(
        suffix,
        action === 'list' ? { limit: 3 } : { id: 'r1' },
      );
      expect(fn).toHaveBeenCalledTimes(1);
      expect(result.count).toBe(1);
      expect(JSON.stringify(result.data)).not.toContain('秘密');
      expect(fn).toHaveBeenCalledWith(
        action === 'list' ? { pageIndex: 1, pageSize: 3 } : { id: 'r1' },
      );
    },
  );

  it.each(['todo', 'done', 'started', 'copied'] as const)(
    '个人流程 %s 使用服务端游标且移除表单和错误',
    async (method) => {
      mocks.runtime[method].mockResolvedValue({
        items: [record],
        hasMore: true,
        nextCursor: 'cursor-next',
      });
      const result = await run(`workflowRuntime.${method}`, {
        size: 2,
        cursor: 'cursor-prev',
      });
      expect(mocks.runtime[method]).toHaveBeenCalledWith({
        size: 2,
        cursor: 'cursor-prev',
      });
      expect(result.data).toMatchObject({
        items: [{ status: 'Running', effectStatus: 'Pending' }],
        hasMore: true,
        nextCursor: 'cursor-next',
      });
      expect(JSON.stringify(result.data)).not.toContain('秘密');
    },
  );

  it.each([
    ['task', 'taskId', 'task1'],
    ['instance', 'instanceId', 'instance1'],
  ] as const)(
    '流程 %s 详情使用字符串标识且只需认证',
    async (method, key, id) => {
      mocks.allowed = false;
      mocks.runtime[method].mockResolvedValue(record);
      expect(skill(`workflowRuntime.${method}`).available?.()).toBe(true);
      const result = await run(`workflowRuntime.${method}`, { [key]: id });
      expect(mocks.runtime[method]).toHaveBeenCalledWith(id);
      expect(result.count).toBe(1);
      mocks.access.accessToken = '';
      expect(skill(`workflowRuntime.${method}`).available?.()).toBe(false);
      await expect(
        run(`workflowRuntime.${method}`, { [key]: id }),
      ).rejects.toThrow('权限');
    },
  );

  it('管理列表和详情保留当前选择范围、独立权限及状态筛选', async () => {
    mocks.tenant.value = 't1';
    mocks.org.value = 'o1';
    mocks.management.instances.mockResolvedValue({
      items: [record],
      hasMore: false,
    });
    mocks.management.instance.mockResolvedValue(record);
    await run('workflowManagement.instances', {
      size: 3,
      definitionId: 'd1',
      status: 'Running',
      keyword: '请假',
    });
    expect(mocks.management.instances).toHaveBeenCalledWith({
      tenantId: 't1',
      orgId: 'o1',
      size: 3,
      cursor: undefined,
      definitionId: 'd1',
      status: 'Running',
      keyword: '请假',
    });
    await run('workflowManagement.instance', { instanceId: 'instance1' });
    expect(mocks.management.instance).toHaveBeenCalledWith({
      tenantId: 't1',
      orgId: 'o1',
      instanceId: 'instance1',
    });
    await expect(
      run('workflowManagement.instances', { tenantId: 't2' }),
    ).rejects.toThrow('范围');
    mocks.allowed = false;
    await expect(
      run('workflowManagement.instance', { instanceId: 'instance1' }),
    ).rejects.toThrow('权限');
  });

  it('查询条件拒绝任意身份、无效游标、越界分页及未知状态', async () => {
    await expect(
      run('workflowRuntime.todo', { userId: 'other' }),
    ).rejects.toThrow('未登记');
    await expect(
      run('workflowRuntime.todo', { cursor: 'x'.repeat(2049) }),
    ).rejects.toThrow('游标');
    await expect(run('workflowRuntime.todo', { size: 21 })).rejects.toThrow(
      '分页',
    );
    await expect(
      run('workflowManagement.instances', { status: 'Pending;DROP' }),
    ).rejects.toThrow('状态');
    await expect(
      run('workflowDefinition.list', { tenantId: 't2' }),
    ).rejects.toThrow('未登记');
    expect(mocks.runtime.todo).not.toHaveBeenCalled();
    expect(mocks.management.instances).not.toHaveBeenCalled();
  });

  it.each([
    { items: [] },
    { hasMore: false },
    { items: [], hasMore: true },
    { items: [], hasMore: 'false' },
  ])('损坏分页结构不得报告查询成功', async (response) => {
    mocks.runtime.todo.mockResolvedValue(response);
    await expect(run('workflowRuntime.todo')).rejects.toThrow('分页');
  });
  it('最后一页接受服务端空游标而不推测总数', async () => {
    mocks.runtime.todo.mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
    const result = await run('workflowRuntime.todo');
    expect(result.data).toEqual({
      items: [],
      hasMore: false,
      nextCursor: undefined,
    });
  });
  it('目录不包含审批、完成、发起、重试或任意写入', () => {
    expect(workflowAgentSkills.every((entry) => entry.risk === 'read')).toBe(
      true,
    );
    expect(workflowAgentSkills.map((entry) => entry.id).join(',')).not.toMatch(
      /\.complete|\.start$|\.retry|\.approve/,
    );
  });
});
