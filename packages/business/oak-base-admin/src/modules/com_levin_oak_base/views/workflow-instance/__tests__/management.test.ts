import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowInstance from '../index.vue';

// 只替换远端边缘，保留真实页面查询、授权范围、游标与详情代际。
const state = vi.hoisted(() => ({
  actor: {} as Record<string, unknown>,
  query: {} as Record<string, unknown>,
  has: vi.fn(),
  instances: vi.fn(),
  instance: vi.fn(),
}));
vi.mock('../../../api/workflow-runtime-service', () => ({
  workflowRuntimeService: {
    withdraw: vi.fn(),
    terminate: vi.fn(),
    recover: vi.fn(),
  },
  workflowOperationPermissions: {
    withdraw: [],
    terminate: ['workflow.runtime.terminate'],
    recover: ['workflow.runtime.recover'],
  },
}));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: state.query }) }));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({
    get userInfo() {
      return state.actor;
    },
  }),
}));
vi.mock('@levin/admin-framework', () => ({
  UserOrgSelector: {
    name: 'UserOrgSelector',
    emits: ['update:selectedRecords'],
    template: '<div>授权组织</div>',
  },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: state.has }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_: unknown, method: string) => [method],
  }),
);
vi.mock('../../../api/workflow-management-service', () => ({
  workflowManagementService: {
    instances: state.instances,
    instance: state.instance,
  },
}));
vi.mock('../../../api/workflow-request-service', () => ({
  loadWorkflowRequestOrgTree: vi.fn(),
}));
vi.mock('@levin/bpm-runtime-ui', () => ({
  WorkflowInstanceOperations: {
    props: [
      'instanceId',
      'businessReference',
      'allowedActions',
      'permissions',
      'execute',
    ],
    template: '<div />',
  },
  WorkflowProcessDiagram: {
    name: 'WorkflowProcessDiagram',
    props: ['task'],
    template: '<section>固定版本流程图</section>',
  },
}));

const row = {
  instanceId: 'i1',
  definitionId: 'd1',
  definitionName: '报销审批',
  businessTitle: '差旅报销',
  status: 'Running',
  executionStatus: 'Running',
  outcome: 'Approved',
  effectStatus: 'Pending',
};
const page = { items: [row], hasMore: false };
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const button = (wrapper: ReturnType<typeof mount>, text: string) => {
  const found = wrapper
    .findAll('button')
    .find((item) => item.text().replaceAll(/\s/g, '') === text);
  if (!found) throw new Error(`缺少按钮：${text}`);
  return found;
};

describe('管理侧运行实例', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actor = reactive({ tenantId: 't1' });
    state.query = {};
    state.has.mockReturnValue(true);
    state.instances.mockResolvedValue(page);
    state.instance.mockResolvedValue({
      ...row,
      businessId: 'b1',
      businessType: 'expense',
      timeline: [
        { name: '财务审批', status: 'Completed', comment: '核验完成' },
      ],
    });
  });

  it('按会话租户查询并展示三个状态、业务引用和只读详情', async () => {
    const wrapper = mount(WorkflowInstance);
    await flushPromises();
    expect(state.instances).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', size: 20 }),
    );
    expect(wrapper.text()).toContain('运行中');
    expect(wrapper.text()).toContain('通过');
    expect(wrapper.text()).toContain('待处理');
    await button(wrapper, '查看实例').trigger('click');
    await flushPromises();
    expect(state.instance).toHaveBeenCalledWith({
      instanceId: 'i1',
      tenantId: 't1',
      orgId: undefined,
    });
    expect(wrapper.text()).toContain('核验完成');
    expect(wrapper.text()).toContain('b1');
    expect(
      wrapper.findComponent({ name: 'WorkflowProcessDiagram' }).props('task')
        .instanceId,
    ).toBe('i1');
    expect(
      wrapper
        .findAll('button')
        .some((item) => /批准|拒绝|办理/.test(item.text())),
    ).toBe(false);
    wrapper.unmount();
  });

  it('前后翻页携带服务端游标且查询重置到第一页', async () => {
    state.instances.mockResolvedValueOnce({
      ...page,
      hasMore: true,
      nextCursor: 'cursor-2',
    });
    const wrapper = mount(WorkflowInstance);
    await flushPromises();
    await button(wrapper, '下一页').trigger('click');
    await flushPromises();
    expect(state.instances).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-2' }),
    );
    expect(wrapper.text()).toContain('第 2 页');
    await button(wrapper, '查询').trigger('click');
    await flushPromises();
    expect(state.instances).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: undefined }),
    );
    expect(wrapper.text()).toContain('第 1 页');
    wrapper.unmount();
  });

  it('平台组织范围切换后丢弃旧列表和旧详情的迟到响应', async () => {
    state.actor = reactive({ platformUser: true });
    const staleList = deferred();
    const staleDetail = deferred();
    state.instances
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce(page)
      .mockImplementationOnce(() => staleList.promise)
      .mockResolvedValueOnce({ items: [], hasMore: false });
    state.instance.mockImplementationOnce(() => staleDetail.promise);
    const wrapper = mount(WorkflowInstance);
    await flushPromises();
    expect(state.instances).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined, orgId: undefined }),
    );
    const selector = wrapper.findComponent({ name: 'UserOrgSelector' });
    selector.vm.$emit('update:selectedRecords', { id: 'o1', tenantId: 't1' });
    await flushPromises();
    await button(wrapper, '查看实例').trigger('click');
    await flushPromises();
    await button(wrapper, '刷新').trigger('click');
    selector.vm.$emit('update:selectedRecords', { id: 'o2', tenantId: 't2' });
    await flushPromises();
    staleList.resolve({
      items: [{ ...row, businessTitle: '旧范围敏感数据' }],
      hasMore: false,
    });
    staleDetail.resolve({ ...row, businessTitle: '旧实例敏感详情' });
    await flushPromises();
    expect(state.instances).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenantId: 't2', orgId: 'o2' }),
    );
    expect(wrapper.text()).not.toContain('旧范围敏感数据');
    expect(wrapper.text()).not.toContain('旧实例敏感详情');
    expect(
      wrapper.findComponent({ name: 'WorkflowProcessDiagram' }).exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it('查询或详情无权时不暴露对应操作；错误显示真实失败', async () => {
    state.has.mockImplementation(([method]: string[]) => method !== 'instance');
    const wrapper = mount(WorkflowInstance);
    await flushPromises();
    expect(wrapper.text()).not.toContain('查看实例');
    state.instances.mockRejectedValueOnce(new Error('当前业务范围不可访问'));
    await button(wrapper, '刷新').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('当前业务范围不可访问');
    expect(wrapper.text()).not.toContain('差旅报销');
    wrapper.unmount();
  });

  it('设计页带来的流程筛选进入首个查询', async () => {
    state.query = { definitionId: 'from-design' };
    const wrapper = mount(WorkflowInstance);
    await flushPromises();
    expect(state.instances).toHaveBeenCalledWith(
      expect.objectContaining({ definitionId: 'from-design' }),
    );
    wrapper.unmount();
  });
});
