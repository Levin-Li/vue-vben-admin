import type { WorkflowBusinessType } from '@levin/bpm-designer';
import type { WorkflowBusinessReference } from '@levin/bpm-runtime-ui';

import type { WorkflowRequestActor } from './workflow-request-service';

import { useUserStore } from '@vben/runtime/stores';

import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { WorkflowRuntimeService } from '@levin/bpm-runtime-ui';

import { prepareWorkflowRequestScope } from './workflow-request-service';

/** 公共连接器维护地址，宿主按实际控制器声明登记页面操作与权限。 */
@Service({
  controllerClass: 'com.levin.oak.base.controller.BizWorkflowRuntimeController',
  title: '工作流运行时',
  type: '业务数据-工作流运行时',
})
export class OakWorkflowRuntimeService extends WorkflowRuntimeService {
  constructor(
    basePath?: string,
    private readonly currentActor: () => WorkflowRequestActor = () =>
      (useUserStore().userInfo ?? {}) as WorkflowRequestActor,
  ) {
    super(basePath);
  }

  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '查询流程业务能力目录',
  })
  catalog() {
    return this.get<WorkflowBusinessType[]>('workflow-runtime/business-types');
  }

  @CRUD.Op({ label: '办理' })
  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '完成工作流待办',
  })
  override complete(...args: Parameters<WorkflowRuntimeService['complete']>) {
    return super.complete(...args);
  }

  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '查询我的工作流已办',
  })
  override done() {
    return super.done();
  }

  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '查询业务流程资格',
  })
  override eligibility(
    ...args: Parameters<WorkflowRuntimeService['eligibility']>
  ) {
    return super.eligibility(this.businessScope(args[0]));
  }

  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '查询业务流程历史',
  })
  override history(...args: Parameters<WorkflowRuntimeService['history']>) {
    return super.history(this.businessScope(args[0]));
  }

  @CRUD.Op({ label: '开启新办理轮次' })
  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '开启业务流程新轮次',
  })
  override newRound(...args: Parameters<WorkflowRuntimeService['newRound']>) {
    return super.newRound(this.businessScope(args[0]));
  }

  @CRUD.Op({ label: '二次验证' })
  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '签发工作流节点二次验证挑战',
  })
  override prepareStepUpAuth(
    ...args: Parameters<WorkflowRuntimeService['prepareStepUpAuth']>
  ) {
    return super.prepareStepUpAuth(...args);
  }

  @CRUD.Op({ label: '重新提交流程' })
  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '重提已结束业务流程',
  })
  override resubmit(...args: Parameters<WorkflowRuntimeService['resubmit']>) {
    return super.resubmit(this.businessScope(args[0]));
  }

  @CRUD.Op({ label: '重试业务处理' })
  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '重试业务流程交付',
  })
  override retry(...args: Parameters<WorkflowRuntimeService['retry']>) {
    return super.retry(this.businessScope(args[0]));
  }

  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '查询业务办理轮次状态',
  })
  override roundState(
    ...args: Parameters<WorkflowRuntimeService['roundState']>
  ) {
    return super.roundState(this.businessScope(args[0]));
  }

  @CRUD.Op({ label: '发起流程' })
  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '发起业务流程',
  })
  override start(...args: Parameters<WorkflowRuntimeService['start']>) {
    return super.start(this.businessScope(args[0]));
  }

  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '查询我发起的工作流',
  })
  override started() {
    return super.started();
  }

  @ResAuthorize({
    domain: 'WorkflowRuntime',
    type: '业务数据-工作流运行时',
    action: '查询我的工作流待办',
  })
  override todo() {
    return super.todo();
  }

  private businessScope<T extends WorkflowBusinessReference>(input: T) {
    // 先移除原范围再合并授权后的范围，避免普通租户tenantId被原命令重新带回。
    // 其余完整命令保持不变，尤其来源、修订、轮次与幂等键不得在技术重放时丢失。
    const { tenantId, orgId, ...command } = input;
    const scope = prepareWorkflowRequestScope(
      { tenantId, orgId },
      tenantId ? this.currentActor() : {},
    );
    return { ...command, ...scope };
  }
}

export const workflowRuntimeService = new OakWorkflowRuntimeService();
