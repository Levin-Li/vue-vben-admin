import type {
  WorkflowCondition,
  WorkflowNotification,
  WorkflowVariable,
} from './types';

/** 状态值保持服务端字段类型，不以界面字符串替代整数。 */
export type WorkflowStateValue = number | string;
export interface WorkflowStateOption {
  label: string;
  value: WorkflowStateValue;
}
export interface WorkflowStateBinding {
  businessEntityKey: string;
  businessType?: string;
  contractVersion?: number | string;
  stateField: string;
  stateMapping: WorkflowStateOption[];
  stateType: 'enum' | 'integer' | 'string';
}
export interface WorkflowStateEvent {
  delayMinutes?: number;
  id: string;
  title: string;
  trigger: 'auto' | 'manual' | 'message' | 'task' | 'timer';
}
export interface WorkflowStateNode {
  allowSelfApproval?: boolean;
  approval?: {
    candidateGroups: string[];
    candidateUsers: string[];
    completionEvent?: string;
    mode: 'ALL' | 'ANY' | 'NONE' | 'SEQUENTIAL';
    rejectionEvent?: string;
  };
  copies?: {
    candidateGroups: string[];
    candidateUsers: string[];
    event: 'NodeCompleted' | 'NodeEntered';
  }[];
  editableFields?: string[];
  id: string;
  name: string;
  notifications?: WorkflowNotification[];
  outcome?: 'Approved' | 'Rejected' | 'Terminated' | 'Withdrawn';
  readableFields?: string[];
  requiredFields?: string[];
  startCondition?: WorkflowCondition;
  stateValue: WorkflowStateValue;
  terminal?: boolean;
  x?: number;
  y?: number;
}
export interface WorkflowStateEdge {
  condition?: WorkflowCondition;
  event: string;
  id: string;
  source: string;
  target: string;
}
export interface WorkflowStateGraph {
  businessBinding: WorkflowStateBinding;
  edges: WorkflowStateEdge[];
  events: WorkflowStateEvent[];
  metadata?: Record<string, unknown>;
  name: string;
  nodes: WorkflowStateNode[];
  processKey: string;
  schemaVersion: 4;
  simulationPolicy?: {
    cases: {
      expectNodeId?: string;
      name?: string;
      steps: {
        action?: 'approve' | 'reject';
        advanceMinutes?: number;
        event?: string;
        expectNodeId?: string;
        formData?: Record<string, unknown>;
        nodeId?: string;
        userId?: string;
      }[];
      variables: Record<string, unknown>;
    }[];
  };
  startNodeId: string;
  variables?: Record<string, WorkflowVariable>;
}

/** 新建只引用绑定映射；界面无法在节点中临时创造业务状态。 */
export function createStateGraph(
  binding: WorkflowStateBinding,
  processKey = '',
  name = '',
): WorkflowStateGraph {
  // 目录或定义记录可能来自 Vue 响应式状态，先保存普通 JSON 绑定快照。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  binding = JSON.parse(JSON.stringify(binding)) as WorkflowStateBinding;
  return {
    schemaVersion: 4,
    processKey,
    name,
    businessBinding: binding,
    startNodeId: binding.stateMapping.length > 0 ? 'state_1' : '',
    nodes: binding.stateMapping.slice(0, 1).map((state, index) => ({
      id: `state_${index + 1}`,
      name: state.label,
      stateValue: state.value,
      x: 60 + (index % 3) * 320,
      y: 100 + Math.floor(index / 3) * 160,
    })),
    events: [],
    edges: [],
    variables: {},
    simulationPolicy: { cases: [] },
  };
}
export function sameState(left: unknown, right: unknown) {
  return typeof left === typeof right && left === right;
}

/** 草稿可暂未连全；发布前显示完整错误，服务端仍执行权威校验。 */
export function validateStateGraph(
  graph: WorkflowStateGraph,
  draft = false,
): string[] {
  const errors: string[] = [];
  if (graph.schemaVersion !== 4) errors.push('只接受第四版状态图。');
  if (
    !graph.businessBinding?.businessEntityKey ||
    !graph.businessBinding.stateField
  )
    errors.push('请绑定业务对象和状态字段。');
  const mapping = graph.businessBinding?.stateMapping ?? [];
  if (mapping.length === 0) errors.push('请先定义状态值与名称。');
  const values = new Set<string>();
  for (const state of mapping) {
    const key = `${typeof state.value}:${state.value}`;
    if (!state.label?.trim() || values.has(key))
      errors.push('状态值不能重复，状态名称不能为空。');
    values.add(key);
    if (
      graph.businessBinding.stateType === 'integer'
        ? !Number.isSafeInteger(state.value)
        : typeof state.value !== 'string'
    )
      errors.push('状态值与绑定字段类型不一致。');
  }
  const nodeIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || nodeIds.has(node.id))
      errors.push('节点标识不能为空或重复。');
    nodeIds.add(node.id);
    if (!mapping.some((state) => sameState(state.value, node.stateValue)))
      errors.push(`「${node.name}」引用了未定义状态。`);
    if (node.terminal && !node.outcome && !draft)
      errors.push(`「${node.name}」请选择结束结果。`);
    if (!node.name?.trim()) errors.push('节点名称不能为空。');
    if (node.startCondition && node.id !== graph.startNodeId)
      errors.push('只有开始节点可设置启动条件。');
    const approval = node.approval;
    if (approval && !draft) {
      if (
        approval.candidateUsers.length === 0 &&
        approval.candidateGroups.length === 0
      )
        errors.push(`「${node.name}」请选择办理人或角色。`);
      if (
        !graph.events.some(
          (event) =>
            event.id === approval.completionEvent && event.trigger === 'task',
        )
      )
        errors.push(`「${node.name}」请选择办理完成事件。`);
    }
    if (
      node.editableFields?.some(
        (field) => !node.readableFields?.includes(field),
      )
    )
      errors.push(`「${node.name}」可编辑字段必须可见。`);
    if (
      node.requiredFields?.some(
        (field) => !node.editableFields?.includes(field),
      )
    )
      errors.push(`「${node.name}」必填字段必须可编辑。`);
  }
  if (!nodeIds.has(graph.startNodeId)) errors.push('请选择开始状态。');
  for (const event of graph.events) {
    if (!event.id || !event.title?.trim() || eventIds.has(event.id))
      errors.push('事件标识不能重复，名称不能为空。');
    eventIds.add(event.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (!edge.id || edgeIds.has(edge.id))
      errors.push('路线标识不能为空或重复。');
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
      errors.push('路线引用了不存在的状态。');
    if (!eventIds.has(edge.event)) errors.push('请为每条路线选择事件。');
    if (graph.nodes.find((node) => node.id === edge.source)?.terminal)
      errors.push('结束状态不能设置离开路线。');
  }
  if (!draft && nodeIds.has(graph.startNodeId)) {
    const visited = new Set<string>();
    const queue = [graph.startNodeId];
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) continue;
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(
        ...graph.edges
          .filter((edge) => edge.source === id)
          .map((edge) => edge.target),
      );
    }
    if (visited.size !== nodeIds.size)
      errors.push('存在无法从开始状态到达的节点。');
    if (!graph.nodes.some((node) => node.terminal))
      errors.push('请至少设置一个结束状态。');
  }
  return [...new Set(errors)];
}

/** 已部署业务目录由服务端按真实 CRUD 权限筛选，动态来源保留统一标识。 */
export interface WorkflowBusinessObjectField {
  bound?: boolean;
  boundDefinitionId?: string;
  boundDefinitionName?: string;
  conditionAllowed?: boolean;
  description?: string;
  dictCode?: string;
  editable?: boolean;
  enumName?: string;
  javaType?: string;
  key: string;
  manualMappingRequired?: boolean;
  nullable: boolean;
  options?: WorkflowStateOption[];
  optionSource?: 'dictionary' | 'enum' | 'fixed' | null;
  stateFieldAllowed: boolean;
  stateUnavailableReason?: string;
  title: string;
  type: string;
}
export interface WorkflowBusinessObject {
  className?: string;
  description?: string;
  entityKey: string;
  fields: WorkflowBusinessObjectField[];
  provider: string;
  selectable: boolean;
  title: string;
  unavailableReason?: string;
}
