import type {
  WorkflowDefinitionVersion,
  WorkflowTreeVersion,
} from '@levin/bpm-designer';

import type { WorkflowPage } from './workflow-definition-service';

import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { WorkflowDesignerService } from '@levin/bpm-designer';

export type ManagedWorkflowVersion = WorkflowDefinitionVersion & {
  supportEventsByCurrentStatus?: string[];
};

/** 版本列表与草稿创建归属业务 API；保存、模拟和发布复用设计器的公开连接器。 */
@Service({
  controllerClass:
    'com.levin.oak.base.controller.BizWorkflowDefinitionVersionController',
  title: '工作流定义版本',
  type: '平台数据-工作流定义版本',
})
export class WorkflowDefinitionVersionService extends WorkflowDesignerService {
  @CRUD.Op({ label: '归档', visibleOn: "lifecycle == 'Retired'" })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '归档流程版本',
  })
  archive(params: { id: string; optimisticLock?: number }) {
    return this.post<ManagedWorkflowVersion>(
      'WorkflowDefinitionVersion/archive',
      { params },
    );
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '新增',
  })
  create(data: {
    lowflowDefinition?: WorkflowTreeVersion;
    versionNo: number;
    workflowDefinitionId: string;
  }) {
    return this.post<string>('WorkflowDefinitionVersion/create', { data });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '删除模拟报告',
  })
  override deleteSimulationRun(
    ...args: Parameters<WorkflowDesignerService['deleteSimulationRun']>
  ) {
    return super.deleteSimulationRun(...args);
  }

  @CRUD.Op({ label: '完成下线', visibleOn: "lifecycle == 'Retiring'" })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '完成流程版本下线',
  })
  finishRetire(params: { id: string; optimisticLock?: number }) {
    return this.post<ManagedWorkflowVersion>(
      'WorkflowDefinitionVersion/finish-retire',
      { params },
    );
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.WorkflowDefinitionVersion',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '查询列表',
  })
  list(params: {
    lifecycle?: string;
    pageIndex?: number;
    pageSize?: number;
    workflowDefinitionId?: string;
  }) {
    return this.get<WorkflowPage<ManagedWorkflowVersion>>(
      'WorkflowDefinitionVersion/list',
      { params },
    );
  }

  @CRUD.Op({ label: '发布' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '发布流程版本',
  })
  override publishAfterSimulation(
    ...args: Parameters<WorkflowDesignerService['publishAfterSimulation']>
  ) {
    return super.publishAfterSimulation(...args);
  }

  @CRUD.Op({ label: '恢复上线', visibleOn: "lifecycle == 'Retiring'" })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '恢复流程版本上线',
  })
  restore(params: { id: string; optimisticLock?: number }) {
    return this.post<ManagedWorkflowVersion>(
      'WorkflowDefinitionVersion/restore',
      { params },
    );
  }
  @CRUD.Op({ label: '开始下线', visibleOn: "lifecycle == 'Published'" })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '开始下线流程版本',
  })
  retire(params: { id: string; optimisticLock?: number }) {
    return this.post<ManagedWorkflowVersion>(
      'WorkflowDefinitionVersion/retire',
      { params },
    );
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '查看流程设计版本',
  })
  retrieve(params: { id: string }) {
    // 列表仅用于版本选择，完整设计视图附带本版本的真实模拟报告。
    return this.get<ManagedWorkflowVersion>(
      'WorkflowDefinitionVersion/retrieve',
      { params },
    );
  }

  @CRUD.Op({ label: '保存草稿' })
  // 公共连接器负责完整版本路径，宿主只补页面操作的控制器权限元数据。
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '保存流程设计',
  })
  override saveDraft(
    ...args: Parameters<WorkflowDesignerService['saveDraft']>
  ) {
    return super.saveDraft(...args);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '查看模拟报告',
  })
  override simulationRun(
    ...args: Parameters<WorkflowDesignerService['simulationRun']>
  ) {
    return super.simulationRun(...args);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '查看模拟历史',
  })
  override simulationRuns(
    ...args: Parameters<WorkflowDesignerService['simulationRuns']>
  ) {
    return super.simulationRuns(...args);
  }

  @CRUD.Op({ label: '开始模拟测试' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义版本',
    action: '开始流程版本模拟测试',
  })
  override startSimulation(
    ...args: Parameters<WorkflowDesignerService['startSimulation']>
  ) {
    return super.startSimulation(...args);
  }
}

export const workflowDefinitionVersionService =
  new WorkflowDefinitionVersionService();
