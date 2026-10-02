import { flushPromises, mount } from '@vue/test-utils';

import { Modal } from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowRequestPage from '../views/workflow-request/index.vue';

const calls = vi.hoisted(() => ({
  catalog: vi.fn(),
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
    props: [
      'contractVersion',
      'canNewRound',
      'canResubmit',
      'canRetry',
      'showEligibility',
      'showHistory',
    ],
    template: '<div />',
  },
}));
vi.mock('../api/workflow-definition-version-service', () => ({
  workflowDefinitionVersionService: { listBusinessTypes: calls.catalog },
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
    calls.catalog.mockResolvedValue([
      { businessType: 'workflow-request', contractVersion: '1' },
    ]);
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
    const panels = wrapper.findAllComponents({ name: 'WorkflowBusinessPanel' });
    expect(panels).toHaveLength(2);
    expect(
      panels.filter((panel) => panel.props('showHistory') === false),
    ).toHaveLength(1);
    const panel = panels.find(
      (item) => item.props('showEligibility') === false,
    );
    expect(panel?.props()).toMatchObject({
      contractVersion: '1',
      canNewRound: true,
      canResubmit: false,
    });
    expect(calls.permission).toHaveBeenCalledWith(['roundState']);
    expect(calls.permission).toHaveBeenCalledWith(['newRound']);
    expect(calls.permission).toHaveBeenCalledWith(['resubmit']);
    expect(calls.catalog).toHaveBeenCalledWith('tenant-a');
    wrapper.unmount();
  });

  it('授权目录提供两个版本，切换只挂载当前版本且不展示其他业务类型', async () => {
    calls.catalog.mockResolvedValue([
      { businessType: 'workflow-request', contractVersion: '1' },
      { businessType: 'workflow-request', contractVersion: '2' },
      { businessType: 'workflow-expense', contractVersion: '3' },
    ]);
    calls.get.mockResolvedValue({ id: 'request-1', title: '申请' });
    const wrapper = mount(WorkflowRequestPage, {
      global: { stubs: { Drawer: { template: '<section><slot/></section>' } } },
    });
    wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('update:selected-records', [
        { id: 'org-a', kind: 'org', tenantId: 'tenant-a' },
      ]);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '业务流程')
      ?.trigger('click');
    await flushPromises();
    const panels = () =>
      wrapper.findAllComponents({ name: 'WorkflowBusinessPanel' });
    expect(
      panels()
        .find((panel) => panel.props('showEligibility') === false)
        ?.props('contractVersion'),
    ).toBe('1');
    expect(wrapper.text()).not.toContain('申请契约 @3');
    const versionButton = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('申请契约 @2'),
    );
    expect(versionButton).toBeDefined();
    versionButton?.click();
    await flushPromises();
    expect(panels()).toHaveLength(2);
    expect(
      panels().filter((panel) => panel.props('showHistory') === false),
    ).toHaveLength(1);
    expect(
      panels()
        .find((panel) => panel.props('showEligibility') === false)
        ?.props('contractVersion'),
    ).toBe('2');
    wrapper.unmount();
  });

  it('目录失败时不推断默认契约，刷新后才恢复入口', async () => {
    calls.catalog.mockRejectedValueOnce(new Error('forbidden'));
    calls.get.mockResolvedValue({ id: 'request-1', title: '申请' });
    const wrapper = mount(WorkflowRequestPage, {
      global: { stubs: { Drawer: { template: '<section><slot/></section>' } } },
    });
    wrapper
      .findComponent({ name: 'UserOrgSelector' })
      .vm.$emit('update:selected-records', [
        { id: 'org-a', kind: 'org', tenantId: 'tenant-a' },
      ]);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '业务流程')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper.findAllComponents({ name: 'WorkflowBusinessPanel' }),
    ).toHaveLength(1);
    expect(
      wrapper
        .findComponent({ name: 'WorkflowBusinessPanel' })
        .props('showHistory'),
    ).toBe(false);
    const refreshButton = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('刷新契约版本'),
    );
    expect(refreshButton).toBeDefined();
    refreshButton?.click();
    await flushPromises();
    expect(
      wrapper
        .findAllComponents({ name: 'WorkflowBusinessPanel' })
        .find((panel) => panel.props('showEligibility') === false)
        ?.props('contractVersion'),
    ).toBe('1');
    wrapper.unmount();
  });

  it('切换组织后丢弃旧租户的迟到能力目录', async () => {
    let resolveCatalog: (value: unknown[]) => void = () => {};
    calls.catalog.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCatalog = resolve;
        }),
    );
    calls.get.mockResolvedValue({ id: 'request-1', title: '申请' });
    const confirmation = vi
      .spyOn(Modal, 'confirm')
      .mockImplementation((config) => {
        void config.onOk?.();
        return {} as ReturnType<typeof Modal.confirm>;
      });
    const wrapper = mount(WorkflowRequestPage, {
      global: { stubs: { Drawer: { template: '<section><slot/></section>' } } },
    });
    const selector = wrapper.findComponent({ name: 'UserOrgSelector' });
    selector.vm.$emit('update:selected-records', [
      { id: 'org-a', kind: 'org', tenantId: 'tenant-a' },
    ]);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '业务流程')
      ?.trigger('click');
    selector.vm.$emit('update:selected-records', [
      { id: 'org-b', kind: 'org', tenantId: 'tenant-b' },
    ]);
    await flushPromises();
    resolveCatalog([
      { businessType: 'workflow-request', contractVersion: '2' },
    ]);
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'WorkflowBusinessPanel' }).exists(),
    ).toBe(false);
    expect(calls.catalog).toHaveBeenCalledWith('tenant-a');
    confirmation.mockRestore();
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
