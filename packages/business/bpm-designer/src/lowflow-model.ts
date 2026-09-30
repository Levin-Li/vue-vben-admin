import type {
  WorkflowCondition,
  WorkflowDesignerDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
} from './types';

/** 基于上游 FlowNode.next/branches 的画布节点；只承载图形拓扑和展示信息。 */
export interface LowflowCanvasNode {
  branches?: LowflowCanvasNode[];
  branchKind?: 'exclusive' | 'parallel';
  condition?: WorkflowCondition;
  default?: boolean;
  edgeId?: string;
  id: string;
  incomingEdgeIds?: string[];
  joinId?: string;
  name: string;
  next?: LowflowCanvasNode;
  nextEdgeId?: string;
  nextTargetId?: string;
  status?: string;
  targetId?: string;
  type: 'condition' | WorkflowNodeType;
  x?: number;
  y?: number;
}

/** 运行期只接收服务端授权的图投影，不依赖设计定义或执行配置。 */
export interface LowflowRuntimeNode {
  id: string;
  name: string;
  status?: string;
  type?: string;
}

export interface LowflowRuntimeEdge {
  id: string;
  source: string;
  target: string;
}

export interface LowflowCanvasOptions {
  /** 仅在草稿中允许单入单出网关或未配齐排他出口；不代表可模拟/发布。 */
  allowDraft?: boolean;
}

/** 无法无损转换的图必须由调用方显式处理，不能展示一个缺边的流程。 */
export class LowflowModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LowflowModelError';
  }
}

function fail(message: string): never {
  throw new LowflowModelError(message);
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) fail(`流程图缺少${label}。`);
  return value;
}

function copyJson<T>(value: T): T {
  // 定义是 JSON 值；Vue props 中的响应式代理不能直接 structuredClone。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value)) as T;
}

function intersect<T>(sets: ReadonlySet<T>[]): Set<T> {
  const first = sets[0];
  if (!first) return new Set();
  const rest = sets.slice(1);
  return new Set(
    [...first].filter((item) => rest.every((set) => set.has(item))),
  );
}

/**
 * 将当前固定版本的平面图转换成上游树形画布模型。
 * 并行网关要求 fork.joinId 指向实际汇聚网关；不复制汇聚节点。
 */
export function toLowflowCanvasTree(
  definition: WorkflowDesignerDefinition,
  options: LowflowCanvasOptions = {},
): LowflowCanvasNode {
  return buildLowflowCanvasTree(
    definition,
    'design',
    new Map(),
    options.allowDraft,
  );
}

/**
 * 把可编辑画布树还原到原定义；图形字段按稳定 ID 回写，其余业务配置保持原样。
 * 缺节点、丢边或篡改汇聚引用时拒绝，绝不以节点数组顺序补造连线。
 */
export function fromLowflowCanvasTree(
  tree: LowflowCanvasNode,
  source: WorkflowDesignerDefinition,
): WorkflowDesignerDefinition {
  const graphNodes = new Map<string, LowflowCanvasNode>();
  const graphEdges = new Map<string, WorkflowEdge>();
  const visited = new Set<LowflowCanvasNode>();

  function appendEdge(edge: WorkflowEdge): void {
    if (!edge.id || graphEdges.has(edge.id))
      fail(`画布连线标识重复：${edge.id}`);
    graphEdges.set(edge.id, edge);
  }

  function visit(node: LowflowCanvasNode, stop?: string): void {
    // 条件分支是连线的画布包装，不允许被伪装为真正 BPMN 节点。
    if (
      visited.has(node) ||
      node.type === 'condition' ||
      graphNodes.has(node.id)
    )
      fail(`画布节点重复、循环或类型无效：${node.id}`);
    visited.add(node);
    graphNodes.set(node.id, node);

    if (node.branches) {
      if (
        !['exclusiveGateway', 'parallelGateway'].includes(node.type) ||
        node.branches.length < 2 ||
        node.nextEdgeId
      )
        fail(`画布网关分支无效：${node.id}`);
      for (const branch of node.branches) {
        if (
          branch.type !== 'condition' ||
          !branch.edgeId ||
          !branch.targetId ||
          branch.branches ||
          branch.nextEdgeId ||
          (branch.next && branch.next.id !== branch.targetId) ||
          (!branch.next && branch.targetId !== node.joinId)
        )
          fail(`画布条件分支缺少原始连线或目标：${branch.id}`);
        appendEdge({
          id: branch.edgeId,
          source: node.id,
          target: branch.targetId,
          ...(branch.condition
            ? { condition: copyJson(branch.condition) }
            : {}),
          ...(branch.default ? { default: true } : {}),
        });
        if (branch.next) visit(branch.next, node.joinId);
      }
      if (node.next) {
        if (node.joinId !== node.next.id)
          fail(`画布网关汇聚目标不一致：${node.id}`);
        visit(node.next, stop);
      }
      return;
    }

    // 串行边的 targetId 是唯一执行目标；分支末端可以只记录指向汇聚点的边。
    if (node.nextEdgeId) {
      if (
        !node.nextTargetId ||
        (node.next && node.next.id !== node.nextTargetId)
      )
        fail(`画布串行连线目标无效：${node.id}`);
      if (!node.next && node.nextTargetId !== stop)
        fail(`画布串行连线缺少目标节点：${node.nextEdgeId}`);
      appendEdge({
        id: node.nextEdgeId,
        source: node.id,
        target: node.nextTargetId,
      });
      if (node.next) visit(node.next, stop);
    } else if (node.next || node.nextTargetId) {
      fail(`画布节点缺少后续连线身份：${node.id}`);
    }
  }

  visit(tree);

  // 必须与来源固定版本逐项对应；保留节点业务规则、审批人、表单与动作配置。
  const originalNodes = new Map(source.nodes.map((node) => [node.id, node]));
  const originalEdges = new Map(
    (source.edges ?? []).map((edge) => [edge.id, edge]),
  );
  if (
    graphNodes.size !== originalNodes.size ||
    graphEdges.size !== originalEdges.size ||
    [...graphNodes.keys()].some((id) => !originalNodes.has(id)) ||
    [...graphEdges.keys()].some((id) => !originalEdges.has(id))
  )
    fail('画布树与固定版本节点或连线身份不一致。');
  for (const node of graphNodes.values()) {
    const actualIncoming = [...graphEdges.values()]
      .filter((edge) => edge.target === node.id)
      .map((edge) => edge.id)
      .toSorted();
    if (
      actualIncoming.join('|') !==
      [...(node.incomingEdgeIds ?? [])].toSorted().join('|')
    )
      fail(`画布节点「${node.id}」入边身份不一致。`);
  }

  const result = copyJson(source);
  result.nodes = result.nodes.map((node) => {
    const canvas = required(graphNodes.get(node.id), `节点「${node.id}」`);
    if (canvas.type !== node.type) fail(`画布节点类型发生变化：${node.id}`);
    const updated: WorkflowNode = {
      ...node,
      name: canvas.name,
      x: canvas.x,
      y: canvas.y,
    };
    if (node.type === 'parallelGateway') updated.joinId = canvas.joinId;
    return updated;
  });
  result.edges = (result.edges ?? []).map((edge) => {
    const canvas = required(graphEdges.get(edge.id), `连线「${edge.id}」`);
    const updated: WorkflowEdge = {
      ...edge,
      source: canvas.source,
      target: canvas.target,
    };
    if (canvas.condition) updated.condition = copyJson(canvas.condition);
    else delete updated.condition;
    if (canvas.default) updated.default = true;
    else if (edge.default !== false) delete updated.default;
    return updated;
  });
  return result;
}

/** 从授权运行图生成相同画布树；状态只沿用服务端投影，不从拓扑推测。 */
export function toLowflowRuntimeTree(
  runtimeNodes: readonly LowflowRuntimeNode[],
  runtimeEdges: readonly LowflowRuntimeEdge[],
): LowflowCanvasNode {
  // 运行图未携带条件、默认分支和 joinId；仅用服务端提供的节点与连线建图。
  const statuses = new Map<string, string>();
  const nodes: WorkflowNode[] = runtimeNodes.map((node) => {
    if (!isWorkflowNodeType(node.type))
      fail(`运行图节点「${node.id}」缺少受支持的类型。`);
    if (node.status !== undefined) statuses.set(node.id, node.status);
    return { id: node.id, name: node.name, type: node.type };
  });
  const definition: WorkflowDesignerDefinition = {
    name: '',
    processKey: '',
    nodes,
    edges: runtimeEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
  return buildLowflowCanvasTree(definition, 'runtime', statuses);
}

function isWorkflowNodeType(
  type: string | undefined,
): type is WorkflowNodeType {
  return (
    type === 'start' ||
    type === 'userTask' ||
    type === 'exclusiveGateway' ||
    type === 'parallelGateway' ||
    type === 'end'
  );
}

function buildLowflowCanvasTree(
  definition: WorkflowDesignerDefinition,
  mode: 'design' | 'runtime',
  statuses: ReadonlyMap<string, string> = new Map(),
  allowDraft = false,
): LowflowCanvasNode {
  const nodes = new Map<string, WorkflowNode>();
  const incoming = new Map<string, WorkflowEdge[]>();
  const outgoing = new Map<string, WorkflowEdge[]>();
  const edgeIds = new Set<string>();

  // 先校验节点和连线身份，避免重复键在 Map 中被覆盖后伪装成可转换图。
  for (const node of definition.nodes) {
    if (!node.id || nodes.has(node.id)) fail(`节点标识重复或为空：${node.id}`);
    if (
      ![
        'end',
        'exclusiveGateway',
        'parallelGateway',
        'start',
        'userTask',
      ].includes(node.type)
    )
      fail(`不支持节点类型：${node.type}`);
    nodes.set(node.id, node);
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }
  const starts = definition.nodes.filter((node) => node.type === 'start');
  if (starts.length !== 1) fail('流程必须恰好包含一个开始节点。');
  if (!definition.nodes.some((node) => node.type === 'end'))
    fail('流程必须包含结束节点。');

  for (const edge of definition.edges ?? []) {
    if (!edge.id || edgeIds.has(edge.id))
      fail(`连线标识重复或为空：${edge.id}`);
    if (!nodes.has(edge.source) || !nodes.has(edge.target))
      fail(`连线「${edge.id}」引用了不存在的节点。`);
    if (edge.source === edge.target) fail(`连线「${edge.id}」形成自环。`);
    edgeIds.add(edge.id);
    required(outgoing.get(edge.source), `节点「${edge.source}」的出边`).push(
      edge,
    );
    required(incoming.get(edge.target), `节点「${edge.target}」的入边`).push(
      edge,
    );
  }

  // 对全部节点检测环与孤立子图，不能只检查从开始节点可见的部分。
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: string[] = [];
  function visit(id: string): void {
    if (visiting.has(id)) fail(`流程包含环，涉及节点「${id}」。`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const edge of required(outgoing.get(id), `节点「${id}」的出边`))
      visit(edge.target);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }
  for (const node of definition.nodes) visit(node.id);
  const reached = new Set<string>();
  function reach(id: string): void {
    if (reached.has(id)) return;
    reached.add(id);
    for (const edge of required(outgoing.get(id), `节点「${id}」的出边`))
      reach(edge.target);
  }
  const start = required(starts[0], '开始节点');
  reach(start.id);
  if (reached.size !== nodes.size)
    fail(
      `存在无法从开始节点到达的节点：${[...nodes.keys()].filter((id) => !reached.has(id)).join('、')}`,
    );

  // 两种视图共用后端图的结构约束；运行投影不包含保密的分支条件。
  for (const node of definition.nodes) {
    const parents = required(incoming.get(node.id), `节点「${node.id}」的入边`);
    const edges = required(outgoing.get(node.id), `节点「${node.id}」的出边`);
    if (node.type === 'start' && (parents.length > 0 || edges.length !== 1))
      fail(`开始节点「${node.id}」必须无入边且恰好有一条出边。`);
    if (node.type === 'end' && (parents.length === 0 || edges.length > 0))
      fail(`结束节点「${node.id}」必须有入边且没有出边。`);
    if (
      node.type === 'userTask' &&
      (parents.length !== 1 || edges.length !== 1)
    )
      fail(`用户任务「${node.id}」必须恰好有一条入边和出边。`);
    if (
      (node.type === 'exclusiveGateway' || node.type === 'parallelGateway') &&
      !(
        (parents.length === 1 && edges.length >= 2) ||
        (parents.length >= 2 && edges.length === 1) ||
        (mode === 'design' &&
          allowDraft &&
          parents.length === 1 &&
          edges.length === 1)
      )
    )
      fail(`网关「${node.id}」必须单独用于分叉或汇聚。`);
    if (node.joinId && (node.type !== 'parallelGateway' || edges.length < 2))
      fail(`只有并行分叉允许指定汇聚节点：${node.id}`);
    if (
      mode === 'design' &&
      node.type === 'exclusiveGateway' &&
      edges.length >= 2
    ) {
      const defaults = edges.filter((edge) => edge.default).length;
      if (defaults > 1 || (!allowDraft && defaults !== 1))
        fail(`排他网关「${node.id}」默认连线数量无效。`);
      if (edges.some((edge) => edge.default && edge.condition))
        fail(`排他网关「${node.id}」的默认连线不能有条件。`);
      if (!allowDraft && edges.some((edge) => !edge.default && !edge.condition))
        fail(`排他网关「${node.id}」的非默认连线必须有条件。`);
    } else if (edges.some((edge) => edge.default || edge.condition)) {
      fail(`仅排他分叉允许条件或默认连线：${node.id}`);
    }
  }

  // 计算每个节点的必经后继，用于确认排他分支是否有真正的公共汇聚点。
  const postdominators = new Map<string, Set<string>>();
  for (const id of order) {
    const edges = required(outgoing.get(id), `节点「${id}」的出边`);
    const common = intersect(
      edges.map((edge) =>
        required(
          postdominators.get(edge.target),
          `节点「${edge.target}」的后继`,
        ),
      ),
    );
    postdominators.set(id, new Set([id, ...common]));
  }

  // 运行投影没有 joinId，按共同必经的并行汇聚推导唯一配对；设计图仍验证显式配对。
  const pairedJoins = new Set<string>();
  const inferredJoins = new Map<string, string>();
  for (const node of definition.nodes) {
    const branches = required(
      outgoing.get(node.id),
      `节点「${node.id}」的出边`,
    );
    if (node.type !== 'parallelGateway' || branches.length < 2) continue;
    const common = intersect(
      branches.map((edge) =>
        required(
          postdominators.get(edge.target),
          `节点「${edge.target}」的后继`,
        ),
      ),
    );
    const candidates = [...common].filter((id) => {
      const join = nodes.get(id);
      return (
        join?.type === 'parallelGateway' &&
        required(incoming.get(id), `汇聚「${id}」的入边`).length ===
          branches.length &&
        required(outgoing.get(id), `汇聚「${id}」的出边`).length === 1
      );
    });
    const joinId =
      mode === 'design'
        ? node.joinId
        : candidates.find((candidate) =>
            candidates.every(
              (other) =>
                candidate === other ||
                postdominators.get(candidate)?.has(other),
            ),
          );
    if (!joinId || !candidates.includes(joinId) || pairedJoins.has(joinId))
      fail(`并行分叉「${node.id}」必须关联唯一有效的汇聚节点。`);
    pairedJoins.add(joinId);
    inferredJoins.set(node.id, joinId);
  }
  for (const node of definition.nodes) {
    if (
      node.type === 'parallelGateway' &&
      required(incoming.get(node.id), `节点「${node.id}」的入边`).length >= 2 &&
      !pairedJoins.has(node.id)
    )
      fail(`并行汇聚「${node.id}」缺少配对分叉。`);
  }

  const rendered = new Set<string>();
  const renderedEdges = new Set<string>();
  function chooseJoin(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    outerStop?: string,
  ): string | undefined {
    const common = intersect(
      edges.map((edge) =>
        required(
          postdominators.get(edge.target),
          `节点「${edge.target}」的后继`,
        ),
      ),
    );
    const configuredJoin = inferredJoins.get(node.id);
    if (configuredJoin) {
      if (!common.has(configuredJoin))
        fail(
          `网关「${node.id}」的汇聚节点「${configuredJoin}」并非所有分支必经。`,
        );
      if (
        node.type === 'parallelGateway' &&
        nodes.get(configuredJoin)?.type !== 'parallelGateway'
      )
        fail(`并行网关「${node.id}」必须汇聚到并行网关。`);
      return configuredJoin;
    }
    if (node.type === 'parallelGateway')
      fail(`并行网关「${node.id}」缺少明确的 joinId。`);
    if (outerStop && common.has(outerStop)) common.delete(outerStop);
    const candidates = [...common];
    // 离分叉最近的公共必经节点先展示，后续公共节点仍由 next 串联。
    return (
      candidates.find((candidate) =>
        candidates.every(
          (other) =>
            candidate === other || postdominators.get(candidate)?.has(other),
        ),
      ) ?? outerStop
    );
  }

  function build(id: string, stop?: string): LowflowCanvasNode | undefined {
    if (id === stop) return undefined;
    if (rendered.has(id))
      fail(`节点「${id}」由多条路径共享，无法放入单棵流程树。`);
    rendered.add(id);
    const node = required(nodes.get(id), `节点「${id}」`);
    const edges = required(outgoing.get(id), `节点「${id}」的出边`);
    const parents = required(incoming.get(id), `节点「${id}」的入边`);
    const status = statuses.get(id);

    // 保留真实节点 ID、原始坐标和每条入边 ID；审批配置不进入展示模型。
    const canvas: LowflowCanvasNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      incomingEdgeIds: parents.map((edge) => edge.id),
      ...(status === undefined ? {} : { status }),
      ...(node.x === undefined ? {} : { x: node.x }),
      ...(node.y === undefined ? {} : { y: node.y }),
    };
    if (node.type === 'start' && (parents.length > 0 || edges.length !== 1))
      fail('开始节点必须无入边且恰好有一条出边。');
    if (node.type === 'end') {
      if (edges.length > 0) fail(`结束节点「${id}」不能有出边。`);
      return canvas;
    }
    if (edges.length === 0) fail(`节点「${id}」缺少后续连线。`);

    // 串行节点沿 next 延伸；遇到所属分支汇聚点时仅记录边界连线。
    if (edges.length === 1) {
      const edge = required(edges[0], `节点「${id}」的出边`);
      if (edge.condition || edge.default)
        fail(`非分叉连线「${edge.id}」不能包含分支条件。`);
      renderedEdges.add(edge.id);
      canvas.nextEdgeId = edge.id;
      canvas.nextTargetId = edge.target;
      const next = build(edge.target, stop);
      if (next) canvas.next = next;
      return canvas;
    }

    if (node.type !== 'exclusiveGateway' && node.type !== 'parallelGateway')
      fail(`节点「${id}」存在多条出边，但不是分叉网关。`);
    if (
      node.type === 'parallelGateway' &&
      edges.some((edge) => edge.condition || edge.default)
    )
      fail(`并行网关「${id}」不能使用排他分支条件。`);
    if (edges.filter((edge) => edge.default).length > 1)
      fail(`排他网关「${id}」有多条默认连线。`);
    const join = chooseJoin(node, edges, stop);
    if (join) canvas.joinId = join;
    canvas.branches = edges.map((edge) => {
      renderedEdges.add(edge.id);
      const branchId = `branch:${edge.id}`;
      if (nodes.has(branchId)) fail(`分支标识「${branchId}」与原始节点冲突。`);
      const next = build(edge.target, join);
      const condition = edge.condition ? copyJson(edge.condition) : undefined;
      return {
        id: branchId,
        name: edge.default ? '默认分支' : `分支 ${edge.id}`,
        type: 'condition',
        branchKind: node.type === 'parallelGateway' ? 'parallel' : 'exclusive',
        edgeId: edge.id,
        targetId: edge.target,
        ...(condition ? { condition } : {}),
        ...(edge.default ? { default: true } : {}),
        ...(next ? { next } : {}),
      };
    });
    if (join && join !== stop) {
      const next = build(join, stop);
      if (next) canvas.next = next;
    }
    return canvas;
  }

  const tree = required(build(start.id), '画布根节点');
  if (rendered.size !== nodes.size)
    fail(
      `存在未映射节点：${[...nodes.keys()].filter((id) => !rendered.has(id)).join('、')}`,
    );
  if (renderedEdges.size !== edgeIds.size)
    fail(
      `存在未映射连线：${[...edgeIds].filter((id) => !renderedEdges.has(id)).join('、')}`,
    );
  return tree;
}
