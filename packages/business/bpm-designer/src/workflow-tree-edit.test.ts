import type { WorkflowDesignerDefinition } from './types';

import { describe, expect, it } from 'vitest';

import {
  insertExclusiveOutcomesOnTreeEdge,
  insertGatewayOnTreeEdge,
  insertUserTaskOnTreeEdge,
  patchWorkflowTreeEdge,
  patchWorkflowTreeNode,
  removeTreeUserTask,
} from './workflow-tree-edit';
import {
  convertDraftV2ToV3,
  convertV2ToV3,
  projectDraftV3ToV2,
  projectV3ToV2,
  WorkflowTreeVersionError,
} from './workflow-tree-version';

function definition(
  nodes: WorkflowDesignerDefinition['nodes'],
  edges: NonNullable<WorkflowDesignerDefinition['edges']>,
): WorkflowDesignerDefinition {
  return {
    schemaVersion: 2,
    processKey: 'review',
    name: '审核',
    purposeKey: 'mainline',
    nodes,
    edges,
  };
}

function task(id: string) {
  return { id, type: 'userTask' as const, name: id };
}

function serial() {
  return convertV2ToV3(
    definition(
      [
        { id: 'start', type: 'start', name: '开始' },
        task('review'),
        { id: 'end', type: 'end', name: '结束', outcome: 'Approved' },
      ],
      [
        { id: 's_r', source: 'start', target: 'review' },
        {
          id: 'r_e',
          source: 'review',
          target: 'end',
          metadata: { color: 'muted' },
        },
      ] as NonNullable<WorkflowDesignerDefinition['edges']>,
    ),
  );
}

function exclusive() {
  return convertV2ToV3(
    definition(
      [
        { id: 'start', type: 'start', name: '开始' },
        { id: 'choice', type: 'exclusiveGateway', name: '选择' },
        task('left'),
        task('right'),
        { id: 'end', type: 'end', name: '结束', outcome: 'Approved' },
      ],
      [
        { id: 's_c', source: 'start', target: 'choice' },
        {
          id: 'c_l',
          source: 'choice',
          target: 'left',
          condition: { gt: [{ variable: 'amount' }, { literal: 100 }] },
          metadata: { label: '大额' },
        },
        {
          id: 'c_r',
          source: 'choice',
          target: 'right',
          default: true,
          metadata: { label: '默认' },
        },
        { id: 'l_e', source: 'left', target: 'end' },
        { id: 'r_e', source: 'right', target: 'end' },
      ] as NonNullable<WorkflowDesignerDefinition['edges']>,
    ),
  );
}

function parallel() {
  return convertV2ToV3(
    definition(
      [
        { id: 'start', type: 'start', name: '开始' },
        { id: 'fork', type: 'parallelGateway', name: '分叉', joinId: 'join' },
        task('left'),
        task('right'),
        { id: 'join', type: 'parallelGateway', name: '汇聚' },
        { id: 'end', type: 'end', name: '结束', outcome: 'Approved' },
      ],
      [
        { id: 's_f', source: 'start', target: 'fork' },
        { id: 'f_l', source: 'fork', target: 'left', metadata: { lane: 1 } },
        { id: 'f_r', source: 'fork', target: 'right', metadata: { lane: 2 } },
        { id: 'l_j', source: 'left', target: 'join' },
        { id: 'r_j', source: 'right', target: 'join' },
        { id: 'j_e', source: 'join', target: 'end' },
      ] as NonNullable<WorkflowDesignerDefinition['edges']>,
    ),
  );
}

function exclusiveOutcomes() {
  return convertV2ToV3(
    definition(
      [
        { id: 'start', type: 'start', name: '开始' },
        { id: 'choice', type: 'exclusiveGateway', name: '选择' },
        task('left'),
        task('right'),
        { id: 'leftEnd', type: 'end', name: '左终局', outcome: 'Approved' },
        { id: 'rightEnd', type: 'end', name: '右终局', outcome: 'Rejected' },
      ],
      [
        { id: 's_c', source: 'start', target: 'choice' },
        {
          id: 'c_l',
          source: 'choice',
          target: 'left',
          condition: { gt: [{ variable: 'amount' }, { literal: 100 }] },
          metadata: { label: '大额' },
        },
        { id: 'c_r', source: 'choice', target: 'right', default: true },
        { id: 'l_e', source: 'left', target: 'leftEnd' },
        { id: 'r_e', source: 'right', target: 'rightEnd' },
      ] as NonNullable<WorkflowDesignerDefinition['edges']>,
    ),
  );
}

describe('受限 lowflow 树按稳定连线插入审批节点', () => {
  it('单入单出网关草稿可在原边插入，完整执行投影继续拒绝', () => {
    const source = convertDraftV2ToV3(
      definition(
        [
          { id: 'start', type: 'start', name: '开始' },
          { id: 'choice', type: 'exclusiveGateway', name: '待拆网关' },
          { id: 'end', type: 'end', name: '结束', outcome: 'Approved' },
        ],
        [
          { id: 's_c', source: 'start', target: 'choice' },
          {
            id: 'c_e',
            source: 'choice',
            target: 'end',
            metadata: { label: '原边' },
          },
        ] as NonNullable<WorkflowDesignerDefinition['edges']>,
      ),
    );
    const before = structuredClone(source);
    const { definition: updated, node } = insertUserTaskOnTreeEdge(
      source,
      'c_e',
    );
    const graph = projectDraftV3ToV2(updated);

    expect(source).toEqual(before);
    expect(graph.edges).toContainEqual({
      id: 'c_e',
      source: 'choice',
      target: node.id,
      metadata: { label: '原边' },
    });
    expect(graph.edges).toContainEqual({
      id: node.nextEdgeId,
      source: node.id,
      target: 'end',
    });
    expect(() => projectV3ToV2(updated)).toThrow();
  });

  it('缺条件与默认的排他草稿保留原出口身份，仍不能模拟', () => {
    const source = exclusive();
    const branches = source.flowTree.next?.branches;
    if (!branches?.[0] || !branches[1]) throw new Error('测试分支缺失');
    delete branches[0].condition;
    delete branches[1].default;
    const before = structuredClone(source);
    const { definition: updated, node } = insertUserTaskOnTreeEdge(
      source,
      'c_l',
    );
    const outlet = projectDraftV3ToV2(updated).edges?.find(
      (edge) => edge.id === 'c_l',
    );

    expect(source).toEqual(before);
    expect(outlet).toEqual({
      id: 'c_l',
      source: 'choice',
      target: node.id,
      metadata: { label: '大额' },
    });
    expect(updated.flowTree.next?.branches?.[0]?.id).toBe('branch:c_l');
    expect(() => projectV3ToV2(updated)).toThrow();
  });

  it('串行插入保持原边 ID 和 metadata，新增后继边只承载拓扑', () => {
    const source = serial();
    const before = structuredClone(source);
    const { definition: updated, node } = insertUserTaskOnTreeEdge(
      source,
      'r_e',
    );
    const graph = projectV3ToV2(updated);

    expect(source).toEqual(before);
    expect(updated).not.toHaveProperty('nodes');
    expect(updated).not.toHaveProperty('edges');
    expect(node.type).toBe('userTask');
    expect(graph.edges).toContainEqual({
      id: 'r_e',
      source: 'review',
      target: node.id,
      metadata: { color: 'muted' },
    });
    expect(graph.edges).toContainEqual({
      id: node.nextEdgeId,
      source: node.id,
      target: 'end',
    });
    expect(updated.flowTree.next?.nextEdgeMetadata).toEqual({
      color: 'muted',
    });
  });

  it.each(['c_l', 'c_r'])(
    '排他出口 %s 保留条件或默认标记及 metadata',
    (edgeId) => {
      const source = exclusive();
      const original = projectV3ToV2(source).edges?.find(
        (edge) => edge.id === edgeId,
      );
      const { definition: updated, node } = insertUserTaskOnTreeEdge(
        source,
        edgeId,
      );
      const graph = projectV3ToV2(updated);
      const outlet = graph.edges?.find((edge) => edge.id === edgeId);

      expect(outlet).toEqual({ ...original, target: node.id });
      expect(graph.edges).toContainEqual({
        id: node.nextEdgeId,
        source: node.id,
        target: original?.target,
      });
      expect(
        updated.flowTree.next?.branches?.find(
          (branch) => branch.edgeId === edgeId,
        )?.id,
      ).toBe(`branch:${edgeId}`);
    },
  );

  it('并行出口和指向汇聚点的末端边均保持合法结构', () => {
    const fork = insertUserTaskOnTreeEdge(parallel(), 'f_l');
    expect(projectV3ToV2(fork.definition).edges).toContainEqual({
      id: 'f_l',
      source: 'fork',
      target: fork.node.id,
      metadata: { lane: 1 },
    });

    const join = insertUserTaskOnTreeEdge(parallel(), 'l_j');
    const graph = projectV3ToV2(join.definition);
    expect(graph.edges).toContainEqual({
      id: 'l_j',
      source: 'left',
      target: join.node.id,
    });
    expect(graph.edges).toContainEqual({
      id: join.node.nextEdgeId,
      source: join.node.id,
      target: 'join',
    });
  });

  it('新任务与后继连线同时避开现有节点及边身份', () => {
    const source = serial();
    const review = source.flowTree.next;
    if (!review) throw new Error('测试流程缺少审批节点');
    review.name = '旧审批';
    review.id = 'userTask_1';
    source.flowTree.nextTargetId = 'userTask_1';
    source.flowTree.nextEdgeId = 'userTask_2';
    const result = insertUserTaskOnTreeEdge(source, 'r_e');
    expect(result.node.id).toBe('userTask_3');
    expect(result.node.nextEdgeId).not.toBe('r_e');
    expect(projectV3ToV2(result.definition).nodes).toHaveLength(4);

    // 另一份合法树的现有连线占用默认新边 ID 时应选择下一个空闲身份。
    const edgeCollision = serial();
    edgeCollision.flowTree.nextEdgeId = 'userTask_1_next_1';
    const inserted = insertUserTaskOnTreeEdge(edgeCollision, 'r_e');
    expect(inserted.node.id).toBe('userTask_1');
    expect(inserted.node.nextEdgeId).toBe('userTask_1_next_2');
  });

  it('过期边、重复边、丢目标、未知键和不支持类型均拒绝，输入保持不变', () => {
    const source = serial();
    const before = structuredClone(source);
    expect(() => insertUserTaskOnTreeEdge(source, 'missing')).toThrow(
      /已不存在/,
    );
    expect(source).toEqual(before);

    const duplicate = serial();
    if (!duplicate.flowTree.next) throw new Error('测试流程缺少审批节点');
    duplicate.flowTree.next.nextEdgeId = 's_r';
    expect(() => insertUserTaskOnTreeEdge(duplicate, 's_r')).toThrow(
      WorkflowTreeVersionError,
    );

    const missingTarget = serial();
    if (!missingTarget.flowTree.next) throw new Error('测试流程缺少审批节点');
    missingTarget.flowTree.next.nextTargetId = 'absent';
    expect(() => insertUserTaskOnTreeEdge(missingTarget, 'r_e')).toThrow(
      WorkflowTreeVersionError,
    );

    const unknownKey = serial();
    (unknownKey.flowTree as object as Record<string, unknown>).script = 'bad';
    expect(() => insertUserTaskOnTreeEdge(unknownKey, 's_r')).toThrow(
      /不支持的字段/,
    );

    const unsupported = serial();
    if (!unsupported.flowTree.next) throw new Error('测试流程缺少审批节点');
    unsupported.flowTree.next.type = 'serviceTask' as 'userTask';
    expect(() => insertUserTaskOnTreeEdge(unsupported, 'r_e')).toThrow(
      WorkflowTreeVersionError,
    );
  });
});

describe('受限 lowflow 树按稳定身份编辑属性', () => {
  it('跨分支仅更新选中的真实节点业务属性，不返回平面事实', () => {
    const source = exclusive();
    const before = structuredClone(source);
    const updated = patchWorkflowTreeNode(source, 'left', {
      name: '部门审批',
      candidateUsers: ['user:9'],
      actions: ['approve'],
    });
    const graph = projectDraftV3ToV2(updated);

    expect(source).toEqual(before);
    expect(updated).not.toHaveProperty('nodes');
    expect(updated).not.toHaveProperty('edges');
    expect(graph.nodes.find((node) => node.id === 'left')).toMatchObject({
      name: '部门审批',
      candidateUsers: ['user:9'],
      actions: ['approve'],
    });
    expect(graph.nodes.find((node) => node.id === 'right')).toEqual(
      projectV3ToV2(source).nodes.find((node) => node.id === 'right'),
    );
    expect(graph.edges).toEqual(projectV3ToV2(source).edges);
  });

  it('设默认出口清除其条件及其它默认，并保留原边 metadata', () => {
    const source = exclusive();
    const before = structuredClone(source);
    const updated = patchWorkflowTreeEdge(source, 'c_l', { default: true });
    const branches = updated.flowTree.next?.branches;
    const edges = projectDraftV3ToV2(updated).edges;

    expect(source).toEqual(before);
    expect(branches?.[0]).toMatchObject({
      id: 'branch:c_l',
      edgeId: 'c_l',
      default: true,
      metadata: { label: '大额' },
    });
    expect(branches?.[0]).not.toHaveProperty('condition');
    expect(branches?.[1]).not.toHaveProperty('default');
    expect(edges?.find((edge) => edge.id === 'c_l')).toMatchObject({
      target: 'left',
      default: true,
      metadata: { label: '大额' },
    });
    expect(() => projectV3ToV2(updated)).toThrow();
  });

  it('关闭 default 删除键；设置条件移除该出口的默认标记', () => {
    const source = exclusive();
    const cleared = patchWorkflowTreeEdge(source, 'c_r', { default: false });
    expect(cleared.flowTree.next?.branches?.[1]).not.toHaveProperty('default');
    expect(
      projectDraftV3ToV2(cleared).edges?.find((edge) => edge.id === 'c_r'),
    ).not.toHaveProperty('default');

    const conditioned = patchWorkflowTreeEdge(source, 'c_r', {
      condition: { eq: [{ variable: 'amount' }, { literal: 0 }] },
    });
    expect(conditioned.flowTree.next?.branches?.[1]).not.toHaveProperty(
      'default',
    );
    expect(conditioned.flowTree.next?.branches?.[1]?.condition).toEqual({
      eq: [{ variable: 'amount' }, { literal: 0 }],
    });
    expect(source.flowTree.next?.branches?.[1]?.default).toBe(true);
    expect(() => projectV3ToV2(conditioned)).toThrow();
  });

  it('草稿缺条件出口可补齐条件并保持其它出口独立', () => {
    const source = exclusive();
    const branch = source.flowTree.next?.branches?.[0];
    if (!branch) throw new Error('测试分支缺失');
    delete branch.condition;
    const updated = patchWorkflowTreeEdge(source, 'c_l', {
      condition: { gt: [{ variable: 'amount' }, { literal: 10 }] },
    });
    expect(updated.flowTree.next?.branches?.[0]?.condition).toEqual({
      gt: [{ variable: 'amount' }, { literal: 10 }],
    });
    expect(updated.flowTree.next?.branches?.[1]?.default).toBe(true);
    expect(projectV3ToV2(updated).edges).toHaveLength(5);
  });

  it('拒绝拓扑身份、未知字段、并行/串行边及错误条件补丁', () => {
    const source = exclusive();
    const before = structuredClone(source);
    expect(() =>
      patchWorkflowTreeNode(source, 'missing', { name: '不存在' }),
    ).toThrow(/已不存在/);
    expect(() =>
      patchWorkflowTreeNode(source, 'left', { id: 'changed' } as never),
    ).toThrow(/不支持字段/);
    expect(() =>
      patchWorkflowTreeNode(source, 'left', { next: undefined } as never),
    ).toThrow(/不支持字段/);
    expect(() =>
      patchWorkflowTreeNode(source, 'left', { metadata: {} } as never),
    ).toThrow(/不支持字段/);
    expect(() =>
      patchWorkflowTreeNode(source, 'left', { script: 'bad' } as never),
    ).toThrow(/不支持字段/);
    expect(() => patchWorkflowTreeNode(source, 'left', { name: '' })).toThrow();
    expect(() =>
      patchWorkflowTreeEdge(source, 's_c', { default: true }),
    ).toThrow(/不是可编辑/);
    expect(() =>
      patchWorkflowTreeEdge(parallel(), 'f_l', { default: true }),
    ).toThrow(/不是可编辑/);
    expect(() =>
      patchWorkflowTreeEdge(source, 'c_l', { targetId: 'right' } as never),
    ).toThrow(/不支持字段/);
    expect(() =>
      patchWorkflowTreeEdge(source, 'c_l', {
        condition: { script: 'bad' },
      } as never),
    ).toThrow();
    expect(() =>
      patchWorkflowTreeEdge(source, 'c_l', { condition: null, default: true }),
    ).toThrow(/分开设置/);

    const duplicateTree = exclusive();
    if (!duplicateTree.flowTree.next?.branches?.[1])
      throw new Error('测试分支缺失');
    duplicateTree.flowTree.next.branches[1].edgeId = 'c_l';
    expect(() =>
      patchWorkflowTreeNode(duplicateTree, 'left', { name: '不应修改' }),
    ).toThrow(WorkflowTreeVersionError);

    const unknownTree = exclusive();
    (unknownTree.flowTree as object as Record<string, unknown>).script = 'bad';
    expect(() =>
      patchWorkflowTreeEdge(unknownTree, 'c_l', { default: true }),
    ).toThrow(/不支持的字段/);
    expect(source).toEqual(before);
  });
});

describe('受限 lowflow 树原位新增结构化网关', () => {
  it.each(['exclusiveGateway', 'parallelGateway'] as const)(
    '串行边插入 %s fork/join，原边身份及 metadata 留在原位',
    (kind) => {
      const source = serial();
      const before = structuredClone(source);
      const {
        definition: updated,
        fork,
        join,
      } = insertGatewayOnTreeEdge(source, 'r_e', kind);
      const graph = projectDraftV3ToV2(updated);
      const edges = graph.edges ?? [];

      expect(source).toEqual(before);
      expect(updated).not.toHaveProperty('nodes');
      expect(updated).not.toHaveProperty('edges');
      expect(graph.nodes.map((node) => node.id)).toContain(fork.id);
      expect(graph.nodes.map((node) => node.id)).toContain(join.id);
      expect(edges).toContainEqual({
        id: 'r_e',
        source: 'review',
        target: fork.id,
        metadata: { color: 'muted' },
      });
      expect(fork.joinId).toBe(join.id);
      expect(fork.branches).toHaveLength(2);
      expect(
        fork.branches?.map((branch) => ({
          edgeId: branch.edgeId,
          targetId: branch.targetId,
        })),
      ).toEqual([
        { edgeId: fork.branches?.[0]?.edgeId, targetId: join.id },
        { edgeId: fork.branches?.[1]?.edgeId, targetId: join.id },
      ]);
      expect(edges).toContainEqual({
        id: join.nextEdgeId,
        source: join.id,
        target: 'end',
      });
      expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(
        graph.nodes.length,
      );
      expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);

      if (kind === 'exclusiveGateway') {
        expect(fork.branches?.[0]?.default).toBe(true);
        expect(fork.branches?.[1]).not.toHaveProperty('condition');
        expect(() => projectV3ToV2(updated)).toThrow();
      } else {
        expect(
          fork.branches?.every(
            (branch) => !branch.default && !branch.condition,
          ),
        ).toBe(true);
        expect(projectV3ToV2(updated).nodes).toHaveLength(5);
      }
    },
  );

  it('嵌套在排他出口保留外层 condition/default 与 metadata', () => {
    const source = exclusive();
    const before = structuredClone(source);
    const original = projectV3ToV2(source).edges?.find(
      (edge) => edge.id === 'c_l',
    );
    const {
      definition: updated,
      fork,
      join,
    } = insertGatewayOnTreeEdge(source, 'c_l', 'parallelGateway');
    const graph = projectDraftV3ToV2(updated);
    const branch = updated.flowTree.next?.branches?.[0];

    expect(source).toEqual(before);
    expect(branch?.id).toBe('branch:c_l');
    expect(branch?.condition).toEqual(original?.condition);
    expect(branch?.metadata).toEqual({ label: '大额' });
    expect(graph.edges?.find((edge) => edge.id === 'c_l')).toEqual({
      ...original,
      target: fork.id,
    });
    expect(graph.edges).toContainEqual({
      id: join.nextEdgeId,
      source: join.id,
      target: 'left',
    });
    expect(projectV3ToV2(updated).nodes).toHaveLength(7);
  });

  it('排他默认出口和并行网关原始出口的外层语义均不被覆盖', () => {
    const defaultBranch = insertGatewayOnTreeEdge(
      exclusive(),
      'c_r',
      'parallelGateway',
    );
    expect(
      projectDraftV3ToV2(defaultBranch.definition).edges?.find(
        (edge) => edge.id === 'c_r',
      ),
    ).toMatchObject({
      default: true,
      metadata: { label: '默认' },
      target: defaultBranch.fork.id,
    });
    expect(defaultBranch.definition.flowTree.next?.branches?.[1]?.id).toBe(
      'branch:c_r',
    );

    const parallelBranch = insertGatewayOnTreeEdge(
      parallel(),
      'f_l',
      'parallelGateway',
    );
    expect(
      projectDraftV3ToV2(parallelBranch.definition).edges?.find(
        (edge) => edge.id === 'f_l',
      ),
    ).toMatchObject({ metadata: { lane: 1 }, target: parallelBranch.fork.id });
    expect(parallelBranch.definition.flowTree.next?.joinId).toBe('join');
    expect(projectV3ToV2(parallelBranch.definition).nodes).toHaveLength(8);
  });

  it('嵌套在并行分支直指外层 join 的边，内外汇聚保持独立', () => {
    const source = parallel();
    const before = structuredClone(source);
    const {
      definition: updated,
      fork,
      join,
    } = insertGatewayOnTreeEdge(source, 'l_j', 'exclusiveGateway');
    const graph = projectDraftV3ToV2(updated);

    expect(source).toEqual(before);
    expect(graph.edges).toContainEqual({
      id: 'l_j',
      source: 'left',
      target: fork.id,
    });
    expect(graph.edges).toContainEqual({
      id: join.nextEdgeId,
      source: join.id,
      target: 'join',
    });
    expect(updated.flowTree.next?.joinId).toBe('join');
    expect(fork.joinId).toBe(join.id);
    expect(() => projectV3ToV2(updated)).toThrow();
  });

  it('已占用的节点/连线 ID 自动避开，过期边与未知网关拒绝', () => {
    const source = serial();
    if (!source.flowTree.next) throw new Error('测试流程缺少审批节点');
    source.flowTree.next.nextEdgeId = 'exclusiveGateway_1';
    const result = insertGatewayOnTreeEdge(source, 's_r', 'exclusiveGateway');
    expect(result.fork.id).toBe('exclusiveGateway_2');
    expect(
      projectDraftV3ToV2(result.definition).edges?.map((edge) => edge.id),
    ).toContain('exclusiveGateway_1');

    const before = structuredClone(source);
    expect(() =>
      insertGatewayOnTreeEdge(source, 'stale', 'parallelGateway'),
    ).toThrow(/已不存在/);
    expect(() =>
      insertGatewayOnTreeEdge(source, 's_r', 'scriptGateway' as never),
    ).toThrow(/不支持的网关/);
    expect(source).toEqual(before);
  });
});

describe('受限 lowflow 树终局分叉与普通审批删除', () => {
  it('唯一入边的结束节点可拆成原终局与拒绝终局，原边及输入不变', () => {
    const source = serial();
    const before = structuredClone(source);
    const {
      definition: updated,
      fork,
      originalEnd,
      rejectedEnd,
    } = insertExclusiveOutcomesOnTreeEdge(source, 'r_e');
    const graph = projectDraftV3ToV2(updated);

    expect(source).toEqual(before);
    expect(updated).not.toHaveProperty('nodes');
    expect(updated).not.toHaveProperty('edges');
    expect(originalEnd.id).toBe('end');
    expect(rejectedEnd.outcome).toBe('Rejected');
    expect(fork).not.toHaveProperty('joinId');
    expect(fork).not.toHaveProperty('next');
    expect(fork.branches?.[0]?.default).toBe(true);
    expect(fork.branches?.[0]?.next).toBe(originalEnd);
    expect(fork.branches?.[1]?.next).toBe(rejectedEnd);
    expect(fork.branches?.[1]).not.toHaveProperty('condition');
    expect(graph.edges).toContainEqual({
      id: 'r_e',
      source: 'review',
      target: fork.id,
      metadata: { color: 'muted' },
    });
    expect(graph.edges?.filter((edge) => edge.source === fork.id)).toHaveLength(
      2,
    );
    expect(() => projectV3ToV2(updated)).toThrow();

    // 后续配置受控条件后才具备严格执行拓扑，而非插入时伪造条件。
    const completed = patchWorkflowTreeEdge(
      updated,
      fork.branches?.[1]?.edgeId ?? '',
      { condition: { eq: [{ variable: 'amount' }, { literal: 0 }] } },
    );
    expect(projectV3ToV2(completed).nodes).toHaveLength(5);
  });

  it('嵌套在排他支路内只拆该支路唯一结束节点', () => {
    const source = exclusiveOutcomes();
    const before = structuredClone(source);
    const {
      definition: updated,
      fork,
      originalEnd,
      rejectedEnd,
    } = insertExclusiveOutcomesOnTreeEdge(source, 'l_e');
    const graph = projectDraftV3ToV2(updated);

    expect(source).toEqual(before);
    expect(originalEnd.id).toBe('leftEnd');
    expect(rejectedEnd.id).not.toBe('rightEnd');
    expect(graph.edges?.find((edge) => edge.id === 'l_e')).toMatchObject({
      target: fork.id,
    });
    expect(graph.edges?.find((edge) => edge.id === 'c_l')).toEqual(
      projectV3ToV2(source).edges?.find((edge) => edge.id === 'c_l'),
    );
    expect(graph.edges?.find((edge) => edge.id === 'r_e')).toEqual(
      projectV3ToV2(source).edges?.find((edge) => edge.id === 'r_e'),
    );
  });

  it('共享结束目标、非 end 目标、过期边与冲突身份拒绝或避开', () => {
    const source = serial();
    if (!source.flowTree.next) throw new Error('测试流程缺少审批任务');
    source.flowTree.next.nextEdgeId = 'endRejected_1';
    const before = structuredClone(source);
    const inserted = insertExclusiveOutcomesOnTreeEdge(source, 'endRejected_1');
    expect(inserted.rejectedEnd.id).toBe('endRejected_2');
    expect(source).toEqual(before);

    expect(() => insertExclusiveOutcomesOnTreeEdge(exclusive(), 'l_e')).toThrow(
      /唯一入边/,
    );
    expect(() => insertExclusiveOutcomesOnTreeEdge(serial(), 's_r')).toThrow(
      /结束节点/,
    );
    expect(() => insertExclusiveOutcomesOnTreeEdge(serial(), 'stale')).toThrow(
      /已不存在/,
    );
  });

  it('串行普通任务删除保留入边 ID/metadata，移除原出边且输入不变', () => {
    const source = serial();
    const before = structuredClone(source);
    const inserted = insertUserTaskOnTreeEdge(source, 'r_e');
    const updated = removeTreeUserTask(inserted.definition, inserted.node.id);

    expect(source).toEqual(before);
    expect(inserted.definition.flowTree.next?.next?.id).toBe(inserted.node.id);
    expect(updated).toEqual(source);
    expect(projectV3ToV2(updated).edges).toContainEqual({
      id: 'r_e',
      source: 'review',
      target: 'end',
      metadata: { color: 'muted' },
    });

    const removedOriginal = removeTreeUserTask(source, 'review');
    expect(projectV3ToV2(removedOriginal).edges).toEqual([
      { id: 's_r', source: 'start', target: 'end' },
    ]);
  });

  it('排他条件出口和并行汇聚前任务删除保留原分支语义', () => {
    const exclusiveSource = exclusive();
    const exclusiveUpdated = removeTreeUserTask(exclusiveSource, 'left');
    expect(
      projectDraftV3ToV2(exclusiveUpdated).edges?.find(
        (edge) => edge.id === 'c_l',
      ),
    ).toEqual({
      id: 'c_l',
      source: 'choice',
      target: 'end',
      condition: { gt: [{ variable: 'amount' }, { literal: 100 }] },
      metadata: { label: '大额' },
    });
    expect(
      projectDraftV3ToV2(exclusiveUpdated).edges?.some(
        (edge) => edge.id === 'l_e',
      ),
    ).toBe(false);
    expect(exclusiveSource.flowTree.next?.branches?.[0]?.next?.id).toBe('left');

    const parallelSource = parallel();
    const parallelUpdated = removeTreeUserTask(parallelSource, 'left');
    expect(projectV3ToV2(parallelUpdated).edges).toContainEqual({
      id: 'f_l',
      source: 'fork',
      target: 'join',
      metadata: { lane: 1 },
    });
    expect(
      projectV3ToV2(parallelUpdated).edges?.some((edge) => edge.id === 'l_j'),
    ).toBe(false);
  });

  it('非普通任务、缺失及损坏的共享拓扑拒绝删除', () => {
    const source = serial();
    const before = structuredClone(source);
    for (const id of ['start', 'end', 'missing'])
      expect(() => removeTreeUserTask(source, id)).toThrow();
    expect(() => removeTreeUserTask(exclusive(), 'choice')).toThrow();
    expect(source).toEqual(before);

    const broken = serial();
    if (!broken.flowTree.next) throw new Error('测试流程缺少审批任务');
    delete broken.flowTree.next.nextEdgeId;
    expect(() => removeTreeUserTask(broken, 'review')).toThrow(
      WorkflowTreeVersionError,
    );

    const shared = exclusive();
    if (!shared.flowTree.next?.branches?.[1]?.next)
      throw new Error('测试分支缺少审批任务');
    shared.flowTree.next.branches[1].targetId = 'left';
    shared.flowTree.next.branches[1].next.id = 'left';
    expect(() => removeTreeUserTask(shared, 'left')).toThrow(
      WorkflowTreeVersionError,
    );
  });
});
