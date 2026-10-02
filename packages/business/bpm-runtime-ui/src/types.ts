/**
 * 流程执行组件的稳定展示契约。
 * 实际动作许可、字段必填与二次验证要求必须来自服务端，不由组件自行推断。
 */
export interface WorkflowTaskAction {
  addSignPositions?: WorkflowOption[];
  candidateUsers?: WorkflowOption[];
  code: string;
  label: string;
  requiresComment?: boolean;
  returnTargets?: WorkflowOption[];
}

/** 选项必须来自本次任务的服务端授权结果，不提供任意人员输入。 */
export interface WorkflowOption {
  label: string;
  value: string;
}
export interface WorkflowBusinessReference {
  businessId: string;
  businessType: string;
  orgId?: string;
  /** 用户明确选择的候选作用域，服务端仍须校验实际对象归属与访问权限。 */
  tenantId?: string;
}
export interface WorkflowBusinessField {
  key: string;
  label: string;
  value?: unknown;
}

/** 私有附件只暴露最小元数据，原始字节仅经当前授权下载接口获取。 */
export interface WorkflowAttachmentMeta {
  attached: boolean;
  contentSha256: string;
  fileName: string;
  id: string;
  mimeType: string;
  sizeBytes: number;
}
export interface WorkflowBusinessDetail extends WorkflowBusinessReference {
  businessFields?: WorkflowBusinessField[];
  businessTitle?: string;
  detailComponentKey?: string;
}

export interface WorkflowNotification {
  channel: string;
  content: string;
  createdAt?: string;
  read?: boolean;
  title?: string;
}
export interface WorkflowTimelineItem {
  action?: string;
  actor?: string;
  comment?: string;
  id?: string;
  name: string;
  nodeId?: string;
  status?: string;
  taskId?: string;
  time?: string;
}

export type WorkflowNodeStatus =
  | 'active'
  | 'cancelled'
  | 'completed'
  | 'pending'
  | 'skipped';
export interface WorkflowDiagramNode {
  id: string;
  name: string;
  status?: WorkflowNodeStatus;
  type?: string;
}
export interface WorkflowDiagramEdge {
  id: string;
  source: string;
  target: string;
}
export interface WorkflowFormItem {
  key: string;
  label: string;
  options?: Array<{ label: string; value: boolean | number | string }>;
  readOnly?: boolean;
  required?: boolean;
  type?: 'boolean' | 'date' | 'number' | 'select' | 'text' | 'textarea';
  value?: unknown;
}

export interface WorkflowTaskView {
  actions?: WorkflowTaskAction[];
  businessFields?: WorkflowBusinessField[];
  businessId?: string;
  businessTitle?: string;
  businessType?: string;
  detailComponentKey?: string;
  effectStatus?: string;
  executionStatus?: string;
  formItems?: WorkflowFormItem[];
  notifications?: WorkflowNotification[];
  orgId?: string;
  outcome?: string;
  processDiagramEdges?: WorkflowDiagramEdge[];
  processDiagramNodes?: WorkflowDiagramNode[];
  processInstanceId?: string;
  requiredFields?: string[];
  status?: string;
  taskDefinitionKey?: string;
  taskId: string;
  taskName?: string;
  tenantId?: string;
  timeline?: WorkflowTimelineItem[];
  timelineTruncated?: boolean;
  verificationTypes?: string[];
}

/** 运行四分栏由服务端授权并按游标分页；不提供推测出的总数。 */
export interface WorkflowRuntimePage<T> {
  hasMore: boolean;
  items: T[];
  nextCursor?: string;
}

export interface WorkflowRuntimePageQuery {
  cursor?: string;
  size?: number;
}

export interface WorkflowInstanceView {
  attemptNo?: number;
  businessContractVersion?: string;
  businessId?: string;
  businessTitle?: string;
  businessType?: string;
  definitionVersionId?: string;
  effectStatus?: string;
  executionStatus?: string;
  instanceId: string;
  lastError?: string;
  orgId?: string;
  outcome?: string;
  pendingDispatchId?: string;
  processDefinitionId?: string;
  processDiagramEdges?: WorkflowDiagramEdge[];
  processDiagramNodes?: WorkflowDiagramNode[];
  purposeKey?: string;
  roundId?: string;
  /** 平台用途运行记录标识，显式重提必须引用它而不是引擎实例标识。 */
  runId?: string;
  status: string;
  tenantId?: string;
  timeline?: WorkflowTimelineItem[];
  timelineTruncated?: boolean;
}

/** 所有动作参数与审批意见均参与二次验证，禁止动作切换后沿用旧凭据。 */
export interface WorkflowActionInput {
  addSignPosition?: string;
  attachmentIds?: string[];
  comment?: string;
  formData: Record<string, unknown>;
  targetNodeId?: string;
  targetUserId?: string;
  targetUserIds?: string[];
}

export interface WorkflowTaskSubmitPayload extends WorkflowActionInput {
  action: WorkflowTaskAction;
  verificationCode?: string;
  verificationType?: string;
}

/** 挑战只可交付给发起准备请求时的任务及输入代际。 */
export interface WorkflowVerificationChallenge {
  contextVersion: number;
  interactionData?: unknown;
  successful: boolean;
  taskId: string;
  verificationType: string;
}

export interface WorkflowCompleteRequest extends WorkflowActionInput {
  actionCode: string;
  formSummary?: string;
  taskId: string;
  verificationCode?: string;
  verificationType?: string;
}

export interface WorkflowEligibility {
  definitionVersionId?: string;
  eligible: boolean;
  purposeKey: string;
  purposeName?: string;
  reasons?: string[];
  /** event 用途不能被普通发起按钮触发，只能走受控事件或同轮重提。 */
  startMode?: 'event' | 'manual';
}

export interface WorkflowRoundState {
  active: boolean;
  contractVersion: string;
  currentRoundId?: string;
  reasons?: string[];
  /** 服务端完整校验同轮最新失败来源后返回；不能从截断历史猜测。 */
  resubmittableRunIds?: string[];
  revision: string;
}
