import type { WorkflowBusinessType, WorkflowDefinitionVersion } from './types';

import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import { createTreeDefinition } from './definition-model';
import WorkflowDefinitionWorkbench from './workflow-definition-workbench.vue';
import { WorkflowDesignerService } from './workflow-designer-service';

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    constructor(readonly basePath: string) {}
  },
}));

const button = {
  props: ['disabled'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
};
const box = { template: '<div><slot /><slot name="description" /></div>' };
const global = {
  stubs: {
    AButton: button,
    AAlert: {
      props: ['message'],
      template: '<div>{{ message }}<slot name="description" /></div>',
    },
    ACard: box,
    ASpace: box,
    ADescriptions: box,
    ADescriptionsItem: box,
    APopconfirm: box,
  },
};
function setup(lifecycle: WorkflowDefinitionVersion['lifecycle'] = 'Draft') {
  const definition = createTreeDefinition('review', '审核');
  definition.purposeKey = 'review';
  definition.businessBinding = {
    businessType: 'request',
    contractVersion: '1',
    identityField: 'id',
    titleField: 'title',
  };
  const service = new WorkflowDesignerService();
  const options = {
    businessTypes: [
      {
        businessType: 'request',
        contractVersion: '1',
        title: '申请',
        fields: {
          id: { title: '编号', type: 'string' as const },
          title: { title: '标题', type: 'string' as const },
        },
      },
    ],
  };
  return {
    definition,
    options,
    service,
    version: {
      id: 'v1',
      lifecycle,
      optimisticLock: 4,
      lowflowDefinition: structuredClone(definition),
      simulationReport: { successful: true },
    } as WorkflowDefinitionVersion,
  };
}

describe('流程定义工作台', () => {
  it('切换目录服务时立即移除旧授权选项，失败后也不回显旧目录', async () => {
    const props = setup('Testing');
    const initialCatalog = props.options.businessTypes;
    vi.spyOn(props.service, 'listBusinessTypes').mockResolvedValue(
      initialCatalog,
    );
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props: { ...props, options: {} },
      global,
    });
    await flushPromises();
    expect(wrapper.find('option[value="request"]').exists()).toBe(true);

    let rejectCatalog: (reason?: unknown) => void = () => {};
    const pendingCatalog = new Promise<WorkflowBusinessType[]>((_, reject) => {
      rejectCatalog = reject;
    });
    const switchedService = new WorkflowDesignerService();
    vi.spyOn(switchedService, 'listBusinessTypes').mockReturnValue(
      pendingCatalog,
    );
    await wrapper.setProps({ service: switchedService });
    expect(wrapper.find('option[value="request"]').exists()).toBe(false);

    rejectCatalog(new Error('新目录无权限'));
    await flushPromises();
    expect(wrapper.find('option[value="request"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('新目录无权限');
  });

  it('目录请求失败时保留草稿并阻断模拟与发布', async () => {
    const props = setup('Testing');
    vi.spyOn(props.service, 'listBusinessTypes').mockRejectedValue(
      new Error('目录暂不可用'),
    );
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props: { ...props, options: {} },
      global,
    });
    await flushPromises();

    expect(wrapper.text()).toContain('目录暂不可用');
    expect(wrapper.get('input').element.value).toBe('审核');
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '发布')
        ?.attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '执行检查')
        ?.attributes('disabled'),
    ).toBeDefined();
  });

  it('草稿引用未授权结果动作时显示问题并阻断发布', async () => {
    const props = setup('Testing');
    props.definition.outcomeActions = {
      Approved: [{ action: 'unlisted' }],
    };
    props.version.lowflowDefinition = structuredClone(props.definition);
    const wrapper = mount(WorkflowDefinitionWorkbench, { props, global });
    await flushPromises();

    expect(wrapper.text()).toContain('操作「已配置项」不在当前业务方案');
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '发布')
        ?.attributes('disabled'),
    ).toBeDefined();
  });

  it('旧 v2 响应失败关闭，不开放保存模拟或发布', async () => {
    const props = setup('Testing');
    props.version.lowflowDefinition = {
      schemaVersion: 2,
      nodes: [],
      edges: [],
    } as unknown as NonNullable<WorkflowDefinitionVersion['lowflowDefinition']>;
    const wrapper = mount(WorkflowDefinitionWorkbench, { props, global });
    await flushPromises();
    expect(wrapper.text()).toContain('只接受 schemaVersion=3');
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '保存草稿')
        ?.attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '执行检查')
        ?.attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '发布')
        ?.attributes('disabled'),
    ).toBeDefined();
  });
  it('模拟报告分别显示覆盖任务和真实分支连线', async () => {
    const props = setup('Testing');
    props.version.simulationReport = {
      successful: true,
      coveredTaskKeys: ['review'],
      coveredBranches: ['choice_approved', 'choice_rejected'],
      uncoveredBranches: [],
    };
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props,
      global: {
        stubs: {
          ...global.stubs,
          ADescriptionsItem: {
            props: ['label'],
            template: '<div>{{ label }}<slot /></div>',
          },
        },
      },
    });
    await flushPromises();

    // 分支列表来自引擎实际出口边；串行任务节点另列，不能再冒充分支覆盖。
    expect(wrapper.text()).toContain('已检查审批步骤1 个');
    expect(wrapper.text()).toContain('已检查路线2 个');
    expect(wrapper.text()).not.toContain('choice_approved');
    expect(wrapper.text()).not.toContain('choice_rejected');
  });

  it('缺少分支覆盖字段的旧报告显示未记录，不冒充无分支', async () => {
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props: setup('Published'),
      global: {
        stubs: {
          ...global.stubs,
          ADescriptionsItem: {
            props: ['label'],
            template: '<div>{{ label }}<slot /></div>',
          },
        },
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('已检查路线未记录');
    expect(wrapper.text()).toContain('待检查路线未记录');
  });

  it('已发布版本展示中文生命周期且继续保持只读', async () => {
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props: setup('Published'),
      global,
    });
    await flushPromises();
    expect(wrapper.text()).toContain('当前版本：已发布');
    expect(wrapper.text()).not.toContain('当前版本：Published');
    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
  });
  it('编辑Testing配置立即禁用旧模拟证明的发布资格', async () => {
    const props = setup('Testing');
    props.definition.name = '已修改审核';
    const wrapper = mount(WorkflowDefinitionWorkbench, { props, global });
    await flushPromises();
    expect(wrapper.findAll('button').map((item) => item.text())).toEqual(
      expect.arrayContaining(['发布', '保存草稿']),
    );
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '发布')
        ?.attributes('disabled'),
    ).toBeDefined();
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '保存草稿')
        ?.attributes('disabled'),
    ).toBeUndefined();
  });

  it('保存失败保留输入并携带乐观锁', async () => {
    const props = setup();
    props.definition.name = '尚未保存';
    const save = vi
      .spyOn(props.service, 'saveDraft')
      .mockRejectedValue(new Error('版本已被修改'));
    const wrapper = mount(WorkflowDefinitionWorkbench, { props, global });
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '保存草稿')
      ?.trigger('click');
    await flushPromises();
    expect(save).toHaveBeenCalledWith('v1', props.definition, 4);
    expect(wrapper.text()).toContain('版本已被修改');
    expect(wrapper.emitted('update:definition')).toBeUndefined();
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe(
      '尚未保存',
    );
  });

  it('保存响应若回退为 v2 或缺失固定树，不覆盖当前草稿', async () => {
    const props = setup();
    props.definition.name = '尚未保存';
    vi.spyOn(props.service, 'saveDraft').mockResolvedValue({
      ...props.version,
      lowflowDefinition: {
        schemaVersion: 2,
        nodes: [],
        edges: [],
      } as unknown as NonNullable<
        WorkflowDefinitionVersion['lowflowDefinition']
      >,
    });
    const wrapper = mount(WorkflowDefinitionWorkbench, { props, global });
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '保存草稿')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('只接受 schemaVersion=3');
    expect(wrapper.emitted('refreshed')).toBeUndefined();
    expect(wrapper.emitted('update:definition')).toBeUndefined();
  });

  it('宿主拒绝操作权限时不展示对应动作', async () => {
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props: {
        ...setup(),
        permissions: { save: false, simulate: false, publish: false },
      },
      global,
    });
    await flushPromises();
    const labels = wrapper.findAll('button').map((item) => item.text());
    expect(labels).not.toContain('保存草稿');
    expect(labels).not.toContain('执行检查');
    expect(labels).not.toContain('发布');
  });

  it('按当前版本显示历史报告与轨迹，禁止无权请求', async () => {
    const props = setup('Testing');
    const history = vi
      .spyOn(props.service, 'simulationRuns')
      .mockResolvedValue({
        items: [
          {
            id: 'run-1',
            status: 'Passed',
            finishedTime: '2026-10-02T10:00:00',
          },
        ],
        totals: 1,
      });
    const detail = vi.spyOn(props.service, 'simulationRun').mockResolvedValue({
      id: 'run-1',
      status: 'Passed',
      coverageReport: { coveredTaskKeys: ['approve'] },
      executionTrace: { mode: 'TEST', visitedNodes: ['approve'] },
    });
    const wrapper = mount(WorkflowDefinitionWorkbench, { props, global });
    await flushPromises();
    expect(history).toHaveBeenCalledWith('v1', 1);
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '查看检查结果')
      ?.trigger('click');
    await flushPromises();
    expect(detail).toHaveBeenCalledWith('v1', 'run-1');
    expect(wrapper.text()).toContain('visitedNodes');
    await wrapper.setProps({ permissions: { viewSimulation: false } });
    await flushPromises();
    expect(wrapper.text()).not.toContain('visitedNodes');
    expect(history).toHaveBeenCalledTimes(1);
  });

  it('删除当前模拟证明后立即关闭发布，并刷新历史', async () => {
    const props = setup('Testing');
    props.version.simulationReport = { runId: 'run-current', successful: true };
    const history = vi
      .spyOn(props.service, 'simulationRuns')
      .mockResolvedValueOnce({
        items: [{ id: 'run-current', status: 'Passed' }],
        totals: 1,
      })
      .mockResolvedValue({ items: [], totals: 0 });
    const deletion = vi
      .spyOn(props.service, 'deleteSimulationRun')
      .mockResolvedValue(undefined);
    const wrapper = mount(WorkflowDefinitionWorkbench, {
      props,
      global: {
        ...global,
        stubs: {
          ...global.stubs,
          APopconfirm: {
            emits: ['confirm'],
            template:
              '<div><slot /><button @click="$emit(\'confirm\')">确认删除</button></div>',
          },
        },
      },
    });
    await flushPromises();
    expect(
      wrapper
        .findAll('button')
        .find((item) => item.text() === '发布')
        ?.attributes('disabled'),
    ).toBeUndefined();
    await wrapper
      .findAll('button')
      .findLast((item) => item.text() === '确认删除')
      ?.trigger('click');
    await flushPromises();
    expect(deletion).toHaveBeenCalledWith('v1', 'run-current');
    expect(history).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted('refreshed')?.[0]?.[0]).toMatchObject({
      id: 'v1',
      simulationReport: undefined,
    });
  });
});
