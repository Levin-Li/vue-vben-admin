import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import WorkflowProcessDiagram from './workflow-process-diagram.vue';

describe('流程图真实组件', () => {
  it('并行网关的合成分支展示并行支路，不误称条件分支', () => {
    const wrapper = mount(WorkflowProcessDiagram, {
      props: {
        task: {
          processDiagramNodes: [
            { id: 'start', name: '开始', type: 'start', status: 'completed' },
            {
              id: 'fork',
              name: '并行分叉',
              type: 'parallelGateway',
              status: 'completed',
            },
            {
              id: 'left',
              name: '审批甲',
              type: 'userTask',
              status: 'completed',
            },
            {
              id: 'right',
              name: '审批乙',
              type: 'userTask',
              status: 'completed',
            },
            {
              id: 'join',
              name: '并行汇聚',
              type: 'parallelGateway',
              status: 'completed',
            },
            { id: 'end', name: '结束', type: 'end', status: 'completed' },
          ],
          processDiagramEdges: [
            { id: 's_f', source: 'start', target: 'fork' },
            { id: 'f_l', source: 'fork', target: 'left' },
            { id: 'f_r', source: 'fork', target: 'right' },
            { id: 'l_j', source: 'left', target: 'join' },
            { id: 'r_j', source: 'right', target: 'join' },
            { id: 'j_e', source: 'join', target: 'end' },
          ],
        },
      },
    });

    expect(wrapper.text()).toContain('并行支路');
    expect(wrapper.text()).not.toContain('条件分支');
    wrapper.unmount();
  });

  it('显示分支汇聚真实边和五类状态，不改变排他未选节点语义', () => {
    const wrapper = mount(WorkflowProcessDiagram, {
      props: {
        task: {
          taskId: 't1',
          processDiagramNodes: [
            { id: 'start', name: '开始', status: 'completed', type: 'start' },
            {
              id: 'gateway',
              name: '审核条件',
              status: 'completed',
              type: 'exclusiveGateway',
            },
            { id: 'a', name: '部门审批', status: 'active', type: 'userTask' },
            { id: 'b', name: '财务审批', status: 'skipped', type: 'userTask' },
            {
              id: 'c',
              name: '已撤销任务',
              status: 'cancelled',
              type: 'userTask',
            },
            { id: 'end', name: '结束', status: 'pending', type: 'end' },
          ],
          processDiagramEdges: [
            { id: 'e1', source: 'start', target: 'gateway' },
            { id: 'e2', source: 'gateway', target: 'a' },
            { id: 'e3', source: 'gateway', target: 'b' },
            { id: 'e4', source: 'gateway', target: 'c' },
            { id: 'e5', source: 'a', target: 'end' },
            { id: 'e6', source: 'b', target: 'end' },
            { id: 'e7', source: 'c', target: 'end' },
          ],
        },
      },
    });
    expect(wrapper.findAll('[data-edge-id]')).toHaveLength(7);
    expect(wrapper.find('[data-flow-design]').exists()).toBe(true);
    expect(wrapper.find('[data-source="a"][data-target="b"]').exists()).toBe(
      false,
    );
    for (const [id, label] of [
      ['b', '已跳过'],
      ['c', '已取消'],
      ['a', '进行中'],
      ['end', '待执行'],
      ['start', '已完成'],
    ])
      expect(wrapper.find(`[data-node-id="${id}"]`).text()).toContain(label);
    wrapper.unmount();
  });

  it('只有节点时不给出执行箭头，并明确说明图示不含顺序', () => {
    const wrapper = mount(WorkflowProcessDiagram, {
      props: {
        task: {
          taskId: 't1',
          processDiagramNodes: [
            { id: 'a', name: '节点一' },
            { id: 'b', name: '节点二' },
          ],
        },
      },
    });
    expect(wrapper.findAll('[data-edge-id]')).toHaveLength(0);
    expect(wrapper.text()).toContain('不表示执行顺序');
    expect(wrapper.findAll('[data-node-id]')).toHaveLength(2);
    wrapper.unmount();
  });
});
