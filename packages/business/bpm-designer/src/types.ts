/** v2 平面图仅供显式迁移工具及历史转换测试使用；可编辑 UI 使用 v3 树。 */
export type WorkflowNodeType =
  | 'end'
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'start'
  | 'userTask';
export type WorkflowVersionLifecycle =
  | 'Archived'
  | 'Draft'
  | 'Published'
  | 'Retired'
  | 'Retiring'
  | 'Testing';

export interface WorkflowCandidate {
  id: string;
  /** `user`、`role` 或 `org`；由宿主候选接口返回，不由设计器猜测。 */
  kind?: 'org' | 'role' | 'user';
  label: string;
  value?: string;
}
export type WorkflowValueType =
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'decimal'
  | 'enum'
  | 'integer'
  | 'string'
  | 'stringSet';
export interface WorkflowFormField {
  conditionable?: boolean;
  editable?: boolean;
  enumValues?: string[];
  key: string;
  label: string;
  required?: boolean;
  type?: WorkflowValueType;
}
export interface WorkflowCapabilityField {
  condition?: boolean;
  display?: boolean;
  editable?: boolean;
  enumValues?: string[];
  nullable?: boolean;
  scale?: number;
  sensitivity?: 'public' | 'restricted' | 'secret';
  title: string;
  type: WorkflowValueType;
}
export interface WorkflowBusinessAction {
  idempotent?: boolean;
  parameters?: Record<string, WorkflowCapabilityField>;
  simulation?: boolean;
  title: string;
  transaction?: 'external' | 'local';
  writableFields?: string[];
}
export interface WorkflowApproverResolver {
  parameters?: Record<string, WorkflowCapabilityField>;
  permission?: string;
  simulation?: unknown;
  title: string;
}
export interface WorkflowBusinessType {
  actions?: Record<string, WorkflowBusinessAction>;
  approverResolvers?: null | Record<string, WorkflowApproverResolver>;
  businessType: string;
  contractVersion: number | string;
  defaultBinding?: {
    applicantField?: string;
    identityField?: string;
    summaryField?: string;
    titleField?: string;
  };
  eventTypes?: string[];
  fields: Record<string, WorkflowCapabilityField>;
  title: string;
  validators?: Record<string, WorkflowBusinessAction>;
}
export interface WorkflowOperand {
  literal?: unknown;
  variable?: string;
}
export interface WorkflowDependency {
  effects: 'Applied';
  outcome: string;
  purposeKey: string;
  round: 'current';
}
export interface WorkflowCondition {
  all?: WorkflowCondition[];
  any?: WorkflowCondition[];
  dependency?: WorkflowDependency;
  eq?: WorkflowOperand[];
  exists?: WorkflowOperand;
  gt?: WorkflowOperand[];
  gte?: WorkflowOperand[];
  in?: WorkflowOperand[];
  isNull?: WorkflowOperand;
  lt?: WorkflowOperand[];
  lte?: WorkflowOperand[];
  ne?: WorkflowOperand[];
  not?: WorkflowCondition;
  validator?: { key: string; parameters?: Record<string, WorkflowOperand> };
}
export interface WorkflowVariable {
  readAt: 'node' | 'start';
  source: string;
  type: WorkflowValueType;
}
export interface WorkflowNode {
  actionCandidateGroups?: string[];
  actionCandidateUsers?: string[];
  actions?: string[];
  allowSelfApproval?: boolean;
  approverResolver?: {
    key: string;
    parameters?: Record<string, WorkflowOperand>;
  };
  candidateGroups?: string[];
  candidateUsers?: string[];
  deadlineEscalationUsers?: string[];
  deadlineMinutes?: number;
  editableFields?: string[];
  emptyAssigneePolicy?: 'ESCALATE' | 'REJECT';
  escalationCandidateGroups?: string[];
  escalationCandidateUsers?: string[];
  formAction?: string;
  id: string;
  joinId?: string;
  multiApprovalMode?: 'ALL' | 'ANY' | 'NONE';
  name: string;
  outcome?: string;
  readableFields?: string[];
  reminderMinutes?: number;
  requiredFields?: string[];
  returnTargets?: string[];
  stepUpVerifyTypes?: string[];
  type: WorkflowNodeType;
  x?: number;
  y?: number;
}
export interface WorkflowEdge {
  condition?: WorkflowCondition;
  default?: boolean;
  id: string;
  source: string;
  target: string;
}
export interface WorkflowOutcomeAction {
  action: string;
  parameters?: Record<string, WorkflowOperand>;
}
export interface WorkflowDesignerDefinition {
  businessBinding?: {
    applicantField?: string;
    businessType: string;
    contractVersion: number | string;
    identityField: string;
    summaryField?: string;
    titleField: string;
  };
  dependencies?: WorkflowCondition;
  edges?: WorkflowEdge[];
  name: string;
  nodes: WorkflowNode[];
  outcomeActions?: Record<string, WorkflowOutcomeAction[]>;
  processKey: string;
  purposeKey?: string;
  schemaVersion?: 2;
  startPolicy?: {
    condition?: WorkflowCondition;
    events?: string[];
    mode: 'event' | 'manual';
    priority?: number;
    servicePrincipal?: string;
  };
  variables?: Record<string, WorkflowVariable>;
}
export interface WorkflowDesignerOptions {
  businessTypes?: WorkflowBusinessType[];
  fields?: WorkflowFormField[];
  groups?: WorkflowCandidate[];
  purposeOptions?: { label: string; value: string }[];
  users?: WorkflowCandidate[];
}

/** 工作流定义版本的最小展示/操作契约。生命周期最终由服务端状态机裁决。 */
export interface WorkflowDefinitionVersion {
  bpmnXml?: string;
  id: string;
  lifecycle: WorkflowVersionLifecycle;
  lowflowDefinition?: import('./workflow-tree-version').WorkflowTreeVersion;
  lowflowJson?: string;
  optimisticLock?: number;
  simulationReport?: WorkflowSimulationReport;
  versionNo?: number;
  workflowDefinitionId?: string;
}

export interface WorkflowSimulationReport {
  coveredBranches?: string[];
  coveredTaskKeys?: string[];
  finishedAt?: string;
  message?: string;
  runId?: string;
  successful: boolean;
  uncoveredBranches?: string[];
}

/** 仅来自已授权固定版本的模拟历史；轨迹由服务端在详情接口返回。 */
export interface WorkflowSimulationHistory {
  coverageReport?: Record<string, unknown>;
  executionTrace?: Record<string, unknown>;
  failureMessage?: string;
  finishedTime?: string;
  id: string;
  startedTime?: string;
  status: 'Deleted' | 'Failed' | 'Passed' | 'Running';
}

export interface WorkflowSimulationHistoryPage {
  items: WorkflowSimulationHistory[];
  totals: number;
}
