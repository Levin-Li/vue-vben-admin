import type { LowflowCanvasNode } from './lowflow-model';
import type {
  WorkflowCondition,
  WorkflowDesignerDefinition,
  WorkflowEdge,
  WorkflowNode,
} from './types';

import { toLowflowCanvasTree } from './lowflow-model';

type JsonObject = Record<string, unknown>;
type VersionedEdge = WorkflowEdge & { metadata?: JsonObject };
type VersionedNode = WorkflowNode & { metadata?: JsonObject };

/** v3 的包装节点只代表网关出口边，不是可执行节点。 */
export interface WorkflowTreeBranch {
  condition?: WorkflowCondition;
  default?: boolean;
  edgeId: string;
  id: string;
  metadata?: JsonObject;
  name: string;
  next?: WorkflowTreeNode;
  targetId: string;
  type: 'condition';
}

/** v3 的唯一可编辑图形事实；运行状态和入边列表不属于版本事实。 */
export interface WorkflowTreeNode extends VersionedNode {
  branches?: WorkflowTreeBranch[];
  next?: WorkflowTreeNode;
  nextEdgeId?: string;
  nextEdgeMetadata?: JsonObject;
  nextTargetId?: string;
}

export type WorkflowTreeVersion = Omit<
  WorkflowDesignerDefinition,
  'businessBinding' | 'edges' | 'nodes' | 'schemaVersion'
> & {
  businessBinding?: NonNullable<
    WorkflowDesignerDefinition['businessBinding']
  > & {
    contractDigest?: string;
  };
  edges?: never;
  flowTree: WorkflowTreeNode;
  metadata?: JsonObject;
  nodes?: never;
  schemaVersion: 3;
  simulationPolicy?: { cases?: JsonObject[] };
};

/** 本地拒绝不能无损投影的模型；服务端仍是保存和发布的最终裁决者。 */
export class WorkflowTreeVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowTreeVersionError';
  }
}

const ROOT_KEYS = [
  'schemaVersion',
  'processKey',
  'name',
  'purposeKey',
  'businessBinding',
  'variables',
  'startPolicy',
  'dependencies',
  'outcomeActions',
  'simulationPolicy',
  'metadata',
];
const NODE_KEYS = ['id', 'type', 'name', 'x', 'y', 'metadata'];
const TASK_KEYS = [
  'approverResolver',
  'candidateUsers',
  'candidateGroups',
  'actions',
  'multiApprovalMode',
  'allowSelfApproval',
  'actionCandidateUsers',
  'actionCandidateGroups',
  'returnTargets',
  'readableFields',
  'editableFields',
  'requiredFields',
  'formAction',
  'stepUpVerifyTypes',
  'deadlineMinutes',
  'reminderMinutes',
  'deadlineEscalationUsers',
  'emptyAssigneePolicy',
  'escalationCandidateUsers',
  'escalationCandidateGroups',
];
const TREE_KEYS = [
  'next',
  'nextEdgeId',
  'nextTargetId',
  'nextEdgeMetadata',
  'branches',
];
const BRANCH_KEYS = [
  'id',
  'name',
  'type',
  'edgeId',
  'targetId',
  'condition',
  'default',
  'metadata',
  'next',
];
const EDGE_KEYS = [
  'id',
  'source',
  'target',
  'condition',
  'default',
  'metadata',
];
const MAX_BYTES = 262_144;
const MAX_DEPTH = 128;
const MAX_NODES = 256;
const MAX_EDGES = 512;
const EXECUTION_ID = /^[A-Z_]\w{0,63}$/i;

function fail(message: string): never {
  throw new WorkflowTreeVersionError(message);
}

function record(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`${label}必须是对象。`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    fail(`${label}必须是普通 JSON 对象。`);
  return value as JsonObject;
}

function checkKeys(value: JsonObject, keys: readonly string[], label: string) {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) fail(`${label}包含不支持的字段「${key}」。`);
  }
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    fail(`${label}不能为空。`);
  return value;
}

function executionId(value: unknown, label: string): string {
  const id = nonEmpty(value, label);
  if (!EXECUTION_ID.test(id)) fail(`${label}格式无效。`);
  return id;
}

function own(value: JsonObject, key: string): boolean {
  return Object.hasOwn(value, key);
}

function copy<T>(value: T): T {
  // Vue 响应式代理不支持 structuredClone；前面已保证这里只接收 JSON 值。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 输入先限为普通 JSON，避免函数、循环引用或过大数据被序列化静默丢弃。 */
function assertJson(value: unknown): void {
  const seen = new Set<object>();
  function inspect(current: unknown, depth: number): void {
    if (depth > MAX_DEPTH) fail('流程树超过最大嵌套深度。');
    if (
      current === null ||
      typeof current === 'string' ||
      typeof current === 'boolean'
    )
      return;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) fail('流程配置不能包含非有限数字。');
      return;
    }
    if (typeof current !== 'object') fail('流程配置只能包含 JSON 值。');
    if (seen.has(current)) fail('流程配置包含循环或共享对象引用。');
    seen.add(current);
    for (const child of Array.isArray(current)
      ? current
      : Object.values(record(current, '流程配置')))
      inspect(child, depth + 1);
    seen.delete(current);
  }
  inspect(value, 0);
  if (JSON.stringify(value).length > MAX_BYTES)
    fail('流程配置超过本地大小限制。');
}

function checkMetadata(value: unknown, label: string): void {
  if (value !== undefined) record(value, label);
}

/** 配置字段逐层封闭；实际变量类型和业务授权仍由服务端契约复核。 */
function checkOperand(value: unknown, label: string): void {
  const operand = record(value, label);
  checkKeys(operand, ['variable', 'literal'], label);
  if (Object.keys(operand).length !== 1)
    fail(`${label}必须且只能包含 variable 或 literal。`);
}

function checkCondition(value: unknown, label: string, depth = 0): void {
  if (depth > 8) fail(`${label}条件树超过允许深度。`);
  const condition = record(value, label);
  const keys = Object.keys(condition);
  if (keys.length !== 1) fail(`${label}必须且只能包含一个运算符。`);
  const operation = keys[0];
  if (
    !operation ||
    ![
      'all',
      'any',
      'dependency',
      'eq',
      'exists',
      'gt',
      'gte',
      'in',
      'isNull',
      'lt',
      'lte',
      'ne',
      'not',
      'validator',
    ].includes(operation)
  )
    fail(`${label}包含不支持的条件运算符。`);
  const body = condition[operation];
  switch (operation) {
    case 'all':
    case 'any': {
      if (!Array.isArray(body) || body.length === 0)
        fail(`${label}条件组合不能为空。`);
      for (const item of body) checkCondition(item, label, depth + 1);

      break;
    }
    case 'dependency': {
      checkKeys(
        record(body, label),
        ['purposeKey', 'round', 'outcome', 'effects'],
        label,
      );

      break;
    }
    case 'exists':
    case 'isNull': {
      checkOperand(body, label);

      break;
    }
    case 'not': {
      checkCondition(body, label, depth + 1);

      break;
    }
    case 'validator': {
      const validator = record(body, label);
      checkKeys(validator, ['key', 'parameters'], label);
      if (validator.parameters !== undefined) {
        for (const parameter of Object.values(
          record(validator.parameters, label),
        ))
          checkOperand(parameter, label);
      }

      break;
    }
    default: {
      if (!Array.isArray(body) || body.length !== 2)
        fail(`${label}比较条件必须恰有两个操作数。`);
      for (const operand of body) checkOperand(operand, label);
    }
  }
}

function checkConfiguration(root: JsonObject): void {
  if (root.businessBinding !== undefined)
    checkKeys(
      record(root.businessBinding, '业务绑定'),
      [
        'businessType',
        'contractVersion',
        'identityField',
        'titleField',
        'applicantField',
        'summaryField',
        'contractDigest',
      ],
      '业务绑定',
    );
  if (root.variables !== undefined) {
    for (const [name, variable] of Object.entries(
      record(root.variables, '变量目录'),
    ))
      checkKeys(
        record(variable, `变量「${name}」`),
        ['source', 'type', 'readAt'],
        `变量「${name}」`,
      );
  }
  if (root.startPolicy !== undefined) {
    const policy = record(root.startPolicy, '启动策略');
    checkKeys(
      policy,
      ['mode', 'priority', 'condition', 'events', 'servicePrincipal'],
      '启动策略',
    );
    if (policy.condition !== undefined)
      checkCondition(policy.condition, '启动条件');
  }
  if (root.dependencies !== undefined)
    checkCondition(root.dependencies, '流程依赖');
  if (root.outcomeActions !== undefined) {
    const outcomes = record(root.outcomeActions, '结果动作');
    checkKeys(
      outcomes,
      ['Approved', 'Rejected', 'Withdrawn', 'Terminated'],
      '结果动作',
    );
    for (const [outcome, actions] of Object.entries(outcomes)) {
      if (!Array.isArray(actions)) fail(`结果「${outcome}」动作必须是数组。`);
      for (const actionValue of actions) {
        const action = record(actionValue, `结果「${outcome}」动作`);
        checkKeys(action, ['action', 'parameters'], `结果「${outcome}」动作`);
        if (action.parameters !== undefined) {
          for (const parameter of Object.values(
            record(action.parameters, '动作参数'),
          ))
            checkOperand(parameter, '动作参数');
        }
      }
    }
  }
  if (root.simulationPolicy !== undefined) {
    const policy = record(root.simulationPolicy, '模拟样例');
    checkKeys(policy, ['cases'], '模拟样例');
    if (!Array.isArray(policy.cases) || policy.cases.length > 128)
      fail('模拟样例 cases 必须是最多 128 条的数组。');
    for (const sample of policy.cases) record(sample, '模拟样例');
  }
}

function checkNode(value: JsonObject, tree: boolean): void {
  const type = value.type;
  let additional: string[] = [];
  if (type === 'userTask') additional = TASK_KEYS;
  else if (type === 'end') additional = ['outcome'];
  else if (type === 'parallelGateway' || (tree && type === 'exclusiveGateway'))
    additional = ['joinId'];
  if (
    ![
      'end',
      'exclusiveGateway',
      'parallelGateway',
      'start',
      'userTask',
    ].includes(String(type))
  )
    fail(`不支持可执行节点类型「${String(type)}」。`);
  checkKeys(
    value,
    [...NODE_KEYS, ...additional, ...(tree ? TREE_KEYS : [])],
    `节点「${String(value.id)}」`,
  );
  if (type === 'userTask' && value.approverResolver !== undefined) {
    const resolver = record(
      value.approverResolver,
      `节点「${String(value.id)}」动态审批人`,
    );
    checkKeys(resolver, ['key', 'parameters'], '动态审批人');
    nonEmpty(resolver.key, '动态审批人标识');
    if (resolver.parameters !== undefined) {
      for (const [key, parameter] of Object.entries(
        record(resolver.parameters, '动态审批人参数'),
      ))
        checkOperand(parameter, `动态审批人参数「${key}」`);
    }
  }
  nonEmpty(value.id, '节点标识');
  executionId(value.id, '节点标识');
  nonEmpty(value.name, '节点名称');
  if (
    type === 'end' &&
    !['Approved', 'Rejected', 'Terminated', 'Withdrawn'].includes(
      String(value.outcome),
    )
  )
    fail(`结束节点「${String(value.id)}」缺少受支持的结果。`);
  for (const axis of ['x', 'y']) {
    if (
      own(value, axis) &&
      (typeof value[axis] !== 'number' || Math.abs(value[axis]) > 1_000_000)
    )
      fail(`节点「${String(value.id)}」坐标无效。`);
  }
  checkMetadata(value.metadata, `节点「${String(value.id)}」metadata`);
}

function checkRoot(value: JsonObject, version: 2 | 3): void {
  checkKeys(
    value,
    [...ROOT_KEYS, ...(version === 2 ? ['nodes', 'edges'] : ['flowTree'])],
    '版本根配置',
  );
  if (value.schemaVersion !== version)
    fail(`只接受 schemaVersion=${version} 的流程定义。`);
  if (version === 3 && (own(value, 'nodes') || own(value, 'edges')))
    fail('v3 不能并列提交平面节点或连线。');
  checkMetadata(value.metadata, '版本 metadata');
}

/** 将固定 v2 图显式转换为单棵受限树；此函数不写数据库，也不作为运行时兼容入口。 */
export function convertV2ToV3(
  definition: WorkflowDesignerDefinition,
): WorkflowTreeVersion {
  return convertFlatToTree(definition, false);
}

/** 草稿专用：保留连通的单入单出网关及尚未配齐的排他出口。 */
export function convertDraftV2ToV3(
  definition: WorkflowDesignerDefinition,
): WorkflowTreeVersion {
  return convertFlatToTree(definition, true);
}

function convertFlatToTree(
  definition: WorkflowDesignerDefinition,
  allowDraft: boolean,
): WorkflowTreeVersion {
  assertJson(definition);
  const source = record(definition, 'v2 定义');
  checkRoot(source, 2);
  checkConfiguration(source);
  if (!Array.isArray(definition.nodes) || !Array.isArray(definition.edges))
    fail('v2 定义必须包含完整节点和连线数组。');
  if (
    definition.nodes.length > MAX_NODES ||
    definition.edges.length > MAX_EDGES
  )
    fail('流程图超过节点或连线数量上限。');

  // 先按 v2 白名单核对每个原节点和边，再用既有低代码拓扑映射证明整图可表示。
  const nodes = new Map<string, VersionedNode>();
  const edges = new Map<string, VersionedEdge>();
  for (const node of definition.nodes) {
    const raw = record(node, 'v2 节点');
    checkNode(raw, false);
    if (nodes.has(node.id)) fail(`节点标识重复：${node.id}`);
    nodes.set(node.id, node);
  }
  for (const edge of definition.edges) {
    const raw = record(edge, 'v2 连线');
    checkKeys(raw, EDGE_KEYS, `连线「${String(edge.id)}」`);
    nonEmpty(edge.id, '连线标识');
    executionId(edge.id, '连线标识');
    if (own(raw, 'default') && edge.default === false)
      fail(`v2 连线「${edge.id}」显式 false 无法无损转换为 v3 默认边。`);
    checkMetadata(raw.metadata, `连线「${edge.id}」metadata`);
    if (own(raw, 'condition'))
      checkCondition(edge.condition, `连线「${edge.id}」条件`);
    if (edges.has(edge.id)) fail(`连线标识重复：${edge.id}`);
    edges.set(edge.id, edge);
  }
  const canvas = toLowflowCanvasTree(definition, { allowDraft });

  // 画布树只包含展示字段；按稳定 ID 从原始图回填业务配置和边 metadata。
  function hydrate(view: LowflowCanvasNode): WorkflowTreeNode {
    const original = nodes.get(view.id);
    if (!original) fail(`画布缺少原节点「${view.id}」。`);
    const result: WorkflowTreeNode = copy(original);
    if (view.joinId && view.type === 'exclusiveGateway')
      result.joinId = view.joinId;
    if (view.nextEdgeId) {
      const edge = edges.get(view.nextEdgeId);
      if (!edge) fail(`画布缺少原连线「${view.nextEdgeId}」。`);
      result.nextEdgeId = edge.id;
      result.nextTargetId = edge.target;
      if (edge.metadata !== undefined)
        result.nextEdgeMetadata = copy(edge.metadata);
    }
    if (view.branches) {
      result.branches = view.branches.map((branch) => {
        const edge = edges.get(nonEmpty(branch.edgeId, '分支连线标识'));
        if (!edge) fail(`画布缺少分支原连线「${branch.edgeId}」。`);
        return {
          id: branch.id,
          name: branch.name,
          type: 'condition',
          edgeId: edge.id,
          targetId: edge.target,
          ...(edge.condition ? { condition: copy(edge.condition) } : {}),
          ...(edge.default === true ? { default: true } : {}),
          ...(edge.metadata === undefined
            ? {}
            : { metadata: copy(edge.metadata) }),
          ...(branch.next ? { next: hydrate(branch.next) } : {}),
        };
      });
    }
    if (view.next) result.next = hydrate(view.next);
    return result;
  }

  const { nodes: _nodes, edges: _edges, ...root } = copy(definition);
  const converted: WorkflowTreeVersion = {
    ...root,
    schemaVersion: 3,
    flowTree: hydrate(canvas),
  };

  // 新树会增加包装字段，重新核对大小和可投影性，避免 v2 恰在上限内而 v3 保存时失败。
  assertJson(converted);
  projectTreeToFlat(converted, allowDraft);
  return converted;
}

/** v3 树只在内存中投影；正式保存、模拟与发布必须由后端重新投影和校验。 */
export function projectV3ToV2(
  definition: WorkflowTreeVersion,
): WorkflowDesignerDefinition {
  return projectTreeToFlat(definition, false);
}

/** 草稿专用投影不可用于模拟、发布或 Flowable 部署。 */
export function projectDraftV3ToV2(
  definition: WorkflowTreeVersion,
): WorkflowDesignerDefinition {
  return projectTreeToFlat(definition, true);
}

function projectTreeToFlat(
  definition: WorkflowTreeVersion,
  allowDraft: boolean,
): WorkflowDesignerDefinition {
  assertJson(definition);
  const root = record(definition, 'v3 定义');
  checkRoot(root, 3);
  checkConfiguration(root);
  const nodes: VersionedNode[] = [];
  const edges: VersionedEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const branchIds = new Set<string>();

  function appendEdge(edge: VersionedEdge): void {
    if (edgeIds.has(edge.id) || edges.length >= MAX_EDGES)
      fail(`连线标识重复或数量超限：${edge.id}`);
    edgeIds.add(edge.id);
    edges.push(edge);
  }

  // 条件包装节点只还原边；它的稳定 branch:<edgeId> 标识不得占用真实节点 ID。
  function visitBranch(
    branch: WorkflowTreeBranch,
    gateway: WorkflowTreeNode,
    stop?: string,
  ): void {
    const raw = record(branch, '分支包装节点');
    checkKeys(raw, BRANCH_KEYS, `分支「${String(branch.id)}」`);
    if (branch.type !== 'condition') fail('分支包装节点类型必须为 condition。');
    nonEmpty(branch.name, '分支名称');
    nonEmpty(branch.edgeId, '分支连线标识');
    nonEmpty(branch.targetId, '分支目标标识');
    executionId(branch.edgeId, '分支连线标识');
    executionId(branch.targetId, '分支目标标识');
    if (branch.id !== `branch:${branch.edgeId}` || branchIds.has(branch.id))
      fail(`分支包装标识无效或重复：${branch.id}`);
    branchIds.add(branch.id);
    checkMetadata(branch.metadata, `分支「${branch.id}」metadata`);
    if (branch.next && branch.next.id !== branch.targetId)
      fail(`分支「${branch.id}」目标与后继节点不一致。`);
    if (!branch.next && branch.targetId !== stop)
      fail(`分支「${branch.id}」丢失目标节点。`);
    if (
      gateway.type === 'parallelGateway' &&
      (own(raw, 'condition') || own(raw, 'default'))
    )
      fail(`并行分支「${branch.id}」不能带条件或默认标记。`);
    if (own(raw, 'default') && branch.default !== true)
      fail(`分支「${branch.id}」的 default 只能为 true。`);
    if (
      gateway.type === 'exclusiveGateway' &&
      ((branch.default === true && own(raw, 'condition')) ||
        (!allowDraft && branch.default !== true && !own(raw, 'condition')))
    )
      fail(`排他分支「${branch.id}」的条件或默认标记无效。`);
    if (own(raw, 'condition'))
      checkCondition(branch.condition, `分支「${branch.id}」条件`);
    appendEdge({
      id: branch.edgeId,
      source: gateway.id,
      target: branch.targetId,
      ...(own(raw, 'condition') ? { condition: copy(branch.condition) } : {}),
      ...(own(raw, 'default') ? { default: branch.default } : {}),
      ...(branch.metadata === undefined
        ? {}
        : { metadata: copy(branch.metadata) }),
    });
    if (branch.next) visit(branch.next, stop);
  }

  // 每个真实节点恰好投影一次；分支末端只允许用目标 ID 指向当前汇聚点。
  function visit(value: WorkflowTreeNode, stop?: string, depth = 0): void {
    if (depth > MAX_DEPTH) fail('流程树超过最大嵌套深度。');
    const raw = record(value, '流程树节点');
    checkNode(raw, true);
    if (
      nodeIds.has(value.id) ||
      branchIds.has(value.id) ||
      nodes.length >= MAX_NODES
    )
      fail(`节点标识重复或数量超限：${value.id}`);
    nodeIds.add(value.id);
    if (value.joinId) executionId(value.joinId, '汇聚节点标识');
    if (value.type === 'start' && nodes.length > 0)
      fail('开始节点只能位于流程树根。');
    const {
      next,
      branches,
      nextEdgeId,
      nextTargetId,
      nextEdgeMetadata,
      ...fields
    } = value;
    if (value.type === 'exclusiveGateway') delete fields.joinId;
    nodes.push(copy(fields));

    if (value.type === 'end') {
      if (
        next ||
        branches ||
        own(raw, 'nextEdgeId') ||
        own(raw, 'nextTargetId') ||
        own(raw, 'nextEdgeMetadata')
      )
        fail(`结束节点「${value.id}」不能有后继。`);
      return;
    }
    if (branches) {
      if (!Array.isArray(branches)) fail(`网关「${value.id}」分支必须是数组。`);
      if (
        !['exclusiveGateway', 'parallelGateway'].includes(value.type) ||
        branches.length < 2 ||
        own(raw, 'nextEdgeId') ||
        own(raw, 'nextTargetId') ||
        own(raw, 'nextEdgeMetadata')
      )
        fail(`网关「${value.id}」分支结构无效。`);
      if (value.type === 'parallelGateway' && !value.joinId)
        fail(`并行分叉「${value.id}」缺少汇聚节点。`);
      if (next && (!value.joinId || next.id !== value.joinId))
        fail(`网关「${value.id}」汇聚后继不一致。`);
      if (value.joinId && !next && value.joinId !== stop)
        fail(`网关「${value.id}」丢失汇聚节点。`);
      const defaults = branches.filter(
        (branch) => branch.default === true,
      ).length;
      if (
        value.type === 'exclusiveGateway' &&
        (defaults > 1 || (!allowDraft && defaults !== 1))
      )
        fail(`排他网关「${value.id}」必须恰有一条默认分支。`);
      for (const branch of branches) visitBranch(branch, value, value.joinId);
      if (next) visit(next, stop, depth + 1);
      return;
    }

    if (own(raw, 'joinId')) fail(`非分叉节点「${value.id}」不能声明汇聚目标。`);
    if (
      !nextEdgeId ||
      !nextTargetId ||
      !own(raw, 'nextEdgeId') ||
      !own(raw, 'nextTargetId')
    )
      fail(`节点「${value.id}」缺少成对的后继连线身份。`);
    executionId(nextEdgeId, '后继连线标识');
    executionId(nextTargetId, '后继目标标识');
    if (next && next.id !== nextTargetId)
      fail(`节点「${value.id}」的后继目标不一致。`);
    if (!next && nextTargetId !== stop)
      fail(`节点「${value.id}」丢失目标节点。`);
    checkMetadata(nextEdgeMetadata, `连线「${nextEdgeId}」metadata`);
    appendEdge({
      id: nextEdgeId,
      source: value.id,
      target: nextTargetId,
      ...(nextEdgeMetadata === undefined
        ? {}
        : { metadata: copy(nextEdgeMetadata) }),
    });
    if (next) visit(next, stop, depth + 1);
  }

  if (!definition.flowTree || definition.flowTree.type !== 'start')
    fail('流程树根必须是开始节点。');
  visit(definition.flowTree);
  if ([...branchIds].some((id) => nodeIds.has(id)))
    fail('分支包装标识与真实节点冲突。');
  if ([...edgeIds].some((id) => nodeIds.has(id)))
    fail('连线标识与真实节点冲突。');
  const { flowTree: _flowTree, ...versionFields } = copy(definition);
  const result = {
    ...versionFields,
    schemaVersion: 2 as const,
    nodes,
    edges,
  } as WorkflowDesignerDefinition;

  // 再用当前受支持图形拓扑校验拒绝环、孤立图和非法并行配对；排他 joinId 是树标记而非 v2 执行字段。
  const canonical = toLowflowCanvasTree(result, { allowDraft });
  const expectedExclusiveJoins = new Map<string, string>();
  function collectJoins(node: WorkflowTreeNode): void {
    if (node.type === 'exclusiveGateway' && node.joinId)
      expectedExclusiveJoins.set(node.id, node.joinId);
    if (node.next) collectJoins(node.next);
    for (const branch of node.branches ?? []) {
      if (branch.next) collectJoins(branch.next);
    }
  }
  collectJoins(definition.flowTree);
  function verifyJoins(node: LowflowCanvasNode): void {
    const expected = expectedExclusiveJoins.get(node.id);
    if (expected && expected !== node.joinId)
      fail(`排他网关「${node.id}」汇聚标识与拓扑不一致。`);
    if (node.next) verifyJoins(node.next);
    for (const branch of node.branches ?? []) {
      if (branch.next) verifyJoins(branch.next);
    }
  }
  verifyJoins(canonical);
  return result;
}
