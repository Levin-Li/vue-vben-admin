import type { WorkflowCondition } from './types';
import type {
  WorkflowTreeBranch,
  WorkflowTreeNode,
  WorkflowTreeVersion,
} from './workflow-tree-version';

import {
  projectDraftV3ToV2,
  WorkflowTreeVersionError,
} from './workflow-tree-version';

export interface WorkflowTreeInsertResult {
  definition: WorkflowTreeVersion;
  node: WorkflowTreeNode;
}

export interface WorkflowTreeGatewayInsertResult {
  definition: WorkflowTreeVersion;
  fork: WorkflowTreeNode;
  join: WorkflowTreeNode;
}

export interface WorkflowTreeOutcomeInsertResult {
  definition: WorkflowTreeVersion;
  fork: WorkflowTreeNode;
  originalEnd: WorkflowTreeNode;
  rejectedEnd: WorkflowTreeNode;
}

export type WorkflowTreeNodePatch = Partial<
  Omit<
    WorkflowTreeNode,
    | 'branches'
    | 'id'
    | 'joinId'
    | 'metadata'
    | 'next'
    | 'nextEdgeId'
    | 'nextEdgeMetadata'
    | 'nextTargetId'
    | 'type'
  >
>;

export interface WorkflowTreeEdgePatch {
  condition?: null | WorkflowCondition;
  default?: boolean;
}

const NODE_PATCH_KEYS = new Set([
  'actionCandidateGroups',
  'actionCandidateUsers',
  'actions',
  'allowSelfApproval',
  'approverResolver',
  'candidateGroups',
  'candidateUsers',
  'deadlineEscalationUsers',
  'deadlineMinutes',
  'editableFields',
  'emptyAssigneePolicy',
  'escalationCandidateGroups',
  'escalationCandidateUsers',
  'formAction',
  'multiApprovalMode',
  'name',
  'outcome',
  'readableFields',
  'reminderMinutes',
  'requiredFields',
  'returnTargets',
  'stepUpVerifyTypes',
  'x',
  'y',
]);

function patchKeys(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkflowTreeVersionError('树属性补丁必须是对象。');
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!allowed.has(key))
      throw new WorkflowTreeVersionError(`树属性补丁不支持字段「${key}」。`);
  }
  return keys;
}

function cloneDraft(version: WorkflowTreeVersion): WorkflowTreeVersion {
  // 先拒绝未知键、丢边及重复身份，再复制而不修改调用者的树。
  projectDraftV3ToV2(version);
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(version)) as WorkflowTreeVersion;
}

function findNode(
  current: WorkflowTreeNode,
  nodeId: string,
): undefined | WorkflowTreeNode {
  if (current.id === nodeId) return current;
  for (const branch of current.branches ?? []) {
    if (branch.next) {
      const found = findNode(branch.next, nodeId);
      if (found) return found;
    }
  }
  return current.next ? findNode(current.next, nodeId) : undefined;
}

function findBranch(
  current: WorkflowTreeNode,
  edgeId: string,
): undefined | { branch: WorkflowTreeBranch; gateway: WorkflowTreeNode } {
  for (const branch of current.branches ?? []) {
    if (branch.edgeId === edgeId) return { branch, gateway: current };
    if (branch.next) {
      const found = findBranch(branch.next, edgeId);
      if (found) return found;
    }
  }
  return current.next ? findBranch(current.next, edgeId) : undefined;
}

/** 按稳定节点 ID 修改非拓扑属性；草稿允许暂未配齐，但身份和树结构必须合法。 */
export function patchWorkflowTreeNode(
  version: WorkflowTreeVersion,
  nodeId: string,
  patch: WorkflowTreeNodePatch,
): WorkflowTreeVersion {
  const keys = patchKeys(patch, NODE_PATCH_KEYS);
  const definition = cloneDraft(version);
  const node = findNode(definition.flowTree, nodeId);
  if (!node) throw new WorkflowTreeVersionError(`节点「${nodeId}」已不存在。`);

  // undefined 删除可选属性；必填名称或节点专属属性仍由投影器复核。
  const fields = node as unknown as Record<string, unknown>;
  const values = patch as Record<string, unknown>;
  for (const key of keys) {
    if (values[key] === undefined) Reflect.deleteProperty(fields, key);
    else fields[key] = values[key];
  }
  projectDraftV3ToV2(definition);
  return definition;
}

/** 仅排他网关出口可编辑条件/default；原边 ID、目标与 metadata 永不移动。 */
export function patchWorkflowTreeEdge(
  version: WorkflowTreeVersion,
  edgeId: string,
  patch: WorkflowTreeEdgePatch,
): WorkflowTreeVersion {
  const keys = patchKeys(patch, new Set(['condition', 'default']));
  if (keys.includes('condition') && keys.includes('default'))
    throw new WorkflowTreeVersionError('条件与默认出口必须分开设置。');
  const definition = cloneDraft(version);
  const selected = findBranch(definition.flowTree, edgeId);
  if (!selected || selected.gateway.type !== 'exclusiveGateway')
    throw new WorkflowTreeVersionError(
      `连线「${edgeId}」不是可编辑的排他网关出口。`,
    );

  // 默认出口与条件互斥；关闭 default 时删除键，不能写入 false。
  if (keys.includes('default')) {
    if (patch.default === true) {
      delete selected.branch.condition;
      for (const sibling of selected.gateway.branches ?? [])
        delete sibling.default;
      selected.branch.default = true;
    } else if (patch.default === false) {
      delete selected.branch.default;
    } else {
      throw new WorkflowTreeVersionError('默认出口标记必须是布尔值。');
    }
  }
  if (keys.includes('condition')) {
    delete selected.branch.default;
    if (patch.condition === null) delete selected.branch.condition;
    else selected.branch.condition = patch.condition;
  }
  projectDraftV3ToV2(definition);
  return definition;
}

/** 在指定稳定连线处插入审批节点；原连线身份及其配置仍归原来源节点。 */
export function insertUserTaskOnTreeEdge(
  version: WorkflowTreeVersion,
  selectedEdgeId: string,
): WorkflowTreeInsertResult {
  // 草稿允许待拆网关和未配齐出口，但必须先核实边、身份和受限字段。
  const graph = projectDraftV3ToV2(version);
  const selected = graph.edges?.find((edge) => edge.id === selectedEdgeId);
  if (!selected)
    throw new WorkflowTreeVersionError(
      `选中的连线「${selectedEdgeId}」已不存在。`,
    );

  // 新身份同时避开全部真实节点和连线，不能只检查同类 ID。
  const usedIds = new Set([
    ...(graph.edges ?? []).map((edge) => edge.id),
    ...graph.nodes.map((node) => node.id),
  ]);
  let index = 1;
  while (usedIds.has(`userTask_${index}`)) index++;
  const taskId = `userTask_${index}`;
  usedIds.add(taskId);

  let edgeIndex = 1;
  while (usedIds.has(`${taskId}_next_${edgeIndex}`)) edgeIndex++;
  const newEdgeId = `${taskId}_next_${edgeIndex}`;

  // Vue 代理不能直接 structuredClone；受限树已经通过 JSON 校验和投影。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const definition = JSON.parse(JSON.stringify(version)) as WorkflowTreeVersion;
  const node: WorkflowTreeNode = {
    id: taskId,
    type: 'userTask',
    name: `审批 ${index}`,
    actions: ['approve', 'reject'],
    candidateUsers: [],
    candidateGroups: [],
    multiApprovalMode: 'NONE',
    allowSelfApproval: false,
    nextEdgeId: newEdgeId,
    nextTargetId: selected.target,
  };

  // 分支出口的条件、default、metadata 和包装 ID 全部留在原边。
  let inserted = false;
  function visit(current: WorkflowTreeNode): void {
    if (inserted) return;
    if (current.nextEdgeId === selectedEdgeId) {
      if (current.next) node.next = current.next;
      current.nextTargetId = taskId;
      current.next = node;
      inserted = true;
      return;
    }
    for (const branch of current.branches ?? []) {
      if (branch.edgeId === selectedEdgeId) {
        if (branch.next) node.next = branch.next;
        branch.targetId = taskId;
        branch.next = node;
        inserted = true;
        return;
      }
      if (branch.next) visit(branch.next);
    }
    if (current.next) visit(current.next);
  }
  visit(definition.flowTree);
  if (!inserted)
    throw new WorkflowTreeVersionError(
      `选中的连线「${selectedEdgeId}」已不存在。`,
    );

  // 新树仍须通过草稿投影；此门禁不代表它可模拟或发布。
  projectDraftV3ToV2(definition);
  return { definition, node };
}

/** 以结构化 fork/join 拆原边；新分支只属于草稿，排他条件仍须后续补齐。 */
export function insertGatewayOnTreeEdge(
  version: WorkflowTreeVersion,
  selectedEdgeId: string,
  kind: 'exclusiveGateway' | 'parallelGateway',
): WorkflowTreeGatewayInsertResult {
  // 原边必须已存在于一棵受限、连通的草稿树中，不能凭节点顺序推断位置。
  const graph = projectDraftV3ToV2(version);
  const selected = graph.edges?.find((edge) => edge.id === selectedEdgeId);
  if (!selected)
    throw new WorkflowTreeVersionError(
      `选中的连线「${selectedEdgeId}」已不存在。`,
    );
  if (kind !== 'exclusiveGateway' && kind !== 'parallelGateway')
    throw new WorkflowTreeVersionError(`不支持的网关类型「${kind}」。`);

  // 所有新真实节点和连线共用一份身份空间，避免跨类型 ID 冲突。
  const usedIds = new Set([
    ...(graph.edges ?? []).map((edge) => edge.id),
    ...graph.nodes.map((node) => node.id),
  ]);
  function allocate(prefix: string): string {
    let index = 1;
    while (usedIds.has(`${prefix}_${index}`)) index++;
    const id = `${prefix}_${index}`;
    usedIds.add(id);
    return id;
  }
  const forkId = allocate(kind);
  const joinId = allocate(`${kind}Join`);
  const firstEdgeId = allocate(`${forkId}_branch`);
  const secondEdgeId = allocate(`${forkId}_branch`);
  const joinEdgeId = allocate(`${joinId}_next`);
  const exclusive = kind === 'exclusiveGateway';

  // 两条原始分支边直达唯一汇聚；排他草稿只预置默认出口，不伪造第二支条件。
  const fork: WorkflowTreeNode = {
    id: forkId,
    name: exclusive ? '条件分支' : '并行分叉',
    type: kind,
    joinId,
    branches: [
      {
        id: `branch:${firstEdgeId}`,
        name: exclusive ? '默认分支' : '并行分支 1',
        type: 'condition',
        edgeId: firstEdgeId,
        targetId: joinId,
        ...(exclusive ? { default: true } : {}),
      },
      {
        id: `branch:${secondEdgeId}`,
        name: exclusive ? '条件分支' : '并行分支 2',
        type: 'condition',
        edgeId: secondEdgeId,
        targetId: joinId,
      },
    ],
  };
  const join: WorkflowTreeNode = {
    id: joinId,
    name: exclusive ? '条件汇聚' : '并行汇聚',
    type: kind,
    nextEdgeId: joinEdgeId,
    nextTargetId: selected.target,
  };
  fork.next = join;

  // 只改原边的目标，原条件、默认及 metadata 仍附着在原来源节点或包装边。
  const definition = cloneDraft(version);
  let inserted = false;
  function visit(current: WorkflowTreeNode): void {
    if (inserted) return;
    if (current.nextEdgeId === selectedEdgeId) {
      if (current.next) join.next = current.next;
      current.nextTargetId = forkId;
      current.next = fork;
      inserted = true;
      return;
    }
    for (const branch of current.branches ?? []) {
      if (branch.edgeId === selectedEdgeId) {
        if (branch.next) join.next = branch.next;
        branch.targetId = forkId;
        branch.next = fork;
        inserted = true;
        return;
      }
      if (branch.next) visit(branch.next);
    }
    if (current.next) visit(current.next);
  }
  visit(definition.flowTree);
  if (!inserted)
    throw new WorkflowTreeVersionError(
      `选中的连线「${selectedEdgeId}」已不存在。`,
    );

  // 草稿拓扑必须仍能完整投影；执行门禁仍由严格投影、模拟和发布承担。
  projectDraftV3ToV2(definition);
  return { definition, fork, join };
}

/** 仅拆唯一入边的终局：原 end 继续留在默认支，另一支创建拒绝终局。 */
export function insertExclusiveOutcomesOnTreeEdge(
  version: WorkflowTreeVersion,
  selectedEdgeId: string,
): WorkflowTreeOutcomeInsertResult {
  // 原目标必须是唯一入边的真实结束节点；共享结束点需另行显式重构。
  const graph = projectDraftV3ToV2(version);
  const selected = graph.edges?.find((edge) => edge.id === selectedEdgeId);
  if (!selected)
    throw new WorkflowTreeVersionError(
      `选中的连线「${selectedEdgeId}」已不存在。`,
    );
  if (
    graph.nodes.find((node) => node.id === selected.target)?.type !== 'end' ||
    graph.edges?.filter((edge) => edge.target === selected.target).length !== 1
  )
    throw new WorkflowTreeVersionError(
      `连线「${selectedEdgeId}」必须指向唯一入边的结束节点。`,
    );
  const selectedTarget = selected.target;

  // 新真实节点与新边使用同一身份空间，原被选边 ID 则保持不变。
  const usedIds = new Set([
    ...(graph.edges ?? []).map((edge) => edge.id),
    ...graph.nodes.map((node) => node.id),
  ]);
  function allocate(prefix: string): string {
    let index = 1;
    while (usedIds.has(`${prefix}_${index}`)) index++;
    const id = `${prefix}_${index}`;
    usedIds.add(id);
    return id;
  }
  const forkId = allocate('exclusiveGateway');
  const rejectedId = allocate('endRejected');
  const defaultEdgeId = allocate(`${forkId}_branch`);
  const rejectedEdgeId = allocate(`${forkId}_branch`);
  const rejectedEnd: WorkflowTreeNode = {
    id: rejectedId,
    name: '拒绝结束',
    type: 'end',
    outcome: 'Rejected',
  };
  const fork: WorkflowTreeNode = {
    id: forkId,
    name: '条件终局',
    type: 'exclusiveGateway',
    branches: [
      {
        id: `branch:${defaultEdgeId}`,
        name: '默认分支',
        type: 'condition',
        edgeId: defaultEdgeId,
        targetId: selectedTarget,
        default: true,
      },
      {
        id: `branch:${rejectedEdgeId}`,
        name: '条件分支',
        type: 'condition',
        edgeId: rejectedEdgeId,
        targetId: rejectedId,
        next: rejectedEnd,
      },
    ],
  };
  const defaultBranch = fork.branches?.[0];
  if (!defaultBranch)
    throw new WorkflowTreeVersionError('默认终局分支没有创建成功。');
  const attachedDefaultBranch: WorkflowTreeBranch = defaultBranch;

  // 原入边只改指 fork，原终局对象原位移入默认支，元数据不复制到新边。
  const definition = cloneDraft(version);
  let originalEnd: undefined | WorkflowTreeNode;
  function visit(current: WorkflowTreeNode): void {
    if (originalEnd) return;
    if (current.nextEdgeId === selectedEdgeId) {
      originalEnd = current.next;
      if (!originalEnd || originalEnd.id !== selectedTarget)
        throw new WorkflowTreeVersionError('原终局节点不在所选连线后方。');
      attachedDefaultBranch.next = originalEnd;
      current.nextTargetId = forkId;
      current.next = fork;
      return;
    }
    for (const branch of current.branches ?? []) {
      if (branch.edgeId === selectedEdgeId) {
        originalEnd = branch.next;
        if (!originalEnd || originalEnd.id !== selectedTarget)
          throw new WorkflowTreeVersionError('原终局节点不在所选连线后方。');
        attachedDefaultBranch.next = originalEnd;
        branch.targetId = forkId;
        branch.next = fork;
        return;
      }
      if (branch.next) visit(branch.next);
    }
    if (current.next) visit(current.next);
  }
  visit(definition.flowTree);
  if (!originalEnd)
    throw new WorkflowTreeVersionError(
      `选中的连线「${selectedEdgeId}」已不存在。`,
    );

  // 无 join 的两条终局分支必须都连通；未配置条件仍只准草稿保存。
  projectDraftV3ToV2(definition);
  return { definition, fork, originalEnd, rejectedEnd };
}

/** 删除普通审批任务，保留唯一入边身份和配置并接回原后继。 */
export function removeTreeUserTask(
  version: WorkflowTreeVersion,
  nodeId: string,
): WorkflowTreeVersion {
  // 先验证整个草稿和所选任务的单入单出事实，不猜测共享或断裂拓扑。
  const graph = projectDraftV3ToV2(version);
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  const incoming = graph.edges?.filter((edge) => edge.target === nodeId) ?? [];
  const outgoing = graph.edges?.filter((edge) => edge.source === nodeId) ?? [];
  if (
    node?.type !== 'userTask' ||
    incoming.length !== 1 ||
    outgoing.length !== 1
  )
    throw new WorkflowTreeVersionError(
      `节点「${nodeId}」不是可删除的单入单出审批任务。`,
    );
  const inEdge = incoming[0];
  const outEdge = outgoing[0];
  if (!inEdge || !outEdge)
    throw new WorkflowTreeVersionError(`节点「${nodeId}」连线不完整。`);
  const inEdgeId = inEdge.id;
  const outEdgeId = outEdge.id;
  const outTarget = outEdge.target;

  // 只改入边目标；原任务出边随节点移除，不把它的 metadata 混入入边。
  const definition = cloneDraft(version);
  let removed = false;
  function visit(current: WorkflowTreeNode): void {
    if (removed) return;
    if (current.nextEdgeId === inEdgeId) {
      const task = current.next;
      if (task?.id !== nodeId || task.nextEdgeId !== outEdgeId)
        throw new WorkflowTreeVersionError('审批任务与所选入边不一致。');
      current.nextTargetId = outTarget;
      if (task.next) current.next = task.next;
      else delete current.next;
      removed = true;
      return;
    }
    for (const branch of current.branches ?? []) {
      if (branch.edgeId === inEdgeId) {
        const task = branch.next;
        if (task?.id !== nodeId || task.nextEdgeId !== outEdgeId)
          throw new WorkflowTreeVersionError('审批任务与所选入边不一致。');
        branch.targetId = outTarget;
        if (task.next) branch.next = task.next;
        else delete branch.next;
        removed = true;
        return;
      }
      if (branch.next) visit(branch.next);
    }
    if (current.next) visit(current.next);
  }
  visit(definition.flowTree);
  if (!removed)
    throw new WorkflowTreeVersionError(`节点「${nodeId}」已不存在。`);

  projectDraftV3ToV2(definition);
  return definition;
}
