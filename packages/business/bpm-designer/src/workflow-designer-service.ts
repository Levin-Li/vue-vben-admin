import type {
  WorkflowBusinessType,
  WorkflowDefinitionVersion,
  WorkflowDesignerDefinition,
} from './types';

import { RequestService } from '@levin/admin-framework';

/**
 * 默认设计期 API 连接器。所有生命周期判断仍在服务端完成，UI 仅按当前版本
 * 状态显示入口；宿主可替换此服务以接入额外的表单字段或候选目录来源。
 */
export class WorkflowDesignerService extends RequestService {
  constructor(basePath = '/com.levin.oak.base/V1/api') {
    super(basePath);
  }

  /** 目录只包含当前主体可用的业务能力，不读取任何真实业务记录。 */
  async listBusinessTypes() {
    return this.get<WorkflowBusinessType[]>('workflow-runtime/business-types');
  }

  async publishAfterSimulation(id: string) {
    return this.post<WorkflowDefinitionVersion>(
      'WorkflowDefinitionVersion/publish-after-simulation',
      { data: { id } },
    );
  }

  async saveDraft(
    id: string,
    lowflowDefinition: WorkflowDesignerDefinition,
    optimisticLock?: number,
  ) {
    return this.post<WorkflowDefinitionVersion>(
      'WorkflowDefinitionVersion/save-design',
      { data: { id, optimisticLock, lowflowDefinition } },
    );
  }

  async startSimulation(id: string) {
    return this.post<WorkflowDefinitionVersion>(
      'WorkflowDefinitionVersion/start-simulation',
      { data: { id } },
    );
  }
}
