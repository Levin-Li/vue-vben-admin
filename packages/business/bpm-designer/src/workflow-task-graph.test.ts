import { describe, expect, it } from 'vitest';

import {
  addParallelBranch,
  addTaskResultBranches,
  connectTaskNodes,
  createTaskGraph,
  eligibleTaskReturnTargets,
  insertTaskStep,
  removeTaskNode,
  validateTaskGraph,
} from './workflow-task-graph';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('测试夹具缺少必需元素');
  return value;
}
const binding = {
  businessEntityKey: 'example.Order',
  stateField: 'state',
  stateType: 'integer' as const,
  stateMapping: [
    { value: 0, label: '草稿' },
    { value: 1, label: '审核中' },
  ],
};
const initial = () => createTaskGraph(binding, 'order', '订单审批');

describe('任务图便捷编辑', () => {
  it('初始图有明确开始结束，且不隐含更改业务状态', () => {
    const graph = initial();
    expect(graph.schemaVersion).toBe(5);
    expect(graph.nodes.map((node) => node.type)).toEqual(['start', 'end']);
    expect(graph.edges).toHaveLength(1);
    expect(validateTaskGraph(graph)).toEqual([]);
    required(graph.businessBinding.stateMapping[0]).label = '变更';
    expect(required(binding.stateMapping[0]).label).toBe('草稿');
  });
  it('在线路中插入任务保留路线条件且不修改父图', () => {
    const original = initial();
    required(original.edges[0]).condition = {
      eq: [{ literal: 1 }, { literal: 1 }],
    };
    const graph = insertTaskStep(
      original,
      required(original.edges[0]).id,
      'userTask',
    );
    expect(original.nodes).toHaveLength(2);
    expect(graph.nodes).toHaveLength(3);
    const task = required(graph.nodes.find((node) => node.type === 'userTask'));
    expect(task.targetState).toBeUndefined();
    expect(required(graph.edges[0]).condition).toEqual(
      required(original.edges[0]).condition,
    );
    expect(
      graph.edges.some(
        (edge) => edge.source === task.id && edge.target === 'end',
      ),
    ).toBe(true);
  });
  it('同时办理一次生成拆分、两条任务分支及配对汇合，增加一路自动接回', () => {
    let graph = insertTaskStep(initial(), 'flow_1', 'parallel');
    const split = required(graph.nodes.find((node) => node.joinId));
    expect(graph.nodes.filter((node) => node.type === 'userTask')).toHaveLength(
      2,
    );
    expect(graph.nodes.find((node) => node.id === split.joinId)?.type).toBe(
      'parallelGateway',
    );
    graph = addParallelBranch(graph, split.id);
    expect(graph.edges.filter((edge) => edge.source === split.id)).toHaveLength(
      3,
    );
    expect(
      graph.edges.filter((edge) => edge.target === split.joinId),
    ).toHaveLength(3);
    const branch = required(
      graph.edges.find((edge) => edge.source === split.id),
    );
    expect(() => insertTaskStep(graph, branch.id, 'serviceTask')).toThrow(
      '汇合后',
    );
    graph = insertTaskStep(graph, branch.id, 'userTask');
    expect(
      graph.edges.filter((edge) => edge.target === split.joinId),
    ).toHaveLength(3);
    expect(graph.nodes.filter((node) => node.type === 'userTask')).toHaveLength(
      4,
    );
  });
  it('条件分路有条件出口及明确默认路线', () => {
    const graph = insertTaskStep(initial(), 'flow_1', 'condition');
    const split = required(
      graph.nodes.find((node) => node.type === 'exclusiveGateway'),
    );
    const routes = graph.edges.filter((edge) => edge.source === split.id);
    expect(routes).toHaveLength(2);
    expect(routes.filter((edge) => edge.default)).toHaveLength(1);
    expect(validateTaskGraph(graph).join(',')).toContain('设置条件');
  });
  it('拒绝结束连出、开始连入、重复及自身路线', () => {
    expect(() => connectTaskNodes(initial(), 'end', 'start')).toThrow();
    expect(() => connectTaskNodes(initial(), 'start', 'end')).toThrow();
    expect(() => connectTaskNodes(initial(), 'start', 'start')).toThrow();
  });
  it('删除普通任务自动接回后续，结构节点必须整组处理', () => {
    const graph = insertTaskStep(initial(), 'flow_1', 'userTask');
    const id = required(
      graph.nodes.find((node) => node.type === 'userTask'),
    ).id;
    expect(removeTaskNode(graph, id).nodes).toHaveLength(2);
    expect(() => removeTaskNode(graph, 'start')).toThrow();
    const parallel = insertTaskStep(initial(), 'flow_1', 'parallel');
    expect(() =>
      removeTaskNode(
        parallel,
        required(parallel.nodes.find((node) => node.joinId)).id,
      ),
    ).toThrow();
  });
  it('通过驳回模板明确按本任务结果分路，默认普通任务不提供无去向的驳回', () => {
    const draft = insertTaskStep(initial(), 'flow_1', 'userTask');
    const task = required(draft.nodes.find((node) => node.type === 'userTask'));
    expect(task.actions).toEqual(['approve']);
    const graph = addTaskResultBranches(draft, task.id);
    expect(
      graph.nodes.find((node) => node.outcome === 'Rejected'),
    ).toBeDefined();
    expect(graph.edges.find((edge) => edge.name === '驳回')?.condition).toEqual(
      { eq: [{ variable: `taskResult_${task.id}` }, { literal: 'Rejected' }] },
    );
    expect(draft.nodes).toHaveLength(3);
  });
  it('草稿容许未配办理人与条件，发布检查仍指出缺项', () => {
    const graph = insertTaskStep(initial(), 'flow_1', 'condition');
    expect(validateTaskGraph(graph, true)).toEqual([]);
    expect(validateTaskGraph(graph).join(',')).toContain('办理人');
  });
  it('退回只列出必经前置单人任务，排除条件分支中未必经过的任务', () => {
    let graph = insertTaskStep(initial(), 'flow_1', 'userTask');
    const prepare = required(
      graph.nodes.find((node) => node.type === 'userTask'),
    );
    graph = insertTaskStep(
      graph,
      required(graph.edges.find((edge) => edge.source === prepare.id)).id,
      'condition',
    );
    const merge = required(
      graph.nodes.find(
        (node) =>
          node.type === 'exclusiveGateway' &&
          graph.edges.filter((edge) => edge.target === node.id).length > 1,
      ),
    );
    graph = insertTaskStep(
      graph,
      required(graph.edges.find((edge) => edge.source === merge.id)).id,
      'userTask',
    );
    const review = required(
      graph.nodes.find(
        (node) =>
          node.type === 'userTask' &&
          graph.edges.some(
            (edge) => edge.source === merge.id && edge.target === node.id,
          ),
      ),
    );
    expect(
      eligibleTaskReturnTargets(graph, review.id).map((node) => node.id),
    ).toEqual([prepare.id]);
    review.multiApprovalMode = 'ALL';
    expect(eligibleTaskReturnTargets(graph, review.id)).toEqual([]);
  });
  it('并行之前的任务不能从汇合之后退回，单分支内部可以退回', () => {
    let graph = insertTaskStep(initial(), 'flow_1', 'userTask');
    const prepare = required(
      graph.nodes.find((node) => node.type === 'userTask'),
    );
    graph = insertTaskStep(
      graph,
      required(graph.edges.find((edge) => edge.source === prepare.id)).id,
      'parallel',
    );
    const split = required(graph.nodes.find((node) => node.joinId));
    const branch = required(
      graph.edges.find((edge) => edge.source === split.id),
    );
    const first = required(
      graph.nodes.find((node) => node.id === branch.target),
    );
    graph = insertTaskStep(
      graph,
      required(graph.edges.find((edge) => edge.source === first.id)).id,
      'userTask',
    );
    const second = required(
      graph.nodes.find(
        (node) =>
          node.type === 'userTask' &&
          graph.edges.some(
            (edge) => edge.source === first.id && edge.target === node.id,
          ),
      ),
    );
    expect(
      eligibleTaskReturnTargets(graph, second.id).map((node) => node.id),
    ).toEqual([first.id]);
    graph = insertTaskStep(
      graph,
      required(graph.edges.find((edge) => edge.source === split.joinId)).id,
      'userTask',
    );
    const after = required(
      graph.nodes.find((node) =>
        graph.edges.some(
          (edge) => edge.source === split.joinId && edge.target === node.id,
        ),
      ),
    );
    expect(eligibleTaskReturnTargets(graph, after.id)).toEqual([]);
  });
  it('退回目标必须和动作成对配置，普通驳回不会被当作退回', () => {
    const graph = insertTaskStep(initial(), 'flow_1', 'userTask');
    const task = required(graph.nodes.find((node) => node.type === 'userTask'));
    task.actions = ['approve', 'return'];
    expect(validateTaskGraph(graph).join(',')).toContain(
      '退回操作必须配置目标',
    );
    task.actions = ['approve', 'reject'];
    expect(validateTaskGraph(graph).join(',')).not.toContain(
      '退回操作必须配置目标',
    );
    expect(task.returnTargets).toBeUndefined();
  });
  it('模板和新增并行分支的实际保存JSON只包含已启用操作的表单', () => {
    for (const kind of ['userTask', 'condition', 'parallel'] as const) {
      let graph = insertTaskStep(initial(), 'flow_1', kind);
      const split = graph.nodes.find((node) => node.joinId);
      if (split) graph = addParallelBranch(graph, split.id);
      const requestBody = JSON.stringify(graph);
      const payload = JSON.parse(requestBody) as typeof graph;
      for (const task of payload.nodes.filter(
        (node) => node.type === 'userTask',
      )) {
        expect(task.actions).toEqual(['approve']);
        expect(Object.keys(task.actionForms ?? {})).toEqual(['approve']);
      }
      expect(validateTaskGraph(payload, true)).toEqual([]);
    }
  });
  it('草稿保存也拒绝未启用操作的残留表单', () => {
    const graph = insertTaskStep(initial(), 'flow_1', 'userTask');
    const task = required(graph.nodes.find((node) => node.type === 'userTask'));
    task.actionForms = { approve: {}, reject: { editableFields: [] } };
    expect(validateTaskGraph(graph, true).join(',')).toContain(
      '操作表单引用未启用操作',
    );
    expect(validateTaskGraph(graph).join(',')).toContain(
      '操作表单引用未启用操作',
    );
  });
});
