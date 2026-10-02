import { flushPromises, mount } from '@vue/test-utils';

import { Form, Select } from 'ant-design-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowDefinitionPage from '../views/workflow-definition/index.vue';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  versions: vi.fn(),
  retrieve: vi.fn(),
  catalog: vi.fn(),
  create: vi.fn(),
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
    create: api.create,
    saveDraft: api.saveDraft,
    startSimulation: api.startSimulation,
    publishAfterSimulation: api.publishAfterSimulation,
  },
}));
vi.mock('../api/workflow-runtime-service', () => ({
  workflowRuntimeService: { catalog: api.catalog },
}));
vi.mock('../api/workflow-candidate-service', () => ({
  loadWorkflowCandidates: async () => ({ users: [], groups: [] }),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({ buildApiMethodPermissions: () => [] }),
);
vi.mock('@levin/bpm-designer', () => ({
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
}));

describe('流程设计宿主的版本恢复', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    wrapper.findAllComponents(Select)[0]?.vm.$emit('change', 'definition');
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
    wrapper.findAllComponents(Select)[0]?.vm.$emit('change', 'definition');
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

  it('同一对象多个业务方案时不自动绑定最高契约', async () => {
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
    wrapper.findAllComponents(Select)[0]?.vm.$emit('change', 'definition');
    await flushPromises();
    expect(
      wrapper
        .findComponent({ name: 'WorkflowDefinitionWorkbench' })
        .props('definition').businessBinding,
    ).toBeUndefined();
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
    wrapper.findAllComponents(Select)[0]?.vm.$emit('change', 'definition');
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
    wrapper.findAllComponents(Select)[0]?.vm.$emit('change', 'definition');
    await flushPromises();
    wrapper.findAllComponents(Select)[1]?.vm.$emit('change', 'older');
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
    wrapper.findAllComponents(Select)[0]?.vm.$emit('change', 'definition');
    await flushPromises();

    expect(wrapper.text()).toContain('仅支持第三版流程树');
    expect(
      wrapper.findComponent({ name: 'WorkflowDefinitionWorkbench' }).exists(),
    ).toBe(false);
    expect(api.saveDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
