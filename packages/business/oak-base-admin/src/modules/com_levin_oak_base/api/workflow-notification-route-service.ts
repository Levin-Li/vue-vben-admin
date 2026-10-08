import type { SupportPage } from './support-workbench-types';

import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { toGenericSupportRequestScope } from './support-request-scope';

export type NotificationChannel =
  | 'DingTalkWebhook'
  | 'Email'
  | 'FeishuWebhook'
  | 'Station'
  | 'WeComWebhook';
export type WorkflowNotificationEventName =
  | 'TaskCreated'
  | 'TaskDeadline'
  | 'TaskProcessed'
  | 'TaskReminder';
export interface WorkflowNotificationRouteInput {
  channel: NotificationChannel;
  enable: boolean;
  eventName: WorkflowNotificationEventName;
  forceOverride: boolean;
  matchCondition?: Record<
    string,
    (boolean | number | string)[] | boolean | number | string
  >;
  nodeKey?: string;
  orgId?: string;
  priority: number;
  processKey?: string;
  remark?: string;
  targetConfig: { configRef?: string };
  tenantId?: string;
  workflowDefinitionVersionId?: string;
}
export interface WorkflowNotificationRouteRecord extends WorkflowNotificationRouteInput {
  editable?: boolean;
  id: string;
  optimisticLock: number;
}

/** 只序列化当前路由合同；邮件/站内精确受众来自引擎，不开放外部邮箱或秘密字段。 */
export function toWorkflowNotificationRouteInput(
  data: WorkflowNotificationRouteInput,
): WorkflowNotificationRouteInput {
  const {
    tenantId,
    orgId,
    processKey,
    workflowDefinitionVersionId,
    nodeKey,
    eventName,
    channel,
    priority,
    forceOverride,
    enable,
    remark,
    matchCondition,
  } = data;
  const robot = ['DingTalkWebhook', 'FeishuWebhook', 'WeComWebhook'].includes(
    channel,
  );
  return {
    tenantId,
    orgId,
    processKey,
    workflowDefinitionVersionId,
    nodeKey,
    eventName,
    channel,
    priority,
    forceOverride,
    enable,
    remark,
    matchCondition,
    targetConfig: robot ? { configRef: data.targetConfig.configRef } : {},
  };
}
@Service({
  basePath: '/WorkflowNotificationRoute',
  controllerClass:
    'com.levin.oak.base.controller.BizWorkflowNotificationRouteController',
  title: '工作流通知路由',
  type: '业务数据-工作流通知路由',
})
export class WorkflowNotificationRouteService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }
  @CRUD.Op({ label: '新增', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工作流通知路由',
    action: '新增',
  })
  async create(data: WorkflowNotificationRouteInput): Promise<string> {
    return this.post('create', {
      data: { ...toWorkflowNotificationRouteInput(data), editable: true },
    });
  }
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.WorkflowNotificationRoute',
  })
  @CRUD.Op({ label: '查询列表' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工作流通知路由',
    action: '查询列表',
  })
  async list(params: {
    channel?: NotificationChannel;
    eventName?: WorkflowNotificationEventName;
    orgId?: string;
    pageIndex: number;
    pageSize: number;
    tenantId?: string;
  }): Promise<SupportPage<WorkflowNotificationRouteRecord>> {
    return this.get('list', { params: toGenericSupportRequestScope(params) });
  }
  @CRUD.Op({ label: '删除' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工作流通知路由',
    action: '删除',
  })
  async remove(params: {
    id: string;
    orgId?: string;
    tenantId?: string;
  }): Promise<void> {
    return this.deleteRequest('delete', {
      params: toGenericSupportRequestScope(params),
    });
  }
  @CRUD.Op({ label: '查看详情' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工作流通知路由',
    action: '查看详情',
  })
  async retrieve(params: {
    id: string;
    orgId?: string;
    tenantId?: string;
  }): Promise<WorkflowNotificationRouteRecord> {
    return this.get('retrieve', {
      params: toGenericSupportRequestScope(params),
    });
  }
  @CRUD.Op({ label: '更新' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-工作流通知路由',
    action: '更新',
  })
  async update(data: WorkflowNotificationRouteRecord): Promise<void> {
    return this.put('update', {
      data: {
        ...toWorkflowNotificationRouteInput(data),
        id: data.id,
        optimisticLock: data.optimisticLock,
      },
      autoForceUpdateField: false,
    });
  }
}
export const workflowNotificationRouteService =
  new WorkflowNotificationRouteService();
