import type {
  WorkflowBusinessObject,
  WorkflowStateBinding,
  WorkflowStateOption,
} from '@levin/bpm-designer';

import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export interface WorkflowDefinitionRecord {
  bindingSnapshot?: WorkflowStateBinding;
  businessEntityKey?: string;
  businessType: string;
  genericBusinessContract?: { bindingSnapshot?: WorkflowStateBinding };
  id: string;
  name: string;
  processKey: string;
  stateField?: string;
  stateMapping?: string | WorkflowStateOption[];
  stateType?: WorkflowStateBinding['stateType'];
  tenantId?: string;
  tenantName?: string;
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

  /** 真实部署目录只包含当前主体可访问的对象及字段，不加载业务记录。 */
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义',
    action: '查询列表',
  })
  businessObjects() {
    return this.get<WorkflowBusinessObject[]>('businessObjects');
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义',
    action: '新增',
  })
  create(
    data: Pick<
      WorkflowDefinitionRecord,
      'businessType' | 'name' | 'processKey'
    >,
  ) {
    // 用途只属于版本设计，稳定定义请求不发送用途或页面残留字段。
    return this.post<string>('create', {
      data: {
        name: data.name,
        processKey: data.processKey,
        businessType: data.businessType,
      },
    });
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义',
    action: '新增',
  })
  createBound(data: {
    businessEntityKey: string;
    name: string;
    processKey: string;
    stateField: string;
    stateMapping: WorkflowStateOption[];
  }) {
    return this.post<WorkflowDefinitionRecord>('createBound', { data });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.WorkflowDefinition',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-工作流定义',
    action: '查询列表',
  })
  list(
    params: {
      businessEntityKey?: string;
      businessType?: string;
      containsName?: string;
      pageIndex?: number;
      pageSize?: number;
    } = {},
  ) {
    return this.get<WorkflowPage<WorkflowDefinitionRecord>>('list', { params });
  }
}

export const workflowDefinitionService = new WorkflowDefinitionService();
