import { RequestService } from '@levin/admin-framework';

import type { WorkflowInstanceView, WorkflowTaskView } from './types';

/**
 * 流程执行组件的默认服务端连接器。
 * 宿主可传入自己的实现替换它；当前用户由后端会话确定，前端不提交用户身份。
 */
export class WorkflowRuntimeService extends RequestService {
  constructor(basePath = '/com.levin.oak.base/V1/api') {
    super(basePath);
  }

  async complete(data: { actionCode: string; formData?: Record<string, unknown>; formSummary?: string; taskId: string; verificationCode?: string; verificationType?: string }) {
    return this.post<WorkflowTaskView>('workflow-runtime/complete', { data });
  }

  async prepareStepUpAuth(data: { actionCode: string; formSummary?: string; taskId: string; verificationType: string }) {
    return this.post<{ interactionData?: unknown; message?: string; successful: boolean; verificationType: string }>('workflow-runtime/step-up-auth/prepare', { data });
  }

  async done() {
    return this.get<WorkflowTaskView[]>('workflow-runtime/done');
  }

  async todo() {
    return this.get<WorkflowTaskView[]>('workflow-runtime/todo');
  }

  async started() {
    return this.get<WorkflowInstanceView[]>('workflow-runtime/started');
  }
}
