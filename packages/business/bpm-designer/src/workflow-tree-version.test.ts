import type { WorkflowDesignerDefinition } from './types';
import type { WorkflowTreeVersion } from './workflow-tree-version';

import { describe, expect, it } from 'vitest';

import {
  convertDraftV2ToV3,
  convertV2ToV3,
  projectDraftV3ToV2,
  projectV3ToV2,
  WorkflowTreeVersionError,
} from './workflow-tree-version';

function version(
  nodes: WorkflowDesignerDefinition['nodes'],
  edges: NonNullable<WorkflowDesignerDefinition['edges']>,
): WorkflowDesignerDefinition {
  return {
    schemaVersion: 2,
    processKey: 'approval',
    name: '审批',
    purposeKey: 'review',
    businessBinding: {
      businessType: 'request',
      contractVersion: 1,
      identityField: 'id',
      titleField: 'title',
    },
    variables: {
      amount: { source: 'business.amount', type: 'integer', readAt: 'start' },
    },
    nodes,
    edges,
  };
}

function task(id: string) {
  return {
    id,
    type: 'userTask' as const,
    name: `审批 ${id}`,
    candidateUsers: ['user:7'],
    actions: ['approve', 'reject'],
    allowSelfApproval: false,
    readableFields: ['amount'],
    editableFields: ['amount'],
    formAction: 'save',
  };
}

describe('受控动态审批人树配置', () => {
  it('参数只接受封闭 operand，不能通过树配置注入执行表达式', () => {
    const value = serial();
    const node = value.nodes[1];
    if (!node) throw new Error('缺少审批节点');
    node.approverResolver = {
      key: 'departmentLead',
      parameters: { level: { literal: 2 } },
    };
    const tree = convertV2ToV3(value);
    expect(tree.flowTree.next?.approverResolver).toEqual(node.approverResolver);
    expect(projectV3ToV2(tree).nodes[1]?.approverResolver).toEqual(
      node.approverResolver,
    );
    const taskNode = tree.flowTree.next;
    if (!taskNode?.approverResolver) throw new Error('缺少动态审批节点');
    (taskNode.approverResolver as object & { expression?: string }).expression =
      'untrusted expression';
    expect(() => projectV3ToV2(tree)).toThrow('不支持的字段');
    delete (taskNode.approverResolver as object & { expression?: string })
      .expression;
    taskNode.approverResolver.parameters = {
      level: { literal: 2, variable: 'level' },
    };
    expect(() => projectV3ToV2(tree)).toThrow('必须且只能包含');
  });
});

function serial() {
  return version(
    [
      { id: 'start', type: 'start', name: '开始', x: 12, y: 24 },
      task('review'),
      { id: 'end', type: 'end', name: '结束', outcome: 'Approved' },
    ],
    [
      {
        id: 's_r',
        source: 'start',
        target: 'review',
        metadata: { color: 'muted' },
      },
      {
        id: 'r_e',
        source: 'review',
        target: 'end',
        metadata: { bend: [1, 2] },
      },
    ] as object & WorkflowDesignerDefinition['edges'],
  );
}

function exclusive() {
  return version(
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
    ] as object & WorkflowDesignerDefinition['edges'],
  );
}

function parallel() {
  return version(
    [
      { id: 'start', type: 'start', name: '开始' },
      { id: 'fork', type: 'parallelGateway', name: '并行分叉', joinId: 'join' },
      task('left'),
      task('right'),
      { id: 'join', type: 'parallelGateway', name: '并行汇聚' },
      { id: 'end', type: 'end', name: '结束', outcome: 'Approved' },
    ],
    [
      { id: 's_f', source: 'start', target: 'fork' },
      { id: 'f_l', source: 'fork', target: 'left', metadata: { lane: 1 } },
      { id: 'f_r', source: 'fork', target: 'right', metadata: { lane: 2 } },
      { id: 'l_j', source: 'left', target: 'join' },
      { id: 'r_j', source: 'right', target: 'join' },
      { id: 'j_e', source: 'join', target: 'end' },
    ] as object & WorkflowDesignerDefinition['edges'],
  );
}

describe('v2 平面图与 v3 受限树纯转换', () => {
  it('草稿单入单出网关保留节点、两边和 metadata，严格路径仍拒绝', () => {
    const draft = version(
      [
        { id: 'start', name: '开始', type: 'start' },
        { id: 'choice', name: '未拆分网关', type: 'exclusiveGateway' },
        { id: 'end', name: '结束', type: 'end', outcome: 'Approved' },
      ],
      [
        { id: 's_c', source: 'start', target: 'choice' },
        {
          id: 'c_e',
          source: 'choice',
          target: 'end',
          metadata: { label: '原边' },
        },
      ] as NonNullable<WorkflowDesignerDefinition['edges']> & object,
    );
    expect(() => convertV2ToV3(draft)).toThrow();
    const tree = convertDraftV2ToV3(draft);
    expect(tree.flowTree.next).toMatchObject({
      id: 'choice',
      nextEdgeId: 'c_e',
      nextTargetId: 'end',
      nextEdgeMetadata: { label: '原边' },
    });
    expect(projectDraftV3ToV2(tree).edges?.map((edge) => edge.id)).toEqual([
      's_c',
      'c_e',
    ]);
    expect(() => projectV3ToV2(tree)).toThrow();
  });

  it('草稿排他分叉可以缺少条件或默认，但不丢原始出口身份', () => {
    const draft = exclusive();
    if (!draft.edges?.[1] || !draft.edges?.[2]) throw new Error('测试分支缺失');
    delete draft.edges[1].condition;
    delete draft.edges[2].default;
    expect(() => convertV2ToV3(draft)).toThrow();
    const tree = convertDraftV2ToV3(draft);
    expect(
      tree.flowTree.next?.branches?.map((branch) => branch.edgeId),
    ).toEqual(['c_l', 'c_r']);
    expect(
      tree.flowTree.next?.branches?.every(
        (branch) => !branch.condition && !branch.default,
      ),
    ).toBe(true);
    expect(
      projectDraftV3ToV2(tree)
        .edges?.map((edge) => edge.id)
        .toSorted(),
    ).toEqual(['c_l', 'c_r', 'l_e', 'r_e', 's_c'].toSorted());
    expect(() => projectV3ToV2(tree)).toThrow();
  });

  it('草稿投影仍拒绝未知键、丢目标、重复身份和错误条件', () => {
    const draft = convertDraftV2ToV3(exclusive());
    (draft.flowTree as object as Record<string, unknown>).executionListeners =
      [];
    expect(() => projectDraftV3ToV2(draft)).toThrow(/不支持的字段/);
    delete (draft.flowTree as object as Record<string, unknown>)
      .executionListeners;

    const missing = convertDraftV2ToV3(exclusive());
    if (!missing.flowTree.next?.branches?.[0]) throw new Error('测试分支缺失');
    missing.flowTree.next.branches[0].targetId = 'absent';
    expect(() => projectDraftV3ToV2(missing)).toThrow();

    const repeated = convertDraftV2ToV3(exclusive());
    if (!repeated.flowTree.next?.branches?.[1]) throw new Error('测试分支缺失');
    repeated.flowTree.next.branches[1].edgeId = 'c_l';
    expect(() => projectDraftV3ToV2(repeated)).toThrow();

    const invalidCondition = convertDraftV2ToV3(exclusive());
    if (!invalidCondition.flowTree.next?.branches?.[0])
      throw new Error('测试分支缺失');
    invalidCondition.flowTree.next.branches[0].condition = {
      unknown: true,
    } as never;
    expect(() => projectDraftV3ToV2(invalidCondition)).toThrow(
      /不支持的条件运算符/,
    );
  });

  it.each([
    ['串行', serial],
    ['排他分支及公共后继', exclusive],
    ['结构化并行汇聚', parallel],
  ])('%s 保留全部原节点、边、业务配置及展示 metadata', (_name, create) => {
    const original = create();
    const snapshot = structuredClone(original);
    const tree = convertV2ToV3(original);

    expect(tree.schemaVersion).toBe(3);
    expect(tree).not.toHaveProperty('nodes');
    expect(tree).not.toHaveProperty('edges');
    expect(JSON.stringify(tree)).not.toMatch(
      /incomingEdgeIds|branchKind|status/,
    );
    const projected = projectV3ToV2(tree);
    expect(projected).toMatchObject({
      schemaVersion: 2,
      processKey: original.processKey,
      businessBinding: original.businessBinding,
      variables: original.variables,
    });
    // v3 树不保存无执行语义的平面数组顺序；逐个稳定 ID 核对完整配置。
    expect(
      projected.nodes.toSorted((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(original.nodes.toSorted((a, b) => a.id.localeCompare(b.id)));
    expect(
      projected.edges?.toSorted((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(original.edges?.toSorted((a, b) => a.id.localeCompare(b.id)));
    expect(original).toEqual(snapshot);
  });

  it('串行边 metadata 只保存在节点 nextEdgeMetadata 中并投影回原边', () => {
    const tree = convertV2ToV3(serial());
    expect(tree.flowTree.nextEdgeMetadata).toEqual({ color: 'muted' });
    expect(tree.flowTree.next?.nextEdgeMetadata).toEqual({ bend: [1, 2] });
    expect(tree.flowTree.next?.candidateUsers).toEqual(['user:7']);
    expect(tree.flowTree.next?.formAction).toBe('save');
  });

  it('排他分支保留条件、默认边、包装 ID、metadata 和唯一汇聚', () => {
    const tree = convertV2ToV3(exclusive());
    const gateway = tree.flowTree.next;
    expect(gateway?.joinId).toBe('end');
    expect(gateway?.branches?.map((branch) => branch.id)).toEqual([
      'branch:c_l',
      'branch:c_r',
    ]);
    expect(gateway?.branches?.[0]?.metadata).toEqual({ label: '大额' });
    expect(gateway?.branches?.[1]?.default).toBe(true);
    expect(gateway?.next?.id).toBe('end');
    expect(gateway?.branches?.[0]?.next?.next).toBeUndefined();
  });

  it('并行分支不携带排他条件，汇聚网关只保留一次', () => {
    const tree = convertV2ToV3(parallel());
    const gateway = tree.flowTree.next;
    expect(gateway?.joinId).toBe('join');
    expect(gateway?.branches?.[0]?.metadata).toEqual({ lane: 1 });
    expect(gateway?.branches?.[0]?.condition).toBeUndefined();
    expect(gateway?.branches?.[0]?.next?.nextTargetId).toBe('join');
    expect(gateway?.next?.id).toBe('join');
  });

  it('拒绝未知执行节点、未知属性和并列平面图', () => {
    const unsupported = serial();
    unsupported.nodes[1] = {
      id: 'review',
      type: 'serviceTask' as 'userTask',
      name: '服务任务',
    };
    expect(() => convertV2ToV3(unsupported)).toThrow(WorkflowTreeVersionError);

    const tree = convertV2ToV3(serial());
    (
      tree.flowTree.next as object as Record<string, unknown>
    ).executionListeners = [];
    expect(() => projectV3ToV2(tree)).toThrow(/不支持的字段/);
    delete (tree.flowTree.next as object as Record<string, unknown>)
      .executionListeners;
    (tree as object as Record<string, unknown>).nodes = [];
    expect(() => projectV3ToV2(tree)).toThrow(/不支持的字段|不能并列/);
  });

  it('拒绝重复身份、丢边、伪造分支包装和错误汇聚', () => {
    const duplicate = convertV2ToV3(serial());
    if (!duplicate.flowTree.next?.next) throw new Error('测试流程缺少后继');
    duplicate.flowTree.next.next.id = 'start';
    duplicate.flowTree.next.nextTargetId = 'start';
    expect(() => projectV3ToV2(duplicate)).toThrow(/重复/);

    const missing = convertV2ToV3(serial());
    if (!missing.flowTree.next) throw new Error('测试流程缺少审批');
    delete missing.flowTree.next.nextEdgeId;
    expect(() => projectV3ToV2(missing)).toThrow(/缺少成对/);

    const branch = convertV2ToV3(exclusive());
    if (!branch.flowTree.next?.branches?.[0])
      throw new Error('测试流程缺少分支');
    branch.flowTree.next.branches[0].id = 'branch:other';
    expect(() => projectV3ToV2(branch)).toThrow(/包装标识/);

    const join = convertV2ToV3(parallel());
    if (!join.flowTree.next) throw new Error('测试流程缺少并行网关');
    join.flowTree.next.joinId = 'end';
    expect(() => projectV3ToV2(join)).toThrow(WorkflowTreeVersionError);
  });

  it('拒绝伪造运行态、循环对象、过量配置及错误条件', () => {
    const status = convertV2ToV3(serial());
    (status.flowTree as object as Record<string, unknown>).status = 'completed';
    expect(() => projectV3ToV2(status)).toThrow(/不支持的字段/);

    const cyclic = convertV2ToV3(serial());
    cyclic.flowTree.next = cyclic.flowTree;
    expect(() => projectV3ToV2(cyclic)).toThrow(/循环/);

    const huge = convertV2ToV3(serial());
    huge.metadata = { note: 'x'.repeat(263_000) };
    expect(() => projectV3ToV2(huge)).toThrow(/大小限制/);

    const condition = convertV2ToV3(exclusive());
    if (!condition.flowTree.next?.branches?.[0])
      throw new Error('测试流程缺少条件');
    condition.flowTree.next.branches[0].default = true;
    expect(() => projectV3ToV2(condition)).toThrow(/默认分支|条件或默认/);
  });

  it('显式 false 默认边不能丢失或作为 v3 分支保留', () => {
    const source = exclusive();
    if (!source.edges?.[1]) throw new Error('测试流程缺少分支');
    source.edges[1].default = false;
    expect(() => convertV2ToV3(source)).toThrow(/显式 false/);

    const tree = convertV2ToV3(exclusive());
    if (!tree.flowTree.next?.branches?.[0]) throw new Error('测试流程缺少分支');
    tree.flowTree.next.branches[0].default = false;
    expect(() => projectV3ToV2(tree)).toThrow(/default 只能为 true/);
  });

  it('v3 输入拒绝客户端提供的根投影摘要', () => {
    const tree: WorkflowTreeVersion = convertV2ToV3(serial());
    (tree as object as Record<string, unknown>).projectedDigest = 'fake';
    expect(() => projectV3ToV2(tree)).toThrow(/不支持的字段/);
  });

  it('与后端纯投影器的串行 JSON 样例保持同一节点、边与 metadata', () => {
    // 与 WorkflowLowflowTreeProjectorTest 的 serial fixture 使用相同字段和原始 ID。
    const input = {
      schemaVersion: 3,
      name: '审核',
      processKey: 'review',
      flowTree: {
        id: 'start',
        type: 'start',
        name: '开始',
        metadata: { color: 'blue' },
        nextEdgeId: 's_task',
        nextTargetId: 'task',
        nextEdgeMetadata: { label: '提交' },
        next: {
          id: 'task',
          type: 'userTask',
          name: '审批',
          candidateUsers: ['user:1'],
          actions: ['approve', 'reject'],
          nextEdgeId: 'task_end',
          nextTargetId: 'end',
          next: { id: 'end', type: 'end', name: '结束', outcome: 'Approved' },
        },
      },
    } as WorkflowTreeVersion;
    const projected = projectV3ToV2(input);
    expect(projected.nodes.map((node) => node.id)).toEqual([
      'start',
      'task',
      'end',
    ]);
    expect(projected.edges?.map((edge) => edge.id)).toEqual([
      's_task',
      'task_end',
    ]);
    expect(
      (projected.nodes[0] as object as Record<string, unknown>).metadata,
    ).toEqual({ color: 'blue' });
    expect(
      (projected.edges?.[0] as object as Record<string, unknown>).metadata,
    ).toEqual({ label: '提交' });
    expect(projected.nodes[1]?.candidateUsers).toEqual(['user:1']);
    expect(projected.nodes[2]?.outcome).toBe('Approved');
  });
});
