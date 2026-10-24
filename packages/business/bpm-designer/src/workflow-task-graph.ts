import type {
  WorkflowCondition,
  WorkflowNotification,
  WorkflowVariable,
} from './types';
import type {
  WorkflowStateBinding,
  WorkflowStateGraph,
  WorkflowStateValue,
} from './workflow-state-graph';

/** 第五版以任务驱动流程；业务状态只由显式自动任务修改。 */
export type WorkflowTaskNodeType =
  | 'end'
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'serviceTask'
  | 'start'
  | 'userTask';
export interface WorkflowTaskNode {
  actionForms?: Record<
    string,
    { editableFields?: string[]; requiredFields?: string[] }
  >;
  actions?: string[];
  allowSelfApproval?: boolean;
  candidateGroups?: string[];
  candidateUsers?: string[];
  copies?: {
    candidateGroups: string[];
    candidateUsers: string[];
    event: 'NodeCompleted' | 'NodeEntered';
  }[];
  deadlineMinutes?: number;
  editableFields?: string[];
  id: string;
  joinId?: string;
  multiApprovalMode?: 'ALL' | 'ANY' | 'NONE' | 'SEQUENTIAL';
  name: string;
  notifications?: WorkflowNotification[];
  operation?: 'updateBoundState';
  outcome?: 'Approved' | 'Rejected' | 'Terminated' | 'Withdrawn';
  readableFields?: string[];
  reminderMinutes?: number;
  requiredFields?: string[];
  returnTargets?: string[];
  startCondition?: WorkflowCondition;
  targetState?: WorkflowStateValue;
  type: WorkflowTaskNodeType;
  x?: number;
  y?: number;
}
export interface WorkflowTaskEdge {
  condition?: WorkflowCondition;
  default?: boolean;
  id: string;
  metadata?: Record<string, unknown>;
  name?: string;
  source: string;
  target: string;
}
export interface WorkflowTaskGraph {
  businessBinding: WorkflowStateBinding;
  edges: WorkflowTaskEdge[];
  metadata?: Record<string, unknown>;
  name: string;
  nodes: WorkflowTaskNode[];
  processKey: string;
  schemaVersion: 5;
  simulationPolicy?: WorkflowStateGraph['simulationPolicy'];
  variables?: Record<string, WorkflowVariable>;
}
export type WorkflowTaskStep =
  | 'condition'
  | 'parallel'
  | 'serviceTask'
  | 'userTask';

// JSON 协议快照兼容 Vue 代理，所有结构编辑返回独立草稿。
export function cloneTaskGraph(graph: WorkflowTaskGraph): WorkflowTaskGraph {
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(graph)) as WorkflowTaskGraph;
}
export function createTaskGraph(
  binding: WorkflowStateBinding,
  processKey = '',
  name = '',
): WorkflowTaskGraph {
  return cloneTaskGraph({
    schemaVersion: 5,
    processKey,
    name,
    businessBinding: binding,
    variables: {},
    simulationPolicy: { cases: [] },
    nodes: [
      { id: 'start', name: '开始', type: 'start', x: 60, y: 100 },
      {
        id: 'end',
        name: '结束',
        type: 'end',
        outcome: 'Approved',
        x: 380,
        y: 100,
      },
    ],
    edges: [{ id: 'flow_1', source: 'start', target: 'end', name: '开始办理' }],
  });
}
function nextId(graph: WorkflowTaskGraph, prefix: string) {
  const used = new Set([...graph.nodes, ...graph.edges].map((item) => item.id));
  let index = 1;
  while (used.has(`${prefix}_${index}`)) index++;
  return `${prefix}_${index}`;
}
function appendNode(
  graph: WorkflowTaskGraph,
  type: WorkflowTaskNodeType,
  name: string,
) {
  const node: WorkflowTaskNode = { id: nextId(graph, 'step'), type, name };
  if (type === 'userTask')
    Object.assign(node, {
      candidateUsers: [],
      candidateGroups: [],
      multiApprovalMode: 'NONE',
      actions: ['approve'],
      actionForms: {
        approve: { editableFields: [], requiredFields: [] },
      },
    });
  if (type === 'serviceTask')
    Object.assign(node, {
      operation: 'updateBoundState',
      targetState: graph.businessBinding.stateMapping[0]?.value,
    });
  graph.nodes.push(node);
  return node;
}
function appendEdge(
  graph: WorkflowTaskGraph,
  source: string,
  target: string,
  name = '',
) {
  const edge: WorkflowTaskEdge = {
    id: nextId(graph, 'flow'),
    source,
    target,
    name,
  };
  graph.edges.push(edge);
  return edge;
}

/** 根据真实拓扑重排新增结构；回路保留可编辑位置。 */
export function layoutTaskGraph<
  T extends {
    edges: { source: string; target: string }[];
    nodes: { id: string; type?: string; x?: number; y?: number }[];
  },
>(graph: T): T {
  const ranks = new Map<string, number>();
  const incoming = new Map(graph.nodes.map((node) => [node.id, 0]));
  graph.edges.forEach((edge) =>
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1),
  );
  const pending = graph.nodes
    .filter((node) => node.type === 'start' || incoming.get(node.id) === 0)
    .map((node) => node.id);
  const visited = new Set<string>();
  while (pending.length > 0) {
    const id = pending.shift();
    if (!id) continue;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const edge of graph.edges.filter((item) => item.source === id)) {
      if (!visited.has(edge.target))
        ranks.set(
          edge.target,
          Math.max(ranks.get(edge.target) ?? 0, (ranks.get(id) ?? 0) + 1),
        );
      incoming.set(edge.target, (incoming.get(edge.target) ?? 1) - 1);
      if (incoming.get(edge.target) === 0) pending.push(edge.target);
    }
  }
  const rows = new Map<number, number>();
  graph.nodes.forEach((node) => {
    const rank = ranks.get(node.id) ?? 0;
    const row = rows.get(rank) ?? 0;
    Object.assign(node, { x: 60 + rank * 300, y: 100 + row * 150 });
    rows.set(rank, row + 1);
  });
  return graph;
}
export function taskParallelGroup(
  graph: WorkflowTaskGraph,
  selectedId: string,
): string[] {
  const selected = graph.nodes.find((node) => node.id === selectedId);
  const split = selected?.joinId
    ? selected
    : graph.nodes.find((node) => node.joinId === selectedId);
  if (!split?.joinId) return [];
  const result = new Set([split.id, split.joinId]);
  const pending = [split.id];
  while (pending.length > 0) {
    const id = pending.shift();
    for (const edge of graph.edges.filter((item) => item.source === id)) {
      if (result.has(edge.target)) continue;
      result.add(edge.target);
      pending.push(edge.target);
    }
  }
  return [...result];
}
export function isParallelBranchEdge(graph: WorkflowTaskGraph, edgeId: string) {
  const edge = graph.edges.find((item) => item.id === edgeId);
  return (
    !!edge &&
    graph.nodes.some(
      (split) =>
        split.joinId &&
        taskParallelGroup(graph, split.id).includes(edge.source) &&
        edge.source !== split.joinId,
    )
  );
}

/** 插入保留原路线条件和默认属性；模板自动配好出口和汇合。 */
export function insertTaskStep(
  original: WorkflowTaskGraph,
  edgeId: string,
  kind: WorkflowTaskStep,
): WorkflowTaskGraph {
  const graph = cloneTaskGraph(original);
  const route = graph.edges.find((edge) => edge.id === edgeId);
  if (!route) throw new Error('请选择要插入步骤的流转路线。');
  if (kind === 'serviceTask' && isParallelBranchEdge(graph, edgeId))
    throw new Error(
      '并行分支内不能同时修改同一业务状态，请在汇合后添加状态更新。',
    );
  const target = route.target;
  if (kind === 'userTask' || kind === 'serviceTask') {
    const node = appendNode(
      graph,
      kind,
      kind === 'userTask' ? '人工办理' : '更新业务状态',
    );
    route.target = node.id;
    appendEdge(graph, node.id, target, '继续');
  } else {
    const parallel = kind === 'parallel';
    const split = appendNode(
      graph,
      parallel ? 'parallelGateway' : 'exclusiveGateway',
      parallel ? '同时办理' : '按条件分路',
    );
    route.target = split.id;
    const join = appendNode(
      graph,
      parallel ? 'parallelGateway' : 'exclusiveGateway',
      parallel ? '全部完成后继续' : '分支后继续',
    );
    if (parallel) split.joinId = join.id;
    for (let index = 0; index < 2; index++) {
      const task = appendNode(graph, 'userTask', `办理任务${index + 1}`);
      const branch = appendEdge(
        graph,
        split.id,
        task.id,
        parallel ? `分支${index + 1}` : (['设置条件', '其他情况'][index] ?? ''),
      );
      if (!parallel && index === 1) branch.default = true;
      appendEdge(graph, task.id, join.id, '办理完成');
    }
    appendEdge(graph, join.id, target, '继续');
  }
  return layoutTaskGraph(graph);
}
/** 与服务端退回校验一致：必经前置人工任务，且不跨并行或多人审批范围。 */
export function eligibleTaskReturnTargets(
  graph: WorkflowTaskGraph,
  nodeId: string,
): WorkflowTaskNode[] {
  const current = graph.nodes.find(
    (node) => node.id === nodeId && node.type === 'userTask',
  );
  const start = graph.nodes.find((node) => node.type === 'start');
  if (!current || !start || (current.multiApprovalMode ?? 'NONE') !== 'NONE')
    return [];
  function collect(
    id: string,
    stop?: string,
    seen = new Set<string>(),
  ): Set<string> {
    if (id === stop || seen.has(id)) return seen;
    seen.add(id);
    graph.edges
      .filter((edge) => edge.source === id)
      .forEach((edge) => collect(edge.target, stop, seen));
    return seen;
  }
  return graph.nodes.filter((target) => {
    if (
      target.type !== 'userTask' ||
      target.id === nodeId ||
      (target.multiApprovalMode ?? 'NONE') !== 'NONE'
    )
      return false;
    if (
      !collect(target.id).has(nodeId) ||
      collect(start.id, target.id).has(nodeId)
    )
      return false;
    return ![...collect(target.id, nodeId)].some(
      (id) =>
        graph.nodes.find((node) => node.id === id)?.type === 'parallelGateway',
    );
  });
}
/** 审批结果分路一键生成，拒绝把驳回误接成通过结果。 */
export function addTaskResultBranches(
  original: WorkflowTaskGraph,
  nodeId: string,
): WorkflowTaskGraph {
  const graph = cloneTaskGraph(original);
  const task = graph.nodes.find(
    (node) => node.id === nodeId && node.type === 'userTask',
  );
  const routes = graph.edges.filter((edge) => edge.source === nodeId);
  const route = routes[0];
  if (!task || routes.length !== 1 || !route)
    throw new Error('请在只有一条后续路线的人工任务上添加结果分路。');
  if (isParallelBranchEdge(graph, route.id))
    throw new Error(
      '并行分支请先汇总审批结果，再在汇合后统一分路，避免提前结束其它分支。',
    );
  const target = route.target;
  const split = appendNode(graph, 'exclusiveGateway', `${task.name}结果`);
  const rejected = appendNode(graph, 'end', '审批驳回');
  rejected.outcome = 'Rejected';
  route.target = split.id;
  const rejectRoute = appendEdge(graph, split.id, rejected.id, '驳回');
  rejectRoute.condition = {
    eq: [{ variable: `taskResult_${nodeId}` }, { literal: 'Rejected' }],
  };
  appendEdge(graph, split.id, target, '通过').default = true;
  task.actions = [...new Set(['approve', 'reject', ...(task.actions ?? [])])];
  return layoutTaskGraph(graph);
}
export function addParallelBranch(
  original: WorkflowTaskGraph,
  splitId: string,
): WorkflowTaskGraph {
  const graph = cloneTaskGraph(original);
  const split = graph.nodes.find(
    (node) => node.id === splitId && node.type === 'parallelGateway',
  );
  if (!split?.joinId || !graph.nodes.some((node) => node.id === split.joinId))
    throw new Error('请选择有配对汇合点的同时办理节点。');
  const task = appendNode(
    graph,
    'userTask',
    `办理任务${graph.edges.filter((edge) => edge.source === splitId).length + 1}`,
  );
  appendEdge(graph, split.id, task.id, '新增分支');
  appendEdge(graph, task.id, split.joinId, '办理完成');
  return layoutTaskGraph(graph);
}
export function connectTaskNodes(
  original: WorkflowTaskGraph,
  source: string,
  target: string,
): WorkflowTaskGraph {
  const graph = cloneTaskGraph(original);
  const from = graph.nodes.find((node) => node.id === source);
  const to = graph.nodes.find((node) => node.id === target);
  if (
    !from ||
    !to ||
    source === target ||
    from.type === 'end' ||
    to.type === 'start'
  )
    throw new Error('该连接不合法：开始只能连出，结束只能连入，不能连接自身。');
  if (
    graph.edges.some((edge) => edge.source === source && edge.target === target)
  )
    throw new Error('这两个步骤已有流转路线，请点击原路线配置。');
  appendEdge(graph, source, target, '新流转路线');
  return graph;
}
export function removeTaskNode(
  original: WorkflowTaskGraph,
  id: string,
): WorkflowTaskGraph {
  const graph = cloneTaskGraph(original);
  const node = graph.nodes.find((item) => item.id === id);
  if (!node) return graph;
  if (
    ['end', 'exclusiveGateway', 'parallelGateway', 'start'].includes(node.type)
  )
    throw new Error('开始、结束及分支汇合是结构节点，请调整连接或整组结构。');
  const incoming = graph.edges.filter((edge) => edge.target === id);
  const outgoing = graph.edges.filter((edge) => edge.source === id);
  if (outgoing.length !== 1)
    throw new Error('请先调整该任务的多条出口，再删除任务。');
  const next = outgoing[0];
  if (!next) throw new Error('步骤缺少后续路线。');
  const target = next.target;
  incoming.forEach((edge) => {
    edge.target = target;
  });
  graph.edges = graph.edges.filter((edge) => edge.source !== id);
  graph.nodes = graph.nodes.filter((item) => item.id !== id);
  return graph;
}

// 中文摘要直接出现在图上，不要求用户打开侧栏才知道办理规则。
export function taskNodeSummary(
  node: WorkflowTaskNode,
  graph: WorkflowTaskGraph,
) {
  if (node.type === 'serviceTask')
    return `${graph.businessBinding.stateField} → ${graph.businessBinding.stateMapping.find((item) => typeof item.value === typeof node.targetState && item.value === node.targetState)?.label ?? '请选择目标状态'}`;
  if (node.type === 'userTask') {
    const mode = {
      NONE: '单人办理',
      ALL: '全部会签',
      ANY: '任一通过',
      SEQUENTIAL: '依次审批',
    }[node.multiApprovalMode ?? 'NONE'];
    const targets = node.actions?.includes('return')
      ? node.returnTargets?.map(
          (id) => graph.nodes.find((item) => item.id === id)?.name ?? id,
        )
      : [];
    return `${mode} · 不修改业务状态${targets?.length ? ` · 可退回：${targets.join('、')}` : ''}`;
  }
  if (node.type === 'parallelGateway')
    return node.joinId ? '各路同时开始' : '等待全部分支完成';
  if (node.type === 'exclusiveGateway')
    return graph.edges.filter((edge) => edge.source === node.id).length > 1
      ? '按条件选一路'
      : '到达即继续';
  if (node.type === 'end') return '流程结束';
  return node.startCondition ? '符合启动条件后发起' : '发起流程';
}
function referencesVariable(value: unknown, key: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value))
    return value.some((item) => referencesVariable(item, key));
  return Object.entries(value).some(
    ([name, child]) =>
      (name === 'variable' && child === key) || referencesVariable(child, key),
  );
}
export function validateTaskGraph(
  graph: WorkflowTaskGraph,
  draft = false,
): string[] {
  const errors: string[] = [];
  if (graph.schemaVersion !== 5) errors.push('只接受第五版任务流程。');
  if (
    !graph.businessBinding?.businessEntityKey ||
    !graph.businessBinding.stateField ||
    graph.businessBinding.stateMapping.length === 0
  )
    errors.push('请先保存业务对象、状态字段和状态映射。');
  // 草稿也必须满足传输契约，不能保存已关闭操作的残留表单。
  for (const node of graph.nodes) {
    for (const action of Object.keys(node.actionForms ?? {})) {
      if (!node.actions?.includes(action))
        errors.push(`${node.name}：操作表单引用未启用操作 ${action}。`);
    }
  }
  if (draft) return errors;
  if (graph.nodes.filter((node) => node.type === 'start').length !== 1)
    errors.push('流程必须有且只有一个开始节点。');
  if (!graph.nodes.some((node) => node.type === 'end'))
    errors.push('流程必须有结束节点。');
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (ids.size !== graph.nodes.length) errors.push('步骤编号不能重复。');
  for (const node of graph.nodes) {
    const incoming = graph.edges.filter((edge) => edge.target === node.id);
    const outgoing = graph.edges.filter((edge) => edge.source === node.id);
    if (node.type !== 'start' && incoming.length === 0)
      errors.push(`${node.name}：尚未连接前一步。`);
    if (node.type !== 'end' && outgoing.length === 0)
      errors.push(`${node.name}：尚未连接下一步。`);
    if (node.type === 'start' && incoming.length > 0)
      errors.push('开始节点不能有进入路线。');
    if (node.type === 'end' && outgoing.length > 0)
      errors.push('结束节点不能有离开路线。');
    if (
      node.type === 'userTask' &&
      !node.candidateUsers?.length &&
      !node.candidateGroups?.length
    )
      errors.push(`${node.name}：请选择办理人或角色。`);
    if (
      node.type === 'serviceTask' &&
      !graph.businessBinding.stateMapping.some(
        (state) =>
          typeof state.value === typeof node.targetState &&
          state.value === node.targetState,
      )
    )
      errors.push(`${node.name}：请选择已定义的目标状态。`);
    if (node.type === 'userTask') {
      if (
        node.actions?.includes('reject') &&
        !graph.edges.some((edge) =>
          referencesVariable(edge.condition, `taskResult_${node.id}`),
        )
      )
        errors.push(`${node.name}：已开启驳回，请添加按审批结果分路。`);
      const targets = node.returnTargets ?? [];
      const allowsReturn = node.actions?.includes('return') === true;
      if (allowsReturn !== targets.length > 0)
        errors.push(
          `${node.name}：退回操作必须配置目标，关闭退回时应清除目标。`,
        );
      const eligible = eligibleTaskReturnTargets(graph, node.id);
      if (targets.some((id) => !eligible.some((target) => target.id === id)))
        errors.push(
          `${node.name}：退回只能选择必经前置单人任务，不能跨并行或多人审批范围。`,
        );
      for (const [action, form] of Object.entries(node.actionForms ?? {})) {
        if (
          form.editableFields?.some(
            (field) => !node.editableFields?.includes(field),
          )
        )
          errors.push(`${node.name}：${action}表单超出任务可填写字段。`);
        if (
          form.requiredFields?.some(
            (field) =>
              !(form.editableFields ?? node.editableFields)?.includes(field),
          )
        )
          errors.push(`${node.name}：${action}必填项必须是此操作可填写字段。`);
      }
    }
    if (
      node.type === 'serviceTask' &&
      outgoing.some((edge) => isParallelBranchEdge(graph, edge.id))
    )
      errors.push(`${node.name}：业务状态更新应放在并行汇合之后。`);
    if (node.type === 'exclusiveGateway' && outgoing.length > 1) {
      if (outgoing.filter((edge) => edge.default).length !== 1)
        errors.push(`${node.name}：请指定一条其他情况的默认路线。`);
      outgoing
        .filter((edge) => !edge.default && !edge.condition)
        .forEach((edge) =>
          errors.push(
            `${node.name} → ${edge.name || edge.target}：请设置条件。`,
          ),
        );
    }
    if (
      node.type === 'parallelGateway' &&
      node.joinId &&
      !graph.nodes.some(
        (join) => join.id === node.joinId && join.type === 'parallelGateway',
      )
    )
      errors.push(`${node.name}：缺少配对汇合点。`);
  }
  if (
    graph.edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target))
  )
    errors.push('存在连接到已删除步骤的路线。');
  const start = graph.nodes.find((node) => node.type === 'start');
  const reachable = new Set<string>();
  const pending = start ? [start.id] : [];
  while (pending.length > 0) {
    const id = pending.shift();
    if (!id) continue;
    if (reachable.has(id)) continue;
    reachable.add(id);
    graph.edges
      .filter((edge) => edge.source === id)
      .forEach((edge) => pending.push(edge.target));
  }
  graph.nodes
    .filter((node) => !reachable.has(node.id))
    .forEach((node) => errors.push(`${node.name}：无法从开始到达。`));
  return errors;
}
