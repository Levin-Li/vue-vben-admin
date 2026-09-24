/**
 * 流程执行组件的稳定展示契约。
 * 实际动作许可、字段必填与二次验证要求必须来自服务端，不由组件自行推断。
 */
export interface WorkflowTaskAction {
  code: string;
  label: string;
  requiresComment?: boolean;
}

export interface WorkflowNotification { channel: string; content: string; createdAt?: string; read?: boolean; title?: string; }
export interface WorkflowTimelineItem { actor?: string; comment?: string; name: string; time?: string; }
export interface WorkflowFormItem { key: string; label: string; required?: boolean; type?: 'textarea' | 'text'; }

export interface WorkflowTaskView {
  actions?: WorkflowTaskAction[];
  businessTitle?: string;
  formItems?: WorkflowFormItem[];
  processInstanceId?: string;
  processDiagramNodes?: Array<{ id: string; name: string; status?: 'active' | 'completed' | 'pending' }>;
  requiredFields?: string[];
  status?: string;
  taskId: string;
  taskDefinitionKey?: string;
  taskName?: string;
  timeline?: WorkflowTimelineItem[];
  verificationTypes?: string[];
  notifications?: WorkflowNotification[];
}

export interface WorkflowInstanceView {
  definitionVersionId?: string;
  instanceId: string;
  processDefinitionId?: string;
  status: string;
}

export interface WorkflowTaskSubmitPayload {
  action: WorkflowTaskAction;
  formData: Record<string, unknown>;
  verificationCode?: string;
  verificationType?: string;
}
