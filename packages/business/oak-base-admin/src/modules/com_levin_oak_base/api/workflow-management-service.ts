import type {
  WorkflowInstanceView,
  WorkflowRuntimePage,
} from '@levin/bpm-runtime-ui';

import type { WorkflowRequestActor } from './workflow-request-service';

import { useUserStore } from '@vben/runtime/stores';

import { RequestService, ResAuthorize, Service } from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { prepareWorkflowRequestScope } from './workflow-request-service';

export interface WorkflowManagedInstance extends WorkflowInstanceView {
  definitionId?: string;
  definitionName?: string;
}

export interface WorkflowManagementQuery {
  cursor?: string;
  definitionId?: string;
  keyword?: string;
  orgId?: string;
  size?: number;
  status?: string;
  tenantId?: string;
}

/** 管理查询使用独立权限，不能借个人入口扩大实例读取范围。 */
@Service({
  basePath: '/workflow-management',
  controllerClass:
    'com.levin.oak.base.controller.BizWorkflowManagementController',
  title: '工作流实例管理',
  type: '业务数据-工作流实例管理',
})
export class WorkflowManagementService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'WorkflowManagement',
    type: '业务数据-工作流实例管理',
    action: '查看运行实例',
  })
  instance(params: { instanceId: string; orgId?: string; tenantId?: string }) {
    const { instanceId, tenantId, orgId } = params;
    return this.get<WorkflowManagedInstance>('instance', {
      params: {
        instanceId,
        ...prepareWorkflowRequestScope(
          { tenantId, orgId },
          (useUserStore().userInfo ?? {}) as WorkflowRequestActor,
        ),
      },
    });
  }

  @ResAuthorize({
    domain: 'WorkflowManagement',
    type: '业务数据-工作流实例管理',
    action: '查询运行实例',
  })
  instances(params: WorkflowManagementQuery) {
    const { tenantId, orgId, ...query } = params;
    return this.get<WorkflowRuntimePage<WorkflowManagedInstance>>('instances', {
      params: {
        ...query,
        ...prepareWorkflowRequestScope(
          { tenantId, orgId },
          (useUserStore().userInfo ?? {}) as WorkflowRequestActor,
        ),
      },
    });
  }
}

export const workflowManagementService = new WorkflowManagementService();
