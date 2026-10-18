import { flushPromises, mount } from '@vue/test-utils';
import { toRaw } from 'vue';

import { Form, Input, Modal, Select, Table } from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowDefinitionPage from '../views/workflow-definition/index.vue';

const api = vi.hoisted(() => ({
  denied: new Set<string>(),
  push: vi.fn(),
  instances: vi.fn(),
  list: vi.fn(),
  versions: vi.fn(),
  retrieve: vi.fn(),
  catalog: vi.fn(),
  create: vi.fn(),
  createVersion: vi.fn(),
  retire: vi.fn(),
  restore: vi.fn(),
  finishRetire: vi.fn(),
  archive: vi.fn(),
  saveDraft: vi.fn(),
  startSimulation: vi.fn(),
  publishAfterSimulation: vi.fn(),
}));

vi.mock('../api/workflow-definition-service', () => ({
  workflowDefinitionService: { list: api.list, create: api.create },
}));
vi.mock('../api/workflow-definition-version-service', () => ({
  workflowDefinitionVersionService: {
    list: api.versions,
    retrieve: api.retrieve,
    create: api.createVersion,
    retire: api.retire,
    restore: api.restore,
    finishRetire: api.finishRetire,
    archive: api.archive,
    saveDraft: api.saveDraft,
    startSimulation: api.startSimulation,
    publishAfterSimulation: api.publishAfterSimulation,
  },
}));
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push: api.push }),
}));
vi.mock('../api/workflow-management-service', () => ({
  workflowManagementService: { instances: api.instances },
}));
vi.mock('../api/workflow-runtime-service', () => ({
  workflowRuntimeService: { catalog: api.catalog },
}));
vi.mock('../api/workflow-candidate-service', () => ({
  loadWorkflowCandidates: async () => ({ users: [], groups: [] }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({
    hasPermission: (permissions: string[]) =>
      !permissions.some((permission) => api.denied.has(permission)),
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('@levin/bpm-designer', async () => {
  const { getLatestWorkflowBusinessType } =
    await import('../../../../../bpm-designer/src/definition-model');
  return {
    getLatestWorkflowBusinessType,
    workflowLifecycleLabels: {
      Draft: '草稿',
      Testing: '测试中',
      Published: '已发布',
      Retiring: '下线中',
      Retired: '已下线',
      Archived: '已归档',
    },
    createTreeDefinition: (processKey = '', name = '') => ({
      schemaVersion: 3,
      processKey,
      name,
      flowTree: { id: 'start', type: 'start', name: '开始' },
    }),
    WorkflowDefinitionWorkbench: {
      name: 'WorkflowDefinitionWorkbench',
      props: ['version', 'definition', 'options'],
      template: '<div />',
    },
  };
});

describe('流程设计宿主的版本恢复', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.denied.clear();
    api.createVersion.mockResolvedValue('new-draft');
    api.list.mockResolvedValue({
      items: [
        {
          id: 'definition',
          name: '审批',
          processKey: 'approval',
          businessType: 'workflow-request',
        },
      ],
    });
    api.catalog.mockResolvedValue([]);
    api.versions.mockResolvedValue({
      items: [
        { id: 'older', versionNo: 1, lifecycle: 'Testing' },
        { id: 'latest', versionNo: 2, lifecycle: 'Testing' },
      ],
    });
    api.retrieve.mockImplementation(async ({ id }) => ({
      id,
      lifecycle: 'Testing',
      optimisticLock: 9,
      lowflowDefinition: {
        schemaVersion: 3,
        name: '审批',
        processKey: 'approval',
        flowTree: { id: 'start', type: 'start', name: '开始' },
      },
      simulationReport: { successful: true, runId: `report-${id}` },
    }));
  });

  it('业务设计者新建流程只填写名称和业务对象', async () => {
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.findComponent(Form).props('model')).toEqual({
      name: '',
      businessType: '',
    });
    expect(wrapper.text()).not.toContain('流程标识');
    wrapper.unmount();
  });

  it('保存新流程时由系统生成稳定键，不从表单索取技术标识', async () => {
    api.create.mockResolvedValue('new-definition');
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    const form = wrapper.findComponent(Form);
    const formModel = form.props('model');
    if (!formModel) throw new Error('缺少新建流程表单');
    Object.assign(formModel, {
      name: '请假审批',
      businessType: 'workflow-request',
    });
    form.vm.$emit('finish', formModel);
    await flushPromises();

    expect(api.createVersion).toHaveBeenCalledWith({
      workflowDefinitionId: 'new-definition',
      versionNo: 1,
    });
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('version').id,
    ).toBe('new-draft');
    expect(api.create).toHaveBeenCalledWith({
      name: '请假审批',
      businessType: 'workflow-request',
      processKey: expect.stringMatching(/^workflow-[\da-f-]+$/),
    });
    wrapper.unmount();
  });

  it('选择定义时通过详情恢复最新版本模拟报告，不使用列表摘要发布', async () => {
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(api.retrieve).toHaveBeenCalledWith({ id: 'latest' });
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('version'),
    ).toMatchObject({
      id: 'latest',
      optimisticLock: 9,
      simulationReport: { successful: true, runId: 'report-latest' },
    });
    wrapper.unmount();
  });

  it('从当前选中的已保存版本复制完整设计，不复制部署或模拟证明', async () => {
    const saved = {
      schemaVersion: 3,
      name: '双分支复核',
      processKey: 'approval',
      purposeKey: 'expense-review',
      businessBinding: {
        businessType: 'workflow-expense',
        contractVersion: '1',
        identityField: 'id',
        titleField: 'title',
      },
      flowTree: {
        id: 'start',
        type: 'start',
        name: '开始',
        notifications: [
          {
            event: 'NodeEntered',
            recipient: 'applicant',
            channels: ['Station'],
            title: '流程通知',
            content: '# {{process.name}}',
          },
        ],
        next: {
          id: 'review',
          type: 'userTask',
          name: '财务核验',
          formAction: 'verify',
          readableFields: ['amount'],
          editableFields: ['verifiedAmount'],
          next: {
            id: 'branch',
            type: 'exclusiveGateway',
            name: '金额分支',
            branches: [
              {
                id: 'large',
                condition: { gt: [{ variable: 'amount' }, { literal: 1000 }] },
              },
            ],
          },
        },
      },
    };
    api.retrieve.mockImplementation(async ({ id }) => ({
      id,
      lifecycle: id === 'new-draft' ? 'Draft' : 'Published',
      versionNo: id === 'older' ? 1 : 2,
      lowflowDefinition:
        id === 'older' ? saved : { ...saved, name: '另一个版本' },
      bpmnXml: '<definitions />',
      simulationReport: { successful: true, runId: 'old-proof' },
    }));
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    wrapper
      .findAllComponents(Select)
      .find((select) => select.attributes('aria-label') === '选择流程版本')
      ?.vm.$emit('change', 'older');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建草稿版本')
      ?.trigger('click');
    await flushPromises();
    expect(api.createVersion).toHaveBeenCalledWith({
      workflowDefinitionId: 'definition',
      versionNo: 3,
      lowflowDefinition: saved,
    });
    const request = api.createVersion.mock.calls[0]?.[0];
    expect(request.lowflowDefinition).not.toBe(saved);
    expect(request).not.toHaveProperty('bpmnXml');
    expect(request).not.toHaveProperty('simulationReport');
    wrapper.unmount();
  });

  it('确认放弃未保存修改后复制持久化版本，取消时不创建', async () => {
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    const workbench = wrapper.findComponent({
      name: 'WorkflowDefinitionWorkbench',
    });
    const saved = structuredClone(toRaw(workbench.props('definition')));
    workbench.vm.$emit('update:definition', {
      ...saved,
      name: '尚未保存的修改',
    });
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建草稿版本')
      ?.trigger('click');
    await flushPromises();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.createVersion).not.toHaveBeenCalled();
    confirm.mock.calls[0]?.[0].onCancel?.();
    await flushPromises();
    expect(api.createVersion).not.toHaveBeenCalled();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建草稿版本')
      ?.trigger('click');
    await flushPromises();
    confirm.mock.calls[1]?.[0].onOk?.();
    await flushPromises();
    expect(api.createVersion).toHaveBeenCalledWith({
      workflowDefinitionId: 'definition',
      versionNo: 3,
      lowflowDefinition: saved,
    });
    expect(api.createVersion.mock.calls[0]?.[0].lowflowDefinition.name).toBe(
      '审批',
    );
    confirm.mockRestore();
    wrapper.unmount();
  });

  it('首次草稿继承业务对象并自动预填用途与字段角色', async () => {
    api.catalog.mockResolvedValue([
      {
        businessType: 'workflow-request',
        contractVersion: '2',
        title: '业务申请',
        fields: {},
        defaultBinding: {
          identityField: 'id',
          titleField: 'title',
          applicantField: 'ownerId',
        },
      },
    ]);
    api.retrieve.mockResolvedValueOnce({
      id: 'latest',
      lifecycle: 'Draft',
      optimisticLock: 1,
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('definition'),
    ).toMatchObject({
      purposeKey: 'approval',
      businessBinding: {
        businessType: 'workflow-request',
        contractVersion: '2',
        identityField: 'id',
        titleField: 'title',
        applicantField: 'ownerId',
      },
    });
    wrapper.unmount();
  });

  it('全新草稿在多个业务方案中默认采用最新契约', async () => {
    api.catalog.mockResolvedValue(
      [1, 2].map((contractVersion) => ({
        businessType: 'workflow-request',
        contractVersion,
        title: '业务申请',
        fields: {},
        defaultBinding: { identityField: 'id', titleField: 'title' },
      })),
    );
    api.retrieve.mockResolvedValueOnce({
      id: 'latest',
      lifecycle: 'Draft',
      optimisticLock: 1,
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('definition').businessBinding,
    ).toMatchObject({
      contractVersion: 2,
      identityField: 'id',
      titleField: 'title',
    });
    expect(wrapper.text()).toContain(
      '发起前请确认流程已发布、业务记录满足启动条件',
    );
    expect(wrapper.text()).toContain('实例的租户和组织跟随业务记录');
    wrapper.unmount();
  });

  it('已有持久化设计保留历史契约，不被新目录升级', async () => {
    api.catalog.mockResolvedValue(
      [1, 2].map((contractVersion) => ({
        businessType: 'workflow-request',
        contractVersion,
        title: '业务申请',
        fields: {},
        defaultBinding: { identityField: 'id', titleField: 'title' },
      })),
    );
    api.retrieve.mockResolvedValueOnce({
      id: 'latest',
      lifecycle: 'Draft',
      lowflowDefinition: {
        schemaVersion: 3,
        processKey: 'approval',
        name: '历史审核',
        businessBinding: {
          businessType: 'workflow-request',
          contractVersion: 1,
          identityField: 'id',
          titleField: 'title',
        },
        flowTree: { id: 'start', type: 'start', name: '开始' },
      },
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('definition').businessBinding.contractVersion,
    ).toBe(1);
    expect(api.saveDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('当前流程用途不进入自己的前置流程候选', async () => {
    api.versions.mockImplementation(async (query) =>
      query.lifecycle === 'Published'
        ? {
            items: [
              {
                id: 'current-published',
                lowflowDefinition: {
                  schemaVersion: 3,
                  purposeKey: 'approval',
                  name: '当前审核',
                  businessBinding: { businessType: 'workflow-request' },
                },
              },
              {
                id: 'prior-published',
                lowflowDefinition: {
                  schemaVersion: 3,
                  purposeKey: 'prior-review',
                  name: '资料复核',
                  businessBinding: { businessType: 'workflow-request' },
                },
              },
            ],
          }
        : { items: [{ id: 'draft', versionNo: 3, lifecycle: 'Draft' }] },
    );
    api.retrieve.mockResolvedValueOnce({
      id: 'draft',
      lifecycle: 'Draft',
      optimisticLock: 1,
      lowflowDefinition: {
        schemaVersion: 3,
        name: '当前审核',
        processKey: 'approval',
        purposeKey: 'approval',
        flowTree: { id: 'start', type: 'start', name: '开始' },
      },
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();

    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('options').purposeOptions,
    ).toEqual([{ label: '资料复核', value: 'prior-review' }]);
    wrapper.unmount();
  });

  it('切换版本重新加载该版本详情与报告', async () => {
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    wrapper
      .findAllComponents(Select)
      .find((select) => select.attributes('aria-label') === '选择流程版本')
      ?.vm.$emit('change', 'older');
    await flushPromises();
    expect(api.retrieve).toHaveBeenLastCalledWith({ id: 'older' });
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('version').simulationReport.runId,
    ).toBe('report-older');
    wrapper.unmount();
  });

  it('旧版平面图详情失败关闭，不自动转换或回填为树', async () => {
    api.retrieve.mockResolvedValueOnce({
      id: 'latest',
      lifecycle: 'Testing',
      lowflowDefinition: { schemaVersion: 2, nodes: [], edges: [] },
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('仅支持第三版流程树');
    expect(
      wrapper.findComponent({ name: 'WorkflowDefinitionWorkbench' }).exists(),
    ).toBe(false);
    expect(api.saveDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('通过服务端分页和名称查询管理定义，显示全局与租户归属', async () => {
    api.list.mockResolvedValue({
      items: [
        {
          id: 'global',
          name: '全局审批',
          businessType: 'request',
          processKey: 'global',
        },
        {
          id: 'tenant',
          name: '租户审批',
          businessType: 'request',
          processKey: 'tenant',
          tenantId: 'tenant-a',
          tenantName: '甲公司',
        },
      ],
      totals: 250,
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    expect(wrapper.text()).toContain('全局');
    expect(wrapper.text()).toContain('租户：甲公司');
    expect(wrapper.findComponent(Table).props('pagination')).toEqual(
      expect.objectContaining({ total: 250 }),
    );
    wrapper
      .findComponent(Table)
      .vm.$emit('change', { current: 3, pageSize: 20 });
    await flushPromises();
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 3, pageSize: 20 }),
    );
    wrapper.findAllComponents(Input)[0]?.vm.$emit('update:value', '审批');
    await wrapper
      .findAll('button')
      .find((button) => button.text().replaceAll(' ', '') === '查询')
      ?.trigger('click');
    await flushPromises();
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 1, containsName: '审批' }),
    );
    wrapper.unmount();
  });

  it('首草稿创建失败保留定义并允许重试，不重复创建定义', async () => {
    api.create.mockResolvedValue('created-definition');
    api.createVersion.mockRejectedValueOnce(new Error('暂时不可用'));
    api.versions.mockResolvedValue({ items: [] });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    const form = wrapper.findComponent(Form);
    const model = form.props('model');
    if (!model) throw new Error('缺少流程表单');
    Object.assign(model, {
      name: '新审批',
      businessType: 'request',
    });
    form.vm.$emit('finish');
    await flushPromises();
    expect(wrapper.text()).toContain('流程定义已创建，首个草稿创建失败');
    expect(wrapper.text()).toContain('新审批 · 设计工作台');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建草稿版本')
      ?.trigger('click');
    await flushPromises();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.createVersion).toHaveBeenLastCalledWith({
      workflowDefinitionId: 'created-definition',
      versionNo: 1,
    });
    expect(
      wrapper.findComponent({ name: 'WorkflowDefinitionWorkbench' }).exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it('版本历史超过200条仍加载全部并打开真正最新版本', async () => {
    api.versions.mockImplementation(async (query) => {
      if (query.lifecycle) return { items: [] };
      const start = ((query.pageIndex ?? 1) - 1) * query.pageSize;
      return {
        items: Array.from(
          { length: Math.min(query.pageSize, 205 - start) },
          (_, index) => ({
            id: `v-${start + index + 1}`,
            versionNo: start + index + 1,
            lifecycle: 'Draft',
          }),
        ),
        totals: 205,
      };
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(api.retrieve).toHaveBeenLastCalledWith({ id: 'v-205' });
    expect(api.versions).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 5, pageSize: 50 }),
    );
    wrapper.unmount();
  });

  it('只显示服务端支持的版本生命周期操作', async () => {
    api.retrieve.mockResolvedValue({
      id: 'latest',
      lifecycle: 'Retiring',
      supportEventsByCurrentStatus: ['恢复上线', '完成下线'],
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    const buttons = wrapper.findAll('button').map((button) => button.text());
    expect(buttons).toContain('恢复上线');
    expect(buttons).toContain('完成下线');
    expect(buttons).not.toContain('归档');
    expect(buttons).not.toContain('开始下线');
    wrapper.unmount();
  });
  it('支持事件不能代替实际API权限，缺少权限时隐藏操作', async () => {
    api.denied.add('retire');
    api.retrieve.mockResolvedValue({
      id: 'latest',
      lifecycle: 'Published',
      supportEventsByCurrentStatus: ['开始下线'],
    });
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '打开设计')
      ?.trigger('click');
    await flushPromises();
    expect(
      wrapper.findAll('button').map((button) => button.text()),
    ).not.toContain('开始下线');
    expect(api.retire).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('运行实例入口携带当前定义筛选进入管理页', async () => {
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '运行实例')
      ?.trigger('click');
    expect(api.push).toHaveBeenCalledWith({
      path: '/clob/V1/WorkflowInstance',
      query: { definitionId: 'definition' },
    });
    wrapper.unmount();
  });

  it('没有独立管理查询权限时不显示运行实例入口', async () => {
    api.denied.add('instances');
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    expect(
      wrapper.findAll('button').map((button) => button.text()),
    ).not.toContain('运行实例');
    expect(api.push).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it('首草稿已经创建但详情失败时保留版本选择以恢复设计', async () => {
    api.create.mockResolvedValue('created-definition');
    api.retrieve.mockRejectedValueOnce(new Error('详情暂时不可用'));
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建流程')
      ?.trigger('click');
    const form = wrapper.findComponent(Form);
    const model = form.props('model');
    if (!model) throw new Error('缺少流程表单');
    Object.assign(model, { name: '新审批', businessType: 'request' });
    form.vm.$emit('finish');
    await flushPromises();
    expect(wrapper.text()).toContain('草稿版本已创建，但打开失败');
    wrapper
      .findAllComponents(Select)
      .find((select) => select.attributes('aria-label') === '选择流程版本')
      ?.vm.$emit('change', 'new-draft');
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'WorkflowDefinitionWorkbench' }).exists(),
    ).toBe(true);
    expect(api.createVersion).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
