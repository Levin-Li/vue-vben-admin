import type {
  WorkflowRequestActor,
  WorkflowRequestScope,
} from './workflow-request-service';

import { useUserStore } from '@vben/runtime/stores';

import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { prepareWorkflowRequestScope } from './workflow-request-service';

/** 报销详情只消费公开业务字段，核定内容只能经受控节点动作写入。 */
export interface WorkflowExpenseRecord {
  claimedAmount: number | string;
  id: string;
  receiptsReady: boolean;
  resultSummary?: string;
  reviewNote?: string;
  subject: string;
  verifiedAmount?: null | number | string;
}

/** 现有工作台的只读详情入口，不增加普通CRUD写入或付款能力。 */
@Service({
  basePath: '/WorkflowExpense',
  controllerClass: 'com.levin.oak.base.controller.BizWorkflowExpenseController',
  title: '流程报销核对',
  type: '业务数据-流程报销核对',
})
export class WorkflowExpenseService extends RequestService {
  constructor(
    private readonly currentActor: () => WorkflowRequestActor = () =>
      (useUserStore().userInfo ?? {}) as WorkflowRequestActor,
  ) {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-流程报销核对',
    action: '查看流程报销核对',
  })
  retrieve(params: Partial<WorkflowRequestScope> & { id: string }) {
    // 复用同租户省略受保护字段规则；外租户引用拒绝，不能静默去掉冲突归属。
    const scope = prepareWorkflowRequestScope(
      { tenantId: params.tenantId, orgId: params.orgId },
      params.tenantId ? this.currentActor() : {},
    );
    return this.get<WorkflowExpenseRecord>('retrieve', {
      params: { id: params.id, ...scope },
    });
  }
}

export const workflowExpenseService = new WorkflowExpenseService();
