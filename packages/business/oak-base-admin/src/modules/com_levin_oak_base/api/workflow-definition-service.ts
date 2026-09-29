import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export interface WorkflowDefinitionRecord {
  businessType: string;
  id: string;
  name: string;
  processKey: string;
}

export interface WorkflowPage<T> {
  items: T[];
  totals?: number;
}

/** 稳定定义维护入口，流程设计正文由版本服务保存。 */
@Service({
  basePath: '/WorkflowDefinition',
  controllerClass:
    'com.levin.oak.base.controller.BizWorkflowDefinitionController',
  title: '工作流定义',
  type: '平台数据-工作流定义',
})
export class WorkflowDefinitionService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义',
    action: '新增',
  })
  create(data: Omit<WorkflowDefinitionRecord, 'id'>) {
    // 用途只属于版本设计，稳定定义请求不发送用途或页面残留字段。
    return this.post<string>('create', {
      data: {
        name: data.name,
        processKey: data.processKey,
        businessType: data.businessType,
      },
    });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.WorkflowDefinition',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义',
    action: '查询列表',
  })
  list(params: { pageIndex?: number; pageSize?: number } = {}) {
    return this.get<WorkflowPage<WorkflowDefinitionRecord>>('list', { params });
  }
}

export const workflowDefinitionService = new WorkflowDefinitionService();
