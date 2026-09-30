import type { LowflowCanvasNode } from './lowflow-model';
import type { WorkflowDesignerDefinition } from './types';

import { describe, expect, it } from 'vitest';

import {
  fromLowflowCanvasTree,
  LowflowModelError,
  toLowflowCanvasTree,
  toLowflowRuntimeTree,
} from './lowflow-model';

function graph(
  nodes: WorkflowDesignerDefinition['nodes'],
  edges: NonNullable<WorkflowDesignerDefinition['edges']>,
): WorkflowDesignerDefinition {
  return { name: '审核', processKey: 'review', nodes, edges };
}

function mappedEdgeIds(node: LowflowCanvasNode): string[] {
  const ids = [node.edgeId, node.nextEdgeId].flatMap((id) => (id ? [id] : []));
  for (const branch of node.branches ?? []) ids.push(...mappedEdgeIds(branch));
  if (node.next) ids.push(...mappedEdgeIds(node.next));
  return ids;
}

describe('lowflow-design 树形画布映射', () => {
  it('草稿模式保留尚未配齐条件及默认出口的排他分叉', () => {
    const definition = graph(
      [
        { id: 'start', name: '开始', type: 'start' },
        { id: 'choice', name: '待配置排他', type: 'exclusiveGateway' },
        { id: 'yes', name: '通过', type: 'end' },
        { id: 'no', name: '拒绝', type: 'end' },
      ],
      [
        { id: 's_c', source: 'start', target: 'choice' },
        { id: 'c_y', source: 'choice', target: 'yes' },
        { id: 'c_n', source: 'choice', target: 'no' },
      ],
    );
    expect(() => toLowflowCanvasTree(definition)).toThrow(LowflowModelError);
    const tree = toLowflowCanvasTree(definition, { allowDraft: true });
    expect(tree.next?.branches?.map((branch) => branch.edgeId)).toEqual([
      'c_y',
      'c_n',
    ]);
    expect(fromLowflowCanvasTree(tree, definition)).toEqual(definition);

    const ambiguous = structuredClone(definition);
    if (!ambiguous.edges?.[1] || !ambiguous.edges?.[2])
      throw new Error('草稿分支缺失');
    ambiguous.edges[1].default = true;
    ambiguous.edges[2].default = true;
    expect(() => toLowflowCanvasTree(ambiguous, { allowDraft: true })).toThrow(
      /默认连线数量无效/,
    );
  });

  it('草稿选项仅显示尚未拆分的一入一出网关，仍保留完整连线', () => {
    const definition = graph(
      [
        { id: 'start', name: '开始', type: 'start' },
        { id: 'draftGateway', name: '待配置分支', type: 'exclusiveGateway' },
        { id: 'end', name: '结束', type: 'end' },
      ],
      [
        { id: 's_g', source: 'start', target: 'draftGateway' },
        { id: 'g_e', source: 'draftGateway', target: 'end' },
      ],
    );

    // 默认仍按发布结构拒绝；画布草稿展示不改变服务端校验契约。
    expect(() => toLowflowCanvasTree(definition)).toThrow(LowflowModelError);
    const tree = toLowflowCanvasTree(definition, { allowDraft: true });
    expect(tree.next).toMatchObject({
      id: 'draftGateway',
      type: 'exclusiveGateway',
      nextEdgeId: 'g_e',
      next: { id: 'end' },
    });
    expect(mappedEdgeIds(tree).toSorted()).toEqual(['g_e', 's_g']);
    expect(() =>
      toLowflowCanvasTree(
        {
          ...definition,
          edges: [
            ...(definition.edges ?? []),
            { id: 'broken', source: 'draftGateway', target: 'missing' },
          ],
        },
        { allowDraft: true },
      ),
    ).toThrow(LowflowModelError);
  });

  it('串行流程保留原始节点、每条连线、坐标，且不推断运行状态', () => {
    const definition = graph(
      [
        { id: 'start', name: '开始', type: 'start', x: 10, y: 20 },
        {
          id: 'review',
          name: '审批',
          type: 'userTask',
          candidateUsers: ['u1'],
        },
        { id: 'end', name: '结束', type: 'end' },
      ],
      [
        { id: 's_r', source: 'start', target: 'review' },
        { id: 'r_e', source: 'review', target: 'end' },
      ],
    );
    const snapshot = structuredClone(definition);

    // 展示树不泄露审批候选配置，也不修改固定版本定义。
    const tree = toLowflowCanvasTree(definition);
    expect(tree).toMatchObject({
      id: 'start',
      type: 'start',
      x: 10,
      y: 20,
      nextEdgeId: 's_r',
      nextTargetId: 'review',
      next: {
        id: 'review',
        type: 'userTask',
        incomingEdgeIds: ['s_r'],
        nextEdgeId: 'r_e',
        nextTargetId: 'end',
        next: { id: 'end', type: 'end', incomingEdgeIds: ['r_e'] },
      },
    });
    expect(tree.next).not.toHaveProperty('candidateUsers');
    expect(tree.next).not.toHaveProperty('status');
    expect(mappedEdgeIds(tree).toSorted()).toEqual(['r_e', 's_r']);
    expect(fromLowflowCanvasTree(tree, definition)).toEqual(definition);
    const lostIncoming = structuredClone(tree);
    if (!lostIncoming.next) throw new Error('审批节点未映射');
    lostIncoming.next.incomingEdgeIds = [];
    expect(() => fromLowflowCanvasTree(lostIncoming, definition)).toThrow(
      /入边身份不一致/,
    );
    expect(definition).toEqual(snapshot);
  });

  it('排他分支保留条件、默认边与稳定边 ID，并只渲染一次汇聚节点', () => {
    const condition = { eq: [{ variable: 'amount' }, { literal: 100 }] };
    const definition = graph(
      [
        { id: 'start', name: '开始', type: 'start' },
        { id: 'choose', name: '条件', type: 'exclusiveGateway' },
        { id: 'left', name: '小额', type: 'userTask' },
        { id: 'right', name: '大额', type: 'userTask' },
        { id: 'end', name: '完成', type: 'end' },
      ],
      [
        { id: 's_g', source: 'start', target: 'choose' },
        { id: 'g_l', source: 'choose', target: 'left', condition },
        { id: 'g_r', source: 'choose', target: 'right', default: true },
        { id: 'l_e', source: 'left', target: 'end' },
        { id: 'r_e', source: 'right', target: 'end' },
      ],
    );
    const tree = toLowflowCanvasTree(definition);

    // 上游 branches 表示互斥列，公共后继由网关 next 表示。
    const gateway = tree.next;
    if (!gateway) throw new Error('排他网关未映射');
    expect(gateway.joinId).toBe('end');
    expect(gateway.branches).toHaveLength(2);
    expect(gateway.branches?.map((branch) => branch.branchKind)).toEqual([
      'exclusive',
      'exclusive',
    ]);
    expect(gateway.branches?.[0]).toMatchObject({
      id: 'branch:g_l',
      type: 'condition',
      edgeId: 'g_l',
      targetId: 'left',
      condition,
      next: { id: 'left', nextEdgeId: 'l_e', nextTargetId: 'end' },
    });
    expect(gateway.branches?.[1]).toMatchObject({
      id: 'branch:g_r',
      edgeId: 'g_r',
      targetId: 'right',
      default: true,
      next: { id: 'right', nextEdgeId: 'r_e', nextTargetId: 'end' },
    });
    expect(gateway.next).toMatchObject({
      id: 'end',
      incomingEdgeIds: ['l_e', 'r_e'],
    });
    expect(mappedEdgeIds(tree).toSorted()).toEqual([
      'g_l',
      'g_r',
      'l_e',
      'r_e',
      's_g',
    ]);
    expect(fromLowflowCanvasTree(tree, definition)).toEqual(definition);
    const edited = structuredClone(tree);
    const branch = edited.next?.branches?.[0];
    if (!branch) throw new Error('条件分支未映射');
    branch.condition = { exists: { variable: 'ready' } };
    const changed = fromLowflowCanvasTree(edited, definition);
    expect(changed.edges?.find((edge) => edge.id === 'g_l')?.condition).toEqual(
      branch.condition,
    );
    expect(
      definition.edges?.find((edge) => edge.id === 'g_l')?.condition,
    ).toEqual(condition);
  });

  it('排他分支也允许各自到不同结束节点', () => {
    const tree = toLowflowCanvasTree(
      graph(
        [
          { id: 'start', name: '开始', type: 'start' },
          { id: 'choice', name: '分支', type: 'exclusiveGateway' },
          { id: 'yes', name: '通过', type: 'end' },
          { id: 'no', name: '拒绝', type: 'end' },
        ],
        [
          { id: 's_c', source: 'start', target: 'choice' },
          {
            id: 'c_y',
            source: 'choice',
            target: 'yes',
            condition: { exists: { variable: 'ok' } },
          },
          { id: 'c_n', source: 'choice', target: 'no', default: true },
        ],
      ),
    );
    expect(tree.next?.next).toBeUndefined();
    expect(tree.next?.branches?.map((branch) => branch.next?.id)).toEqual([
      'yes',
      'no',
    ]);
  });

  it('结构化并行分叉汇聚保留真实 join 网关和全部入边', () => {
    const definition = graph(
      [
        { id: 'start', name: '开始', type: 'start' },
        {
          id: 'fork',
          name: '并行分叉',
          type: 'parallelGateway',
          joinId: 'join',
        },
        { id: 'left', name: '审批甲', type: 'userTask' },
        { id: 'right', name: '审批乙', type: 'userTask' },
        { id: 'join', name: '并行汇聚', type: 'parallelGateway' },
        { id: 'end', name: '结束', type: 'end' },
      ],
      [
        { id: 's_f', source: 'start', target: 'fork' },
        { id: 'f_l', source: 'fork', target: 'left' },
        { id: 'f_r', source: 'fork', target: 'right' },
        { id: 'l_j', source: 'left', target: 'join' },
        { id: 'r_j', source: 'right', target: 'join' },
        { id: 'j_e', source: 'join', target: 'end' },
      ],
    );
    const tree = toLowflowCanvasTree(definition);
    const fork = tree.next;
    if (!fork) throw new Error('并行分叉未映射');
    expect(fork.joinId).toBe('join');
    expect(fork.branches?.map((branch) => branch.edgeId)).toEqual([
      'f_l',
      'f_r',
    ]);
    expect(fork.branches?.map((branch) => branch.branchKind)).toEqual([
      'parallel',
      'parallel',
    ]);
    expect(fork.branches?.map((branch) => branch.next?.nextEdgeId)).toEqual([
      'l_j',
      'r_j',
    ]);
    expect(fork.next).toMatchObject({
      id: 'join',
      type: 'parallelGateway',
      incomingEdgeIds: ['l_j', 'r_j'],
      nextEdgeId: 'j_e',
      next: { id: 'end' },
    });
    expect(mappedEdgeIds(tree).toSorted()).toEqual([
      'f_l',
      'f_r',
      'j_e',
      'l_j',
      'r_j',
      's_f',
    ]);
    expect(fromLowflowCanvasTree(tree, definition)).toEqual(definition);
  });

  it.each([
    [
      '自环',
      graph(
        [
          { id: 'start', name: '开始', type: 'start' },
          { id: 'end', name: '结束', type: 'end' },
        ],
        [
          { id: 'loop', source: 'start', target: 'start' },
          { id: 's_e', source: 'start', target: 'end' },
        ],
      ),
    ],
    [
      '多节点环',
      graph(
        [
          { id: 'start', name: '开始', type: 'start' },
          { id: 'a', name: '分叉', type: 'exclusiveGateway' },
          { id: 'b', name: '汇聚', type: 'exclusiveGateway' },
          { id: 'end', name: '结束', type: 'end' },
        ],
        [
          { id: 's_a', source: 'start', target: 'a' },
          { id: 'a_b', source: 'a', target: 'b' },
          { id: 'b_a', source: 'b', target: 'a' },
          { id: 'b_e', source: 'b', target: 'end' },
        ],
      ),
    ],
    [
      '孤立子图',
      graph(
        [
          { id: 'start', name: '开始', type: 'start' },
          { id: 'end', name: '结束', type: 'end' },
          { id: 'orphan', name: '孤立', type: 'end' },
        ],
        [{ id: 's_e', source: 'start', target: 'end' }],
      ),
    ],
    [
      '重复边 ID',
      graph(
        [
          { id: 'start', name: '开始', type: 'start' },
          { id: 'end', name: '结束', type: 'end' },
        ],
        [
          { id: 'duplicate', source: 'start', target: 'end' },
          { id: 'duplicate', source: 'start', target: 'end' },
        ],
      ),
    ],
    [
      '普通节点多出边',
      graph(
        [
          { id: 'start', name: '开始', type: 'start' },
          { id: 'task', name: '审批', type: 'userTask' },
          { id: 'yes', name: '通过', type: 'end' },
          { id: 'no', name: '拒绝', type: 'end' },
        ],
        [
          { id: 's_t', source: 'start', target: 'task' },
          { id: 't_y', source: 'task', target: 'yes' },
          { id: 't_n', source: 'task', target: 'no' },
        ],
      ),
    ],
    [
      '并行网关缺少 joinId',
      graph(
        [
          { id: 'start', name: '开始', type: 'start' },
          { id: 'fork', name: '并行', type: 'parallelGateway' },
          { id: 'left', name: '甲', type: 'end' },
          { id: 'right', name: '乙', type: 'end' },
        ],
        [
          { id: 's_f', source: 'start', target: 'fork' },
          { id: 'f_l', source: 'fork', target: 'left' },
          { id: 'f_r', source: 'fork', target: 'right' },
        ],
      ),
    ],
    [
      '并行分支绕过指定汇聚',
      graph(
        [
          { id: 'start', name: '开始', type: 'start' },
          { id: 'fork', name: '并行', type: 'parallelGateway', joinId: 'join' },
          { id: 'left', name: '甲', type: 'userTask' },
          { id: 'right', name: '乙', type: 'userTask' },
          { id: 'join', name: '汇聚', type: 'parallelGateway' },
          { id: 'end', name: '结束', type: 'end' },
        ],
        [
          { id: 's_f', source: 'start', target: 'fork' },
          { id: 'f_l', source: 'fork', target: 'left' },
          { id: 'f_r', source: 'fork', target: 'right' },
          { id: 'l_j', source: 'left', target: 'join' },
          { id: 'r_e', source: 'right', target: 'end' },
          { id: 'j_e', source: 'join', target: 'end' },
        ],
      ),
    ],
  ])('%s 被明确拒绝', (_label, definition) => {
    expect(() => toLowflowCanvasTree(definition)).toThrow(LowflowModelError);
  });
});

describe('服务端授权运行图映射', () => {
  it('无需条件和默认边即可映射排他分支，并且只复制服务端给出的状态', () => {
    const tree = toLowflowRuntimeTree(
      [
        { id: 'start', name: '开始', type: 'start', status: 'completed' },
        { id: 'choice', name: '条件', type: 'exclusiveGateway' },
        { id: 'left', name: '甲审批', type: 'userTask', status: 'active' },
        { id: 'right', name: '乙审批', type: 'userTask', status: 'skipped' },
        { id: 'merge', name: '汇聚', type: 'exclusiveGateway' },
        { id: 'end', name: '结束', type: 'end', status: 'pending' },
      ],
      [
        { id: 's_c', source: 'start', target: 'choice' },
        { id: 'c_l', source: 'choice', target: 'left' },
        { id: 'c_r', source: 'choice', target: 'right' },
        { id: 'l_m', source: 'left', target: 'merge' },
        { id: 'r_m', source: 'right', target: 'merge' },
        { id: 'm_e', source: 'merge', target: 'end' },
      ],
    );

    // 分支条件不在授权投影中，不能由连线顺序或执行状态反推。
    const choice = tree.next;
    if (!choice) throw new Error('排他网关未映射');
    expect(tree.status).toBe('completed');
    expect(choice).not.toHaveProperty('status');
    expect(choice.branches).toHaveLength(2);
    expect(choice.branches?.[0]).not.toHaveProperty('condition');
    expect(choice.branches?.[0]).not.toHaveProperty('default');
    expect(choice.branches?.[0]?.next?.status).toBe('active');
    expect(choice.branches?.[1]?.next?.status).toBe('skipped');
    expect(choice.next?.id).toBe('merge');
    expect(choice.next?.next?.status).toBe('pending');
    expect(mappedEdgeIds(tree).toSorted()).toEqual([
      'c_l',
      'c_r',
      'l_m',
      'm_e',
      'r_m',
      's_c',
    ]);
  });

  it('从运行图拓扑确定唯一并行汇聚，无需设计期 joinId', () => {
    const tree = toLowflowRuntimeTree(
      [
        { id: 'start', name: '开始', type: 'start' },
        { id: 'fork', name: '并行', type: 'parallelGateway' },
        { id: 'left', name: '甲', type: 'userTask', status: 'completed' },
        { id: 'right', name: '乙', type: 'userTask', status: 'active' },
        { id: 'join', name: '汇聚', type: 'parallelGateway' },
        { id: 'end', name: '结束', type: 'end' },
      ],
      [
        { id: 's_f', source: 'start', target: 'fork' },
        { id: 'f_l', source: 'fork', target: 'left' },
        { id: 'f_r', source: 'fork', target: 'right' },
        { id: 'l_j', source: 'left', target: 'join' },
        { id: 'r_j', source: 'right', target: 'join' },
        { id: 'j_e', source: 'join', target: 'end' },
      ],
    );
    expect(tree.next?.joinId).toBe('join');
    expect(tree.next?.next).toMatchObject({
      id: 'join',
      incomingEdgeIds: ['l_j', 'r_j'],
    });
    expect(tree.next?.branches?.map((branch) => branch.next?.status)).toEqual([
      'completed',
      'active',
    ]);
    expect(tree.next?.next).not.toHaveProperty('status');
    expect(mappedEdgeIds(tree).toSorted()).toEqual([
      'f_l',
      'f_r',
      'j_e',
      'l_j',
      'r_j',
      's_f',
    ]);
  });

  it.each([
    [
      '节点类型缺失',
      [
        { id: 'start', name: '开始', type: 'start' },
        { id: 'end', name: '结束' },
      ],
      [{ id: 's_e', source: 'start', target: 'end' }],
    ],
    [
      '并行绕开汇聚',
      [
        { id: 'start', name: '开始', type: 'start' },
        { id: 'fork', name: '并行', type: 'parallelGateway' },
        { id: 'left', name: '甲', type: 'userTask' },
        { id: 'right', name: '乙', type: 'end' },
        { id: 'join', name: '汇聚', type: 'parallelGateway' },
        { id: 'end', name: '结束', type: 'end' },
      ],
      [
        { id: 's_f', source: 'start', target: 'fork' },
        { id: 'f_l', source: 'fork', target: 'left' },
        { id: 'f_r', source: 'fork', target: 'right' },
        { id: 'l_j', source: 'left', target: 'join' },
        { id: 'j_e', source: 'join', target: 'end' },
      ],
    ],
    [
      '多节点环',
      [
        { id: 'start', name: '开始', type: 'start' },
        { id: 'loop', name: '循环', type: 'exclusiveGateway' },
        { id: 'end', name: '结束', type: 'end' },
      ],
      [
        { id: 's_l', source: 'start', target: 'loop' },
        { id: 'l_l', source: 'loop', target: 'loop' },
        { id: 'l_e', source: 'loop', target: 'end' },
      ],
    ],
  ] as const)('%s 被明确拒绝', (_label, nodes, edges) => {
    expect(() => toLowflowRuntimeTree(nodes, edges)).toThrow(LowflowModelError);
  });
});
