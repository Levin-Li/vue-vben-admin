import type { WorkflowStateBinding } from './workflow-state-graph';

import { describe, expect, it } from 'vitest';

import {
  createStateGraph,
  sameState,
  validateStateGraph,
} from './workflow-state-graph';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('测试夹具缺少已声明元素');
  return value;
}

const binding: WorkflowStateBinding = {
  businessEntityKey: 'example.Order',
  stateField: 'state',
  stateType: 'integer',
  stateMapping: [
    { value: 0, label: '待提交' },
    { value: 1, label: '审批中' },
    { value: 2, label: '已结束' },
  ],
};
function graph() {
  const graph = createStateGraph(structuredClone(binding), 'order', '订单流程');
  graph.events = [
    { id: 'submit', title: '提交', trigger: 'manual' },
    { id: 'cancel', title: '取消', trigger: 'manual' },
    { id: 'return', title: '退回', trigger: 'manual' },
  ];
  graph.nodes = graph.businessBinding.stateMapping.map((state, index) => ({
    id: `state_${index + 1}`,
    name: state.label,
    stateValue: state.value,
    x: 60 + index * 320,
    y: 100,
  }));
  required(graph.nodes[2]).terminal = true;
  required(graph.nodes[2]).outcome = 'Withdrawn';
  graph.edges = [
    { id: 'a', source: 'state_1', event: 'submit', target: 'state_2' },
    { id: 'b', source: 'state_1', event: 'cancel', target: 'state_3' },
    { id: 'c', source: 'state_2', event: 'cancel', target: 'state_3' },
    { id: 'd', source: 'state_2', event: 'return', target: 'state_1' },
  ];
  return graph;
}
describe('第四版真实状态图', () => {
  it('多条路径共享同一个结束节点并保留回环，序列化后不复制节点', () => {
    const value = structuredClone(graph());
    expect(validateStateGraph(value)).toEqual([]);
    expect(value.nodes).toHaveLength(3);
    expect(
      value.edges.filter(
        (edge: { target: string }) => edge.target === 'state_3',
      ),
    ).toHaveLength(2);
    expect(
      value.edges.some((edge: { target: string }) => edge.target === 'state_1'),
    ).toBe(true);
  });
  it('节点不能引用映射外状态，整数与字符串不混用', () => {
    const value = graph();
    required(value.nodes[1]).stateValue = '1';
    expect(validateStateGraph(value)).toContain('「审批中」引用了未定义状态。');
    expect(sameState(1, '1')).toBe(false);
  });
  it('字段映射不接受重复值或不匹配的数字类型', () => {
    const value = graph();
    value.businessBinding.stateMapping.push({ value: 1, label: '重复' });
    expect(validateStateGraph(value)).toContain(
      '状态值不能重复，状态名称不能为空。',
    );
    required(value.businessBinding.stateMapping[0]).value = '0';
    expect(validateStateGraph(value)).toContain('状态值与绑定字段类型不一致。');
  });
  it('只有开始节点能设置启动条件，路由引用必须是真实事件与节点', () => {
    const value = graph();
    required(value.nodes[1]).startCondition = {
      eq: [{ variable: 'amount' }, { literal: 1 }],
    };
    required(value.edges[0]).event = 'missing';
    expect(validateStateGraph(value)).toContain('只有开始节点可设置启动条件。');
    expect(validateStateGraph(value)).toContain('请为每条路线选择事件。');
  });
  it('没有配置人员的单人审批不能通过发布前检查', () => {
    const value = graph();
    required(value.nodes[1]).approval = {
      mode: 'NONE',
      candidateUsers: [],
      candidateGroups: [],
    };
    expect(validateStateGraph(value)).toContain(
      '「审批中」请选择办理人或角色。',
    );
    expect(validateStateGraph(value, true)).not.toContain(
      '「审批中」请选择办理人或角色。',
    );
  });
});
