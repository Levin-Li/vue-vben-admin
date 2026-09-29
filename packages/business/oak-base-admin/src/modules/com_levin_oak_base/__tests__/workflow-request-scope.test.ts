import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowRequestPage from '../views/workflow-request/index.vue';

const calls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  permission: vi.fn(),
}));

vi.mock('@levin/admin-framework', () => ({
  CRUD: { ListTable: () => () => {}, Op: () => () => {} },
  ResAuthorize: () => () => {},
  Service: () => () => {},
  requestClient: {},
  rbacService: { fetchAuthorizedOrgTree: vi.fn() },
  RequestService: class {
    get = calls.get;
    post = calls.post;
    put = calls.put;
  },
  UserOrgSelector: {
    name: 'UserOrgSelector',
    props: ['modelValue', 'selectableTypes', 'loadOrgTree'],
    template: '<div />',
  },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: calls.permission }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: { superAdmin: true } }),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@levin/bpm-runtime-ui', () => ({
  WorkflowBusinessPanel: {
    name: 'WorkflowBusinessPanel',
    props: ['contractVersion', 'canNewRound', 'canResubmit', 'canRetry'],
    template: '<div />',
  },
}));
vi.mock('../api/workflow-runtime-service', () => ({
  workflowRuntimeService: {
    start: vi.fn(),
    retry: vi.fn(),
    history: vi.fn(),
    eligibility: vi.fn(),
    newRound: vi.fn(),
    resubmit: vi.fn(),
    roundState: vi.fn(),
  },
}));
vi.mock('../views/crud-page.vue', () => ({
  default: {
    name: 'CrudPage',
    props: ['config'],
    template:
      '<div><slot name="row-actions" :record="{ id: \'request-1\' }" :reload="() => {}"/></div>',
  },
}));

describe('流程申请宿主的显式组织选择', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.permission.mockReturnValue(true);
  });

  it('宿主显式提供契约1，各轮次动作按实际API方法权限独立传入', async () => {
    calls.permission.mockImplementation(
      ([method]: string[]) => method !== 'resubmit',
    );
    calls.get.mockResolvedValue({ id: 'request-1', title: '申请' });
    const wrapper = mount(WorkflowRequestPage, {
      global: { stubs: { Drawer: { template: '<section><slot/></section>' } } },
    });
    wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('update:selected-records', [
        { id: 'org-a', kind: 'org', name: '研发', tenantId: 'tenant-a' },
      ]);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '业务流程')
      ?.trigger('click');
    await flushPromises();
    const panel = wrapper.findComponent({ name: 'WorkflowBusinessPanel' });
    expect(panel.props()).toMatchObject({
      contractVersion: '1',
      canNewRound: true,
      canResubmit: false,
    });
    expect(calls.permission).toHaveBeenCalledWith(['roundState']);
    expect(calls.permission).toHaveBeenCalledWith(['newRound']);
    expect(calls.permission).toHaveBeenCalledWith(['resubmit']);
    wrapper.unmount();
  });

  it('默认不选择组织，也不加载无范围CRUD或取首个候选', async () => {
    const wrapper = mount(WorkflowRequestPage);
    await flushPromises();
    const selector = wrapper.findComponent({ name: 'UserOrgSelector' });
    expect(selector.props('modelValue')).toBeUndefined();
    expect(selector.props('selectableTypes')).toEqual(['org']);
    expect(wrapper.findComponent({ name: 'CrudPage' }).exists()).toBe(false);
    expect(calls.get).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('请先选择业务组织');
    wrapper.unmount();
  });

  it('用户显式选择完整组织记录后才打开CRUD并将范围意图加入创建载荷', async () => {
    const wrapper = mount(WorkflowRequestPage);
    wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('update:selected-records', [
        { id: 'org-a', kind: 'org', name: '研发', tenantId: 'tenant-a' },
      ]);
    await flushPromises();
    const crud = wrapper.findComponent({ name: 'CrudPage' });
    expect(crud.exists()).toBe(true);
    await crud.props('config').apiService.create({
      title: '申请',
      amount: 1,
      category: 'review',
      documentsComplete: true,
    });
    expect(calls.post).toHaveBeenCalledWith('create', {
      data: {
        title: '申请',
        amount: 1,
        category: 'review',
        documentsComplete: true,
        tenantId: 'tenant-a',
        orgId: 'org-a',
      },
    });
    wrapper.unmount();
  });

  it('没有租户归属的组织不能成为创建范围', async () => {
    const wrapper = mount(WorkflowRequestPage);
    wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('update:selected-records', [
        { id: 'org-a', kind: 'org', name: '来源不完整' },
      ]);
    await flushPromises();
    expect(wrapper.findComponent({ name: 'CrudPage' }).exists()).toBe(false);
    expect(calls.post).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
