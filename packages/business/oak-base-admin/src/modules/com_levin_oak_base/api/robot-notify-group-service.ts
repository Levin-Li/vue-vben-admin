import type { SupportPage } from './support-workbench-types';

import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { toGenericSupportRequestScope } from './support-request-scope';

export type RobotNotifyPlatform =
  | 'DingTalkWebhook'
  | 'FeishuWebhook'
  | 'WeComWebhook';

export interface RobotNotifyGroupInput {
  bizType: string;
  description?: string;
  enable?: boolean;
  name: string;
  orgId?: string;
  orgShared?: boolean;
  platformType?: RobotNotifyPlatform;
  tenantId?: string;
  webhookUrl?: string;
}

export interface RobotNotifyGroupRecord extends RobotNotifyGroupInput {
  editable?: boolean;
  id: string;
  optimisticLock: number;
}

export interface RobotNotifyGroupQuery {
  bizType?: string;
  enable?: boolean;
  inPlatformType?: RobotNotifyPlatform[];
  name?: string;
  orgId?: string;
  pageIndex: number;
  pageSize: number;
  tenantId?: string;
}

@Service({
  basePath: '/RobotNotifyGroup',
  controllerClass:
    'com.levin.oak.base.controller.BizRobotNotifyGroupController',
  description: '飞书、企业微信和钉钉群机器人配置',
  title: '机器人通知群',
  type: '业务数据-机器人通知群',
})
export class RobotNotifyGroupService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-机器人通知群',
    action: '清除缓存',
  })
  async clearCache(params?: {
    cacheKey?: string;
    keySuffix?: string;
  }): Promise<boolean> {
    return this.get('clearCache', { params });
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-机器人通知群',
    action: '新增',
  })
  async create(data: RobotNotifyGroupInput): Promise<string> {
    return this.post('create', { data: toGenericSupportRequestScope(data) });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-机器人通知群',
    action: '删除',
  })
  async delete(params: {
    id: string;
    orgId?: string;
    tenantId?: string;
  }): Promise<void> {
    return this.deleteRequest('delete', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.RobotNotifyGroup',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-机器人通知群',
    action: '查询列表',
  })
  async list(
    params: RobotNotifyGroupQuery,
  ): Promise<SupportPage<RobotNotifyGroupRecord>> {
    return this.get('list', { params: toGenericSupportRequestScope(params) });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-机器人通知群',
    action: '查看详情',
  })
  async retrieve(params: {
    id: string;
    orgId?: string;
    tenantId?: string;
  }): Promise<RobotNotifyGroupRecord> {
    return this.get('retrieve', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-机器人通知群',
    action: '统计',
  })
  async stat(params: RobotNotifyGroupQuery): Promise<{ totals: number }> {
    return this.get('stat', { params: toGenericSupportRequestScope(params) });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-机器人通知群',
    action: '更新',
  })
  async update(
    data: Partial<RobotNotifyGroupInput> & {
      id: string;
      optimisticLock: number;
    },
  ): Promise<void> {
    return this.put('update', {
      autoForceUpdateField: false,
      data: toGenericSupportRequestScope(data),
    });
  }
}

export const robotNotifyGroupService = new RobotNotifyGroupService();
