import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import { configureDataAttrPolicyLoader } from '@levin/admin-framework/framework-commons/data-attr-policy';
import CrudPage from '@levin/admin-framework/framework-commons/shared/dynamic-crud-page.vue';
import { message } from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowInstance from '../index.vue';

// 只替换远端边缘，保留真实页面查询、授权范围、游标与详情代际。
const state = vi.hoisted(() => ({
  actor: {} as Record<string, unknown>,
  query: {} as Record<string, unknown>,
  has: vi.fn(),
  instances: vi.fn(),
  instance: vi.fn(),
  get: vi.fn(),
  request: vi.fn(),
  setPageKeepAlive: vi.fn(),
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
vi.mock('vue-router', async (original) => ({
  ...(await original<typeof import('vue-router')>()),
  useRoute: () => ({
    query: state.query,
    path: '/workflow-instance',
    fullPath: '/workflow-instance',
    meta: {},
    matched: [],
  }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@vben/runtime/stores', () => ({
  getTabKey: (route: { path: string }) => route.path,
  useAccessStore: () => ({ accessCodes: [] }),
  useTabbarStore: () => ({ setPageKeepAlive: state.setPageKeepAlive }),
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
  async (original) => ({
    ...(await original<
      typeof import('@levin/admin-framework/framework-commons/shared/crud-permissions')
    >()),
    buildApiMethodPermissions: (_: unknown, method: string) => [method],
  }),
);
// 网络、属性策略装载等远端边缘替身，列表与标准表格保持真实实现。
vi.mock('@levin/admin-framework/framework-commons/runtime', () => ({
  requestClient: {
    get: state.get,
    post: state.request,
    put: state.request,
    request: state.request,
    delete: state.request,
  },
}));
vi.mock('@levin/admin-framework/framework-commons/app/api/request', () => ({
  requestClient: {
    get: state.get,
    post: state.request,
    put: state.request,
    request: state.request,
    delete: state.request,
  },
  baseRequestClient: { get: state.get },
}));

vi.mock('../../../api/workflow-management-service', () => ({
  workflowManagementService: {
    instances: state.instances,
    instance: state.instance,
  },
}));
vi.mock('../../../api/workflow-request-service', () => ({
  loadWorkflowRequestOrgTree: vi.fn(),
}));
vi.mock('@levin/bpm-runtime-ui', async () => {
  const stateEvents =
    await import('../../../../../../../bpm-runtime-ui/src/workflow-state-events.vue');
  return {
    WorkflowStateEvents: stateEvents.default,
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
  };
});

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
const mountPage = () =>
  mount(WorkflowInstance, {
    global: {
      stubs: {
        ADrawer: {
          props: ['open'],
          template: '<aside v-if="open"><slot /></aside>',
        },
      },
    },
  });
const button = (wrapper: ReturnType<typeof mount>, text: string) => {
  const found = wrapper
    .findAll('button')
    .find((item) => item.text().replaceAll(/\s/g, '') === text);
  if (!found) throw new Error(`缺少按钮：${text}`);
  return found;
};

describe('管理侧运行实例', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.spyOn(message, 'error');
    state.actor = reactive({ tenantId: 't1' });
    state.query = {};
    state.get.mockResolvedValue([]);
    state.request.mockResolvedValue({});
    configureDataAttrPolicyLoader(async () => ({
      version: 1,
      policies: [
        {
          id: 'workflow-read',
          operation: 'instances',
          methods: ['GET'],
          pathPatterns: [
            '/com.levin.oak.base/V1/api/workflow-management/instances',
          ],
          restricted: false,
          groups: [],
          nodes: {},
          requestRoots: [],
          responseRoot: null,
          viewRoots: { request: [], response: [] },
        },
      ],
    }));
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
    const wrapper = mountPage();
    await flushPromises();
    expect(state.instances).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', size: 20 }),
    );
    expect(state.instances.mock.calls[0]?.[0]).not.toHaveProperty('pageIndex');
    expect(state.instances.mock.calls[0]?.[0]).not.toHaveProperty('pageSize');
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
    const wrapper = mountPage();
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
    state.actor = reactive({ platformUser: true, roleList: ['R_PLATFORM_SA'] });
    const staleList = deferred();
    const staleDetail = deferred();
    state.instances
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce(page)
      .mockImplementationOnce(() => staleList.promise)
      .mockResolvedValueOnce({ items: [], hasMore: false });
    state.instance.mockImplementationOnce(() => staleDetail.promise);
    const wrapper = mountPage();
    await flushPromises();
    expect(state.instances).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined, orgId: undefined }),
    );
    await button(wrapper, '展开').trigger('click');
    await flushPromises();
    const selector = wrapper.findComponent({ name: 'UserOrgSelector' });
    selector.vm.$emit('update:selectedRecords', { id: 'o1', tenantId: 't1' });
    await flushPromises();
    await button(wrapper, '查看实例').trigger('click');
    await flushPromises();
    await wrapper.get('button[aria-label="刷新"]').trigger('click');
    await flushPromises();
    wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('update:selectedRecords', { id: 'o2', tenantId: 't2' });
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
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).not.toContain('查看实例');
    state.instances.mockReset();
    state.instances.mockRejectedValue(new Error('当前业务范围不可访问'));
    await wrapper.get('button[aria-label="刷新"]').trigger('click');
    await flushPromises();
    expect(message.error).toHaveBeenCalledWith('当前业务范围不可访问');
    expect(wrapper.text()).not.toContain('差旅报销');
    wrapper.unmount();
    state.has.mockImplementation(
      ([method]: string[]) => method !== 'instances',
    );
    state.instances.mockClear();
    const denied = mountPage();
    await flushPromises();
    expect(denied.text()).toContain('当前账号没有查询运行实例的权限');
    expect(state.instances).not.toHaveBeenCalled();
    expect(denied.find('.ant-table').exists()).toBe(false);
    denied.unmount();
  });

  it('真实标准 CRUD 提供列表与工具栏，禁用无业务契约的写入和导出', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.findComponent(CrudPage).exists()).toBe(true);
    expect(wrapper.find('.ant-table').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="列设置"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="全屏"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-label="导出"]').exists()).toBe(false);
    expect(wrapper.find('button[aria-label="导入"]').exists()).toBe(false);
    expect(
      wrapper
        .findAll('button')
        .some((item) => /新增|编辑|删除/.test(item.text())),
    ).toBe(false);
    await wrapper.get('button[aria-label="列设置"]').trigger('click');
    await flushPromises();
    expect(
      document.querySelector('.vben-crud-column-popover')?.textContent,
    ).toContain('显示与排序仅保存在当前浏览器');
    const count = state.instances.mock.calls.length;
    await wrapper.get('button[aria-label="刷新"]').trigger('click');
    await flushPromises();
    expect(state.instances).toHaveBeenCalledTimes(count + 1);
    await wrapper.get('button[aria-label="全屏"]').trigger('click');
    expect(wrapper.find('.vben-crud-section--fullscreen').exists()).toBe(true);
    wrapper.unmount();
  });

  it('设计页带来的流程筛选进入首个查询', async () => {
    state.query = { definitionId: 'from-design' };
    const wrapper = mountPage();
    await flushPromises();
    expect(state.instances).toHaveBeenCalledWith(
      expect.objectContaining({ definitionId: 'from-design' }),
    );
    wrapper.unmount();
  });
});
