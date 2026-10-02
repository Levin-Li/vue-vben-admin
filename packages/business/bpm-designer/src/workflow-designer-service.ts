import type {
  WorkflowBusinessType,
  WorkflowDefinitionVersion,
  WorkflowSimulationHistory,
  WorkflowSimulationHistoryPage,
} from './types';
import type { WorkflowTreeVersion } from './workflow-tree-version';

import { RequestService } from '@levin/admin-framework';

import { projectDraftV3ToV2 } from './workflow-tree-version';

/**
 * 默认设计期 API 连接器。所有生命周期判断仍在服务端完成，UI 仅按当前版本
 * 状态显示入口；宿主可替换此服务以接入额外的表单字段或候选目录来源。
 */
export class WorkflowDesignerService extends RequestService {
  constructor(basePath = '/com.levin.oak.base/V1/api') {
    super(basePath);
  }

  async deleteSimulationRun(versionId: string, runId: string) {
    return this.post<unknown>(
      'WorkflowDefinitionVersion/delete-simulation-run',
      {
        data: { versionId, runId },
      },
    );
  }

  /** 目录只包含当前主体可用的业务能力，不读取任何真实业务记录。 */
  async listBusinessTypes(tenantId?: string) {
    return tenantId
      ? this.get<WorkflowBusinessType[]>('workflow-runtime/business-types', {
          params: { tenantId },
        })
      : this.get<WorkflowBusinessType[]>('workflow-runtime/business-types');
  }

  async publishAfterSimulation(id: string) {
    return this.post<WorkflowDefinitionVersion>(
      'WorkflowDefinitionVersion/publish-after-simulation',
      { data: { id } },
    );
  }

  async saveDraft(
    id: string,
    lowflowDefinition: WorkflowTreeVersion,
    optimisticLock?: number,
  ) {
    // 客户端只发送树，真实持久化与执行投影仍由服务端重新校验。
    if (lowflowDefinition.schemaVersion !== 3)
      throw new Error('只接受 schemaVersion=3 的流程定义');
    projectDraftV3ToV2(lowflowDefinition);
    return this.post<WorkflowDefinitionVersion>(
      'WorkflowDefinitionVersion/save-design',
      { data: { id, optimisticLock, lowflowDefinition } },
    );
  }

  async simulationRun(versionId: string, runId: string) {
    return this.get<WorkflowSimulationHistory>(
      'WorkflowDefinitionVersion/simulation-run',
      { params: { versionId, runId } },
    );
  }

  async simulationRuns(versionId: string, pageIndex = 1, pageSize = 10) {
    return this.get<WorkflowSimulationHistoryPage>(
      'WorkflowDefinitionVersion/simulation-runs',
      { params: { versionId, pageIndex, pageSize } },
    );
  }

  async startSimulation(id: string) {
    return this.post<WorkflowDefinitionVersion>(
      'WorkflowDefinitionVersion/start-simulation',
      { data: { id } },
    );
  }
}
