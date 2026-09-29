import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import MyWorkflow from '../views/my-workflow/index.vue';

const api = vi.hoisted(() => ({ retrieve: vi.fn() }));
const permission = vi.hoisted(() => ({ has: vi.fn() }));
vi.mock('../api/workflow-expense-service', () => ({
  workflowExpenseService: api,
}));
vi.mock('../api/workflow-request-service', () => ({
  workflowRequestService: { retrieve: vi.fn() },
}));
vi.mock('../api/workflow-runtime-service', () => ({
  workflowRuntimeService: { retry: vi.fn() },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: permission.has }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
// 让工作台按公开本地目录解析服务端详情键，保留真实业务详情组件和网络调用逻辑。
vi.mock('@levin/bpm-runtime-ui', () => ({
  WorkflowRuntimeWorkbench: {
    name: 'WorkflowRuntimeWorkbench',
    props: ['detailComponents', 'canViewTodo', 'canViewDone', 'canViewStarted'],
    template:
      "<component :is=\"detailComponents['workflow-expense']\" :business-reference=\"{ businessType: 'workflow-expense', businessId: 'expense-1', tenantId: 't1', orgId: 'o1' }\" :readonly=\"true\" />",
  },
}));

describe('我的流程本地报销详情登记', () => {
  beforeEach(() => {
    permission.has.mockReturnValue(true);
  });

  it('最小候选只向工作台开放其有权限的待办分栏', async () => {
    // 菜单可见不等于已办或我发起 API 授权，宿主必须分别传递权限结果。
    permission.has.mockImplementation(
      ([method]: string[]) => method === 'todo',
    );
    const wrapper = mount(MyWorkflow);
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'WorkflowRuntimeWorkbench' }).props(),
    ).toMatchObject({
      canViewTodo: true,
      canViewDone: false,
      canViewStarted: false,
    });
    wrapper.unmount();
  });

  it('服务端workflow-expense键解析真实报销详情且按原作用域读取', async () => {
    api.retrieve.mockResolvedValue({
      subject: '实际报销',
      claimedAmount: 28,
      receiptsReady: true,
      verifiedAmount: 20,
      reviewNote: '扣减不合规票据',
      resultSummary: '核定完成',
    });
    const wrapper = mount(MyWorkflow);
    await flushPromises();
    expect(api.retrieve).toHaveBeenCalledWith({
      id: 'expense-1',
      tenantId: 't1',
      orgId: 'o1',
    });
    expect(wrapper.text()).toContain('实际报销');
    expect(wrapper.text()).toContain('扣减不合规票据');
    expect(wrapper.text()).toContain('核定完成');
    wrapper.unmount();
  });
});
