import { mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import MyWorkflow from '../index.vue';

const { query, task, instance, menu, push } = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  task: vi.fn(),
  instance: vi.fn(),
  menu: vi.fn(),
  push: vi.fn(),
}));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({ getMenuByPath: menu }),
  useUserStore: () => ({ userInfo: { id: 'current-user' } }),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query }),
  useRouter: () => ({ push }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({ buildApiMethodPermissions: () => [] }),
);
vi.mock('../../../api/workflow-runtime-service', () => ({
  workflowOperationPermissions: {
    withdraw: [],
    terminate: ['workflow.runtime.terminate'],
    recover: ['workflow.runtime.recover'],
  },
  workflowRuntimeService: { copyRecipients: vi.fn(), task, instance },
}));
vi.mock('../../workflow-request/detail.vue', () => ({
  default: { template: '<div />' },
}));
vi.mock('../workflow-contract-detail.vue', () => ({
  default: { template: '<div />' },
}));
vi.mock('../workflow-expense-detail.vue', () => ({
  default: { template: '<div />' },
}));
vi.mock('@levin/bpm-runtime-ui', () => ({
  WorkflowRuntimeWorkbench: {
    name: 'WorkflowRuntimeWorkbench',
    props: [
      'targetTaskId',
      'targetInstanceId',
      'loadTargetTask',
      'loadTargetInstance',
      'canViewTargetTask',
      'canViewTargetInstance',
    ],
    template: '<div><slot name="header-action" /></div>',
  },
}));
vi.mock('ant-design-vue', () => ({
  Alert: { props: ['message'], template: '<div>{{ message }}</div>' },
  Button: { template: '<button><slot /></button>' },
  message: { error: vi.fn() },
}));

// 邮件路由只能传递定位符，禁止数组、身份透传和歧义目标进入详情读取。
describe('我的工作流邮件路由', () => {
  beforeEach(() => {
    for (const key of Object.keys(query)) Reflect.deleteProperty(query, key);
    menu.mockReset();
    push.mockReset();
  });
  it('仅在发起流程菜单已授权时提供跳转入口', async () => {
    const denied = mount(MyWorkflow);
    expect(denied.find('button').exists()).toBe(false);
    denied.unmount();
    menu.mockReturnValue({ path: '/clob/V1/WorkflowStart' });
    const allowed = mount(MyWorkflow);
    await allowed.get('button').trigger('click');
    expect(menu).toHaveBeenCalledWith('/clob/V1/WorkflowStart');
    expect(push).toHaveBeenCalledWith('/clob/V1/WorkflowStart');
    allowed.unmount();
  });
  it('只把任务定位符传给工作台，忽略路由身份和令牌', () => {
    Object.assign(query, {
      taskId: 'task-1',
      tenantId: 'other',
      userId: 'other',
      accessToken: 'secret',
    });
    const wrapper = mount(MyWorkflow);
    const props = wrapper
      .findComponent({ name: 'WorkflowRuntimeWorkbench' })
      .props();
    expect(props.targetTaskId).toBe('task-1');
    expect(props.canViewTargetTask).toBe(true);
    props.loadTargetTask('task-1');
    expect(task).toHaveBeenCalledWith('task-1');
    expect(props.targetInstanceId).toBeUndefined();
    expect(props).not.toHaveProperty('tenantId');
    expect(props).not.toHaveProperty('accessToken');
    wrapper.unmount();
  });
  it('实例链接只传实例定位符', () => {
    query.instanceId = 'instance-1';
    const wrapper = mount(MyWorkflow);
    expect(
      wrapper
        .findComponent({ name: 'WorkflowRuntimeWorkbench' })
        .props('targetInstanceId'),
    ).toBe('instance-1');
    wrapper.unmount();
  });
  it.each([
    { taskId: ['task-1', 'task-2'] },
    { taskId: 'x'.repeat(129) },
    { taskId: 'task-1', instanceId: 'instance-1' },
    { taskId: '../admin' },
  ])('无效或歧义目标展示提示且不读取详情：%j', (values) => {
    Object.assign(query, values);
    const wrapper = mount(MyWorkflow);
    const props = wrapper
      .findComponent({ name: 'WorkflowRuntimeWorkbench' })
      .props();
    expect(props.targetTaskId).toBeUndefined();
    expect(props.targetInstanceId).toBeUndefined();
    expect(wrapper.text()).toContain('流程链接无效');
    wrapper.unmount();
  });
});
