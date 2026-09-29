import type {
  WorkflowBusinessReference,
  WorkflowCompleteRequest,
  WorkflowEligibility,
  WorkflowInstanceView,
  WorkflowRoundState,
  WorkflowTaskView,
} from './types';

import { RequestService } from '@levin/admin-framework';

/**
 * 流程执行组件的默认服务端连接器。
 * 宿主可传入自己的实现替换它；当前用户由后端会话确定，前端不提交用户身份。
 * 控制器：com.levin.oak.base.controller.BizWorkflowRuntimeController。
 */
export class WorkflowRuntimeService extends RequestService {
  constructor(basePath = '/com.levin.oak.base/V1/api') {
    super(basePath);
  }

  async complete(data: WorkflowCompleteRequest) {
    return this.post<WorkflowTaskView>('workflow-runtime/complete', { data });
  }

  async done() {
    return this.get<WorkflowTaskView[]>('workflow-runtime/done');
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
}
