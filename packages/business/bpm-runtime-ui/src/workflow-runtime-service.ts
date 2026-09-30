import type {
  WorkflowAttachmentMeta,
  WorkflowBusinessReference,
  WorkflowCompleteRequest,
  WorkflowEligibility,
  WorkflowInstanceView,
  WorkflowRoundState,
  WorkflowTaskView,
} from './types';

import { RequestService } from '@levin/admin-framework';
import { requestClient } from '@levin/admin-framework/framework-commons/runtime';

/**
 * 流程执行组件的默认服务端连接器。
 * 宿主可传入自己的实现替换它；当前用户由后端会话确定，前端不提交用户身份。
 * 控制器：com.levin.oak.base.controller.BizWorkflowRuntimeController。
 */
export class WorkflowRuntimeService extends RequestService {
  constructor(basePath = '/com.levin.oak.base/V1/api') {
    super(basePath);
  }

  /** 实例附件列表重新授权，只返回已随成功动作绑定的元数据。 */
  async attachments(instanceId: string) {
    return this.get<WorkflowAttachmentMeta[]>(
      'workflow-runtime/attachment/list',
      { params: { instanceId } },
    );
  }

  async complete(data: WorkflowCompleteRequest) {
    return this.post<WorkflowTaskView>('workflow-runtime/complete', { data });
  }

  async deletePendingAttachment(taskId: string, id: string) {
    return this.post<unknown>('workflow-runtime/attachment/deletePending', {
      data: { taskId, id },
    });
  }

  async done() {
    return this.get<WorkflowTaskView[]>('workflow-runtime/done');
  }

  /** 下载响应为私有字节 Blob，不能拼接 FileRes 或公开静态路径。 */
  async downloadAttachment(id: string) {
    const result = await this.get<Blob>(
      'workflow-runtime/attachment/download',
      {
        params: { id },
        responseType: 'blob',
      },
    );
    // 当前后端拒绝可能以 JSON 业务错误体返回 HTTP 200；不得把该响应当文件下载。
    if (!(result instanceof Blob) || result.type.includes('json')) {
      throw new Error('私有附件下载未授权或响应格式无效');
    }
    return result;
  }

  /** 资格只是当前快照；真正发起时服务端再次检查权限、依赖及活动实例互斥。 */
  async eligibility(reference: WorkflowBusinessReference) {
    return this.get<WorkflowEligibility[]>(
      'workflow-runtime/business/eligibility',
      { params: reference },
    );
  }

  async history(reference: WorkflowBusinessReference) {
    return this.get<WorkflowInstanceView[]>(
      'workflow-runtime/business/history',
      { params: reference },
    );
  }

  /** 同轮显式换轮；后端以当前真实修订和无活动实例作为最终并发门禁。 */
  async newRound(
    data: WorkflowBusinessReference & {
      contractVersion: string;
      expectedRevision: string;
      expectedRoundId: string;
      idempotencyKey: string;
    },
  ) {
    return this.post<string>('workflow-runtime/business/newRound', { data });
  }

  /** 仅恢复当前用户该待办尚未绑定的私有附件，不从浏览器本地缓存推断。 */
  async pendingAttachments(taskId: string) {
    return this.get<WorkflowAttachmentMeta[]>(
      'workflow-runtime/attachment/pending',
      { params: { taskId } },
    );
  }

  async prepareStepUpAuth(
    data: Partial<WorkflowCompleteRequest> & {
      actionCode: string;
      taskId: string;
      verificationType: string;
    },
  ) {
    return this.post<{
      interactionData?: unknown;
      message?: string;
      successful: boolean;
      verificationType: string;
    }>('workflow-runtime/step-up-auth/prepare', { data });
  }

  /** 仅重提当前轮次最新且已应用的失败终态，服务端重新匹配当前发布定义。 */
  async resubmit(
    data: WorkflowBusinessReference & {
      contractVersion: string;
      expectedRevision: string;
      expectedRoundId: string;
      idempotencyKey: string;
      purposeKey: string;
      sourceRunId: string;
    },
  ) {
    return this.post<WorkflowInstanceView>(
      'workflow-runtime/business/resubmit',
      {
        data,
      },
    );
  }

  /** 宿主和服务端均须校验重试权限，只恢复原交付，不重新创建流程。 */
  async retry(
    data: WorkflowBusinessReference & { dispatchId: string },
  ): Promise<void> {
    await this.post<unknown>('workflow-runtime/business/retry', { data });
  }

  /** 只读读取当前业务对象真实修订和办理轮次，不触发新建或换轮。 */
  async roundState(
    data: WorkflowBusinessReference & { contractVersion: string },
  ) {
    return this.get<WorkflowRoundState>(
      'workflow-runtime/business/roundState',
      {
        params: data,
      },
    );
  }

  /** 作用域只作显式选择条件；身份、真实归属、轮次与流程版本由服务端核验。 */
  async start(
    data: WorkflowBusinessReference & {
      idempotencyKey: string;
      purposeKey: string;
    },
  ) {
    return this.post<WorkflowInstanceView>('workflow-runtime/business/start', {
      data,
    });
  }

  async started() {
    return this.get<WorkflowInstanceView[]>('workflow-runtime/started');
  }

  async todo() {
    return this.get<WorkflowTaskView[]>('workflow-runtime/todo');
  }

  /** 上传只提交当前任务与文件，后端返回私有 ID 而不是公开 URL。 */
  async uploadAttachment(taskId: string, file: File) {
    const upload = requestClient.upload;
    if (!upload) throw new Error('当前宿主不支持私有附件上传。');
    return upload<WorkflowAttachmentMeta>(
      this.buildRequestPath('workflow-runtime/attachment/upload'),
      { taskId, file },
      { baseURL: '' },
    );
  }
}
