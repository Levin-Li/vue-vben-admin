import { mount } from '@vue/test-utils';

import { WorkflowGraphCanvas } from '@levin/bpm-designer';
import { describe, expect, it } from 'vitest';

import WorkflowProcessDiagram from './workflow-process-diagram.vue';

describe('流程图真实组件', () => {
  it('无坐标投影按真实拓扑排布，保留已有坐标且不改服务端对象', () => {
    const sourceNodes = [
      { id: 's', name: '开始', type: 'start' },
      { id: 'a', name: '人工办理', type: 'userTask' },
      { id: 'e', name: '结束', type: 'end', x: 999, y: 888 },
    ];
    const original = JSON.stringify(sourceNodes);
    const wrapper = mount(WorkflowProcessDiagram, {
      props: {
        task: {
          processSchemaVersion: 5,
          processDiagramNodes: sourceNodes,
          processDiagramEdges: [
            { id: 'a', source: 's', target: 'a' },
            { id: 'b', source: 'a', target: 'e' },
          ],
        },
      },
    });
    const arranged = wrapper.findComponent(WorkflowGraphCanvas).props('nodes');
    expect(arranged[0]?.x).toBeLessThan(arranged[1]?.x ?? 0);
    expect(arranged[2]).toMatchObject({ x: 999, y: 888 });
    expect(JSON.stringify(sourceNodes)).toBe(original);
    wrapper.unmount();
  });

  it('真实响应的null或非法进度不显示为数量，合法零计数仍可展示', () => {
    const wrapper = mount(WorkflowProcessDiagram, {
      props: {
        task: {
          processSchemaVersion: 5,
          processDiagramNodes: [
            {
              id: 's',
              name: '开始',
              type: 'start',
              completedCount: null,
              totalCount: null,
              waitingCount: null,
            },
            {
              id: 'bad',
              name: '等待汇合',
              type: 'parallelGateway',
              completedCount: -1,
              totalCount: 1.5,
              waitingCount: Number.POSITIVE_INFINITY,
            },
            {
              id: 'u',
              name: '审批',
              type: 'userTask',
              completedCount: 0,
              totalCount: 2,
              waitingCount: 2,
            },
            {
              id: 'e',
              name: '结束',
              type: 'end',
              completedCount: null,
              totalCount: null,
            },
          ],
          processDiagramEdges: [
            { id: 'a', source: 's', target: 'bad' },
            { id: 'b', source: 'bad', target: 'u' },
            { id: 'c', source: 'u', target: 'e' },
          ],
        },
      },
    });
    expect(wrapper.text()).not.toContain('null');
    expect(wrapper.text()).not.toContain('Infinity');
    expect(wrapper.text()).not.toContain('已完成 -1');
    expect(wrapper.text()).toContain('已完成 0／2');
    wrapper.unmount();
  });

  it('第五版任务图保留多入边和回路，不降级为第三版树或第四版业务状态节点', () => {
    const wrapper = mount(WorkflowProcessDiagram, {
      props: {
        task: {
          processSchemaVersion: 5,
          processDiagramNodes: [
            { id: 'start', name: '开始', type: 'start', status: 'completed' },
            {
              id: 'review',
              name: '财务会签',
              type: 'userTask',
              status: 'active',
              completedCount: 1,
              totalCount: 3,
              waitingCount: 2,
            },
            {
              id: 'join',
              name: '等待全部完成',
              type: 'parallelGateway',
              status: 'pending',
            },
            { id: 'end', name: '结束', type: 'end', status: 'pending' },
          ],
          processDiagramEdges: [
            { id: 's-r', source: 'start', target: 'review' },
            { id: 'r-s', source: 'review', target: 'start' },
            { id: 'r-j', source: 'review', target: 'join' },
            { id: 'j-e', source: 'join', target: 'end' },
          ],
        },
      },
    });
    expect(wrapper.findAll('[data-edge-id]')).toHaveLength(4);
    expect(wrapper.text()).not.toContain('结构不完整');
    expect(wrapper.find('[data-edge-id="r-s"]').exists()).toBe(true);
    expect(wrapper.find('[data-flow-design]').exists()).toBe(false);
    expect(wrapper.text()).toContain('已完成 1／3');
    expect(wrapper.text()).toContain('等待 2 人办理');
    wrapper.unmount();
  });

  it('状态图保留共享目标和回环，并禁用全部设计操作', async () => {
    // 只使用授权投影；图中没有业务条件正文或人员配置。
    const wrapper = mount(WorkflowProcessDiagram, {
      props: {
        task: {
          processDiagramNodes: [
            { id: 'draft', name: '待申请', type: 'state', status: 'completed' },
            { id: 'review', name: '审批中', type: 'state', status: 'active' },
            {
              id: 'cancelled',
              name: '已取消',
              type: 'state',
              status: 'pending',
            },
          ],
          processDiagramEdges: [
            { id: 'submit', source: 'draft', target: 'review' },
            { id: 'back', source: 'review', target: 'draft' },
            { id: 'cancel1', source: 'draft', target: 'cancelled' },
            { id: 'cancel2', source: 'review', target: 'cancelled' },
          ],
        },
      },
    });
    expect(wrapper.findAll('[data-node-id="cancelled"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-edge-id]')).toHaveLength(4);
    expect(wrapper.find('[data-node-id="review"]').text()).toContain('进行中');
    expect(wrapper.text()).not.toContain('结构不完整');
    expect(wrapper.findAll('.add-node')).toHaveLength(0);
    expect(
      wrapper
        .findAll('.node-select')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
    expect(wrapper.find('[data-edge-id="back"]').exists()).toBe(true);
    wrapper.unmount();
  });

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
