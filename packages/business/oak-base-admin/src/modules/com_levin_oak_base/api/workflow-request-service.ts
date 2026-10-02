import type { WorkflowPage } from './workflow-definition-service';

import { useUserStore } from '@vben/runtime/stores';

import {
  CRUD,
  rbacService,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export interface WorkflowRequestRecord {
  amount: number | string;
  category: string;
  documentsComplete: boolean;
  id: string;
  optimisticLock?: number;
  resultSummary?: string;
  title: string;
}

/** 仅表达用户明确选择的范围意图，服务端仍按当前主体重新授权。 */
export interface WorkflowRequestScope {
  orgId: string;
  tenantId: string;
}

export interface WorkflowRequestActor {
  isPlatformAdmin?: boolean;
  isPlatformUser?: boolean;
  isSuperAdmin?: boolean;
  platformAdmin?: boolean;
  platformUser?: boolean;
  superAdmin?: boolean;
  tenantId?: null | string;
}

/** 生成请求的租户字段受注入保护；同租户普通主体应省略，跨租户引用必须拒绝而不是丢弃。 */
export function prepareWorkflowRequestScope(
  scope: Partial<WorkflowRequestScope>,
  actor: WorkflowRequestActor,
): Partial<WorkflowRequestScope> {
  const tenantId = scope.tenantId?.trim();
  if (!tenantId) return scope.orgId ? { orgId: scope.orgId } : {};
  if (
    actor.platformUser === true ||
    actor.isPlatformUser === true ||
    actor.isSuperAdmin === true ||
    actor.superAdmin === true ||
    actor.platformAdmin === true ||
    actor.isPlatformAdmin === true
  ) {
    return { tenantId, ...(scope.orgId ? { orgId: scope.orgId } : {}) };
  }
  if (!actor.tenantId || actor.tenantId !== tenantId) {
    throw new Error('流程业务申请：业务引用不属于当前会话租户，已阻止请求。');
  }
  return scope.orgId ? { orgId: scope.orgId } : {};
}

export type WorkflowRequestInput = Pick<
  WorkflowRequestRecord,
  'amount' | 'category' | 'documentsComplete' | 'title'
>;

/** 无业务状态字段的样例，仅允许提交明确公开的业务字段。 */
@Service({
  basePath: '/WorkflowRequest',
  controllerClass: 'com.levin.oak.base.controller.BizWorkflowRequestController',
  title: '流程业务申请',
  type: '业务数据-流程业务申请',
})
export class WorkflowRequestService extends RequestService {
  constructor(
    private readonly selectedScope?: () => undefined | WorkflowRequestScope,
    private readonly currentActor: () => WorkflowRequestActor = () =>
      (useUserStore().userInfo ?? {}) as WorkflowRequestActor,
  ) {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-流程业务申请',
    action: '创建流程业务申请',
  })
  create(data: WorkflowRequestInput) {
    return this.post<string>('create', {
      data: { ...toWorkflowRequestInput(data), ...this.requestScope() },
    });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.WorkflowRequest',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-流程业务申请',
    action: '查询流程业务申请',
  })
  list(params: { pageIndex?: number; pageSize?: number } = {}) {
    const { tenantId, orgId, ...query } =
      params as Partial<WorkflowRequestScope> & typeof params;
    return this.get<WorkflowPage<WorkflowRequestRecord>>('list', {
      params: { ...query, ...this.requestScope({ tenantId, orgId }) },
    });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-流程业务申请',
    action: '查看流程业务申请',
  })
  retrieve(params: Partial<WorkflowRequestScope> & { id: string }) {
    return this.get<WorkflowRequestRecord>('retrieve', {
      params: { id: params.id, ...this.requestScope(params) },
    });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-流程业务申请',
    action: '保存流程业务申请',
  })
  update(data: WorkflowRequestInput & { id: string; optimisticLock?: number }) {
    return this.put('update', {
      data: {
        ...toWorkflowRequestInput(data),
        id: data.id,
        optimisticLock: data.optimisticLock,
        ...this.requestScope(),
      },
      autoForceUpdateField: false,
    });
  }

  private requestScope(reference: Partial<WorkflowRequestScope> = {}) {
    const selected = this.selectedScope?.();
    if (
      selected &&
      reference.tenantId &&
      selected.tenantId !== reference.tenantId
    ) {
      throw new Error(
        '流程业务申请：页面选择与业务引用租户不一致，已阻止请求。',
      );
    }
    if (selected && reference.orgId && selected.orgId !== reference.orgId) {
      throw new Error(
        '流程业务申请：页面选择与业务引用组织不一致，已阻止请求。',
      );
    }
    const scope = { ...reference, ...selected };
    return prepareWorkflowRequestScope(
      scope,
      scope.tenantId ? this.currentActor() : {},
    );
  }
}

/** 当前登录用户的授权组织树，节点携带租户归属供本页显式选择。 */
export function loadWorkflowRequestOrgTree() {
  return rbacService.fetchAuthorizedOrgTree({ assembleTree: true });
}

/** 归属、流程结果及页面残留字段不能进入新增或更新载荷。 */
export function toWorkflowRequestInput(
  data: WorkflowRequestInput,
): WorkflowRequestInput {
  return {
    title: data.title,
    amount: data.amount,
    category: data.category,
    documentsComplete: data.documentsComplete,
  };
}

export const workflowRequestService = new WorkflowRequestService();
