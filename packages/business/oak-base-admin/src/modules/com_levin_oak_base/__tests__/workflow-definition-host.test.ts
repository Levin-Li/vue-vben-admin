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
    props: ['version', 'definition'],
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

  it('稳定定义新增表单不再要求或伪保存版本用途', async () => {
    const wrapper = mount(WorkflowDefinitionPage);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新建流程定义')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.findComponent(Form).props('model')).toEqual({
      name: '',
      processKey: '',
      businessType: '',
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
