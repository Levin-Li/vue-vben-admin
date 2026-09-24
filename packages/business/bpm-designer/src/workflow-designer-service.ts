import { RequestService } from '@levin/admin-framework';

import type { WorkflowDefinitionVersion } from './types';

/**
 * 默认设计期 API 连接器。所有生命周期判断仍在服务端完成，UI 仅按当前版本
 * 状态显示入口；宿主可替换此服务以接入额外的表单字段或候选目录来源。
 */
export class WorkflowDesignerService extends RequestService {
  constructor(basePath = '/com.levin.oak.base/V1/api') {
    super(basePath);
  }

  async publishAfterSimulation(id: string) {
    return this.post<WorkflowDefinitionVersion>('workflowdefinitionversion/publish-after-simulation', { data: { id } });
  }

  async saveDraft(id: string, lowflowJson: string) {
    return this.post<WorkflowDefinitionVersion>('workflowdefinitionversion/update', { data: { id, lowflowJson } });
  }

  async startSimulation(id: string) {
    return this.post<WorkflowDefinitionVersion>('workflowdefinitionversion/start-simulation', { data: { id } });
  }
}
