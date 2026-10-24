/* 测试宿主模拟受控 v-model 的保存往返。 */

import type { WorkflowDesignerOptions } from './types';

import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import { Select } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import WorkflowConditionEditor from './workflow-condition-editor.vue';
import WorkflowGraphCanvas from './workflow-graph-canvas.vue';
import WorkflowTaskDesigner from './workflow-task-designer.vue';
import { createTaskGraph, insertTaskStep } from './workflow-task-graph';

vi.mock('@levin/admin-framework', () => ({
  UserOrgSelector: {
    name: 'UserOrgSelector',
    props: ['modelValue', 'selectedRecords'],
    template: '<div data-user-selector />',
  },
}));
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('测试夹具缺少必需元素');
  return value;
}
function setup(
  readonly = false,
  parallel = false,
  options: WorkflowDesignerOptions = {},
) {
  const original = createTaskGraph(
    {
      businessEntityKey: 'example.Order',
      stateField: 'state',
      stateType: 'integer',
      stateMapping: [
        { value: 0, label: '草稿' },
        { value: 1, label: '审核中' },
      ],
    },
    'order',
    '订单审批',
  );
  const value = ref(
    parallel ? insertTaskStep(original, 'flow_1', 'parallel') : original,
  );
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(WorkflowTaskDesigner, {
          modelValue: value.value,
          readonly,
          options,
          'onUpdate:modelValue': (next) => {
            value.value = next;
          },
        }),
    }),
    {
      global: {
        stubs: { WorkflowGraphCanvas: true, WorkflowNotificationEditor: true },
      },
    },
  );
  return {
    wrapper,
    value,
    designer: wrapper.findComponent(WorkflowTaskDesigner),
    canvas: wrapper.findComponent(WorkflowGraphCanvas),
  };
}
const button = (wrapper: ReturnType<typeof mount>, text: string) =>
  required(
    wrapper.findAll('button').find((item) => item.text().includes(text)),
  );

describe('任务式流程设计器', () => {
  it('加号直接打开四种下一步，插入后自动选中新步骤', async () => {
    const { wrapper, value, canvas } = setup();
    canvas.vm.$emit('addFrom', 'start');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('＋添加下一步');
    expect(wrapper.text()).toContain('按条件分路');
    await button(wrapper, '填写资料、审批、会签').trigger('click');
    expect(value.value.nodes.some((node) => node.type === 'userTask')).toBe(
      true,
    );
    expect(wrapper.text()).toContain('审批方式');
    wrapper.unmount();
  });
  it('拖线后选择新路线，重复连接明确提示且不修改模型', async () => {
    const { wrapper, value, canvas } = setup(false, true);
    const tasks = value.value.nodes.filter((node) => node.type === 'userTask');
    canvas.vm.$emit('connect', required(tasks[0]).id, required(tasks[1]).id);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('流转路线');
    const count = value.value.edges.length;
    canvas.vm.$emit('connect', required(tasks[0]).id, required(tasks[1]).id);
    await wrapper.vm.$nextTick();
    expect(value.value.edges).toHaveLength(count);
    expect(wrapper.text()).toContain('已有流转路线');
    wrapper.unmount();
  });
  it('选择并行结构高亮整组，增加一路自动接回', async () => {
    const { wrapper, value, canvas } = setup(false, true);
    const split = required(value.value.nodes.find((node) => node.joinId));
    canvas.vm.$emit('nodeClick', split.id);
    await wrapper.vm.$nextTick();
    expect(canvas.props('highlightNodeIds')).toHaveLength(4);
    await button(wrapper, '增加一路').trigger('click');
    expect(
      value.value.edges.filter((edge) => edge.target === split.joinId),
    ).toHaveLength(3);
    wrapper.unmount();
  });
  it('只读选择和误触结构事件均不污染已发布图', async () => {
    const { wrapper, value, canvas, designer } = setup(true);
    const before = JSON.stringify(value.value);
    canvas.vm.$emit('addFrom', 'start');
    canvas.vm.$emit('connect', 'start', 'end');
    canvas.vm.$emit('moveNode', 'start', 999, 999);
    await wrapper.vm.$nextTick();
    expect(JSON.stringify(value.value)).toBe(before);
    expect(designer.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });
  it('开始条件只提供业务变量，配置后写入开始节点', async () => {
    const { wrapper, value } = setup();
    const condition = wrapper.findComponent(WorkflowConditionEditor);
    expect(
      Object.keys(condition.props('variables') ?? {}).some((key) =>
        key.startsWith('taskResult_'),
      ),
    ).toBe(false);
    condition.vm.$emit('update:modelValue', {
      eq: [{ literal: 1 }, { literal: 1 }],
    });
    await wrapper.vm.$nextTick();
    expect(
      value.value.nodes.find((node) => node.type === 'start')?.startCondition,
    ).toEqual({ eq: [{ literal: 1 }, { literal: 1 }] });
    expect(wrapper.text()).toContain('启动条件');
    wrapper.unmount();
  });
  it('退回操作有独立目标选择，关闭退回清除残留目标', async () => {
    const { wrapper, value, canvas } = setup();
    let graph = insertTaskStep(value.value, 'flow_1', 'userTask');
    const prepare = required(
      graph.nodes.find((node) => node.type === 'userTask'),
    );
    graph = insertTaskStep(
      graph,
      required(graph.edges.find((edge) => edge.source === prepare.id)).id,
      'userTask',
    );
    const review = required(
      graph.nodes.find(
        (node) => node.type === 'userTask' && node.id !== prepare.id,
      ),
    );
    review.actions = ['approve', 'return'];
    review.returnTargets = [prepare.id];
    value.value = graph;
    canvas.vm.$emit('nodeClick', review.id);
    await wrapper.vm.$nextTick();
    const collapse = wrapper
      .findAll('.ant-collapse-header')
      .find((item) => item.text().includes('办理表单与操作'));
    if (!collapse) throw new Error('缺少办理操作配置');
    await collapse.trigger('click');
    expect(wrapper.text()).toContain('允许退回到');
    expect(wrapper.text()).toContain('驳回是另一个操作');
    const actions = wrapper
      .findAllComponents(Select)
      .find((select) =>
        select.props('options')?.some((option) => option.value === 'return'),
      );
    if (!actions) throw new Error('缺少退回动作选项');
    actions.vm.$emit('update:value', ['approve']);
    await wrapper.vm.$nextTick();
    expect(
      value.value.nodes.find((node) => node.id === review.id)?.returnTargets,
    ).toBeUndefined();
    wrapper.unmount();
  });
  it('无坐标发布图按真实拓扑展示且不改写版本，已有坐标保持不变', async () => {
    const { wrapper, value, canvas, designer } = setup(true);
    const graph = insertTaskStep(value.value, 'flow_1', 'userTask');
    graph.nodes.forEach((node) => {
      delete node.x;
      delete node.y;
    });
    const task = required(graph.nodes.find((node) => node.type === 'userTask'));
    task.x = 777;
    value.value = graph;
    const fingerprint = JSON.stringify(graph);
    await wrapper.vm.$nextTick();
    const positions = canvas.props('nodes');
    const start = required(positions.find((node) => node.id === 'start'));
    const end = required(positions.find((node) => node.id === 'end'));
    expect(start.x).toBe(60);
    expect(end.x).toBe(660);
    expect(positions.find((node) => node.id === task.id)?.x).toBe(777);
    expect(
      positions.every(
        (node) => typeof node.x === 'number' && typeof node.y === 'number',
      ),
    ).toBe(true);
    expect(JSON.stringify(value.value)).toBe(fingerprint);
    expect(designer.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });

  it('自动状态更新在图上显示业务字段中文标题', async () => {
    const { wrapper, value, canvas } = setup(true, false, {
      stateBusinessObjects: [
        {
          entityKey: 'example.Order',
          title: '订单',
          provider: 'jpa',
          selectable: true,
          fields: [
            {
              key: 'state',
              title: '审批状态',
              type: 'integer',
              nullable: false,
              stateFieldAllowed: true,
            },
          ],
        },
      ],
    });
    const graph = insertTaskStep(value.value, 'flow_1', 'serviceTask');
    const task = required(
      graph.nodes.find((node) => node.type === 'serviceTask'),
    );
    task.targetState = 1;
    value.value = graph;
    await wrapper.vm.$nextTick();
    expect(
      canvas.props('nodes').find((node) => node.id === task.id)?.stateLabel,
    ).toBe('审批状态 → 审核中');
    wrapper.unmount();
  });
  it('关闭再开启驳回不会复活旧操作表单字段，序列化草稿不含孤立表单', async () => {
    const { wrapper, value, canvas } = setup();
    const graph = insertTaskStep(value.value, 'flow_1', 'userTask');
    const task = required(graph.nodes.find((node) => node.type === 'userTask'));
    task.actions = ['approve', 'reject'];
    task.editableFields = ['reason'];
    task.actionForms = {
      approve: { editableFields: [] },
      reject: { editableFields: ['reason'], requiredFields: ['reason'] },
    };
    value.value = graph;
    canvas.vm.$emit('nodeClick', task.id);
    await wrapper.vm.$nextTick();
    const collapse = required(
      wrapper
        .findAll('.ant-collapse-header')
        .find((item) => item.text().includes('办理表单与操作')),
    );
    await collapse.trigger('click');
    const actions = required(
      wrapper
        .findAllComponents(Select)
        .find((select) =>
          select.props('options')?.some((option) => option.value === 'return'),
        ),
    );
    actions.vm.$emit('update:value', ['approve']);
    await wrapper.vm.$nextTick();
    const requestBody = JSON.stringify(value.value);
    const saved = JSON.parse(requestBody) as typeof graph;
    expect(
      Object.keys(
        required(saved.nodes.find((node) => node.id === task.id)).actionForms ??
          {},
      ),
    ).toEqual(['approve']);
    actions.vm.$emit('update:value', ['approve', 'reject']);
    await wrapper.vm.$nextTick();
    expect(
      value.value.nodes.find((node) => node.id === task.id)?.actionForms
        ?.reject,
    ).toBeUndefined();
    wrapper.unmount();
  });
});
