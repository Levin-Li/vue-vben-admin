/**
 * 与后端受支持低代码流程 JSON 对齐的设计器模型。
 * 画布只产生 start/userTask/end；发布前仍由服务端转换器做最终校验。
 */
export type WorkflowNodeType = 'end' | 'start' | 'userTask';
export type WorkflowVersionLifecycle = 'Archived' | 'Draft' | 'Published' | 'Retired' | 'Retiring' | 'Testing';

export interface WorkflowCandidate {
  id: string;
  label: string;
  /** `user`、`role` 或 `org`；由宿主候选接口返回，不由设计器猜测。 */
  kind?: 'org' | 'role' | 'user';
  value?: string;
}
export interface WorkflowFormField { key: string; label: string; required?: boolean; }
export interface WorkflowNode {
  actions?: string[];
  candidateGroups?: string[];
  candidateUsers?: string[];
  id: string;
  name: string;
  requiredFields?: string[];
  stepUpVerifyTypes?: string[];
  type: WorkflowNodeType;
}
export interface WorkflowDesignerDefinition { name: string; nodes: WorkflowNode[]; processKey: string; }
export interface WorkflowDesignerOptions {
  fields?: WorkflowFormField[];
  groups?: WorkflowCandidate[];
  users?: WorkflowCandidate[];
}

/** 工作流定义版本的最小展示/操作契约。生命周期最终由服务端状态机裁决。 */
export interface WorkflowDefinitionVersion {
  bpmnXml?: string;
  id: string;
  lifecycle: WorkflowVersionLifecycle;
  lowflowJson?: string;
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
