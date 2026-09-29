/**
 * 与后端受支持低代码流程 JSON 对齐的设计器模型。
 * 画布只产生 start/userTask/end；发布前仍由服务端转换器做最终校验。
 */
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
export interface WorkflowBusinessType {
  actions?: Record<string, WorkflowBusinessAction>;
  businessType: string;
  contractVersion: number | string;
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
  lowflowDefinition?: WorkflowDesignerDefinition;
  lowflowJson?: string;
  optimisticLock?: number;
  simulationReport?: WorkflowSimulationReport;
  versionNo?: number;
  workflowDefinitionId?: string;
}

export interface WorkflowSimulationReport {
  coveredBranches?: string[];
  finishedAt?: string;
  message?: string;
  runId?: string;
  successful: boolean;
  uncoveredBranches?: string[];
}
