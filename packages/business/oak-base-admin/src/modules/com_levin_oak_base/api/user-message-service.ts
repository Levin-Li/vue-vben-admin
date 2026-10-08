import type { WorkflowMessageActionTarget } from '@levin/admin-framework';

import {
  emitFrameworkEvent,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export interface MyMessageInfo {
  actionTarget?: null | WorkflowMessageActionTarget;
  createTime?: string;
  id: string;
  priority?: string;
  readTime?: null | string;
  sourceId?: string;
  sourceType?: string;
  summary?: string;
  title?: string;
}

export interface MyMessagePage {
  items: MyMessageInfo[];
  pageIndex: number;
  pageSize: number;
  totals: number;
}

export interface MyMessageQuery {
  pageIndex: number;
  pageSize: number;
  unreadOnly: boolean;
}

/** 个人消息只能从 /use 接口读取与标记；通用 UserMessage CRUD 不属于个人入口。 */
@Service({
  basePath: '/UserMessage/use',
  controllerClass: 'com.levin.oak.base.controller.MyMessageController',
  description: '当前登录用户的个人消息与未读状态',
  title: '我的消息',
  type: '通用数据-我的消息',
})
export class UserMessageService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '通用数据-我的消息',
    action: '查询我的消息',
    onlyRequireAuthenticated: true,
  })
  async list(params: MyMessageQuery): Promise<MyMessagePage> {
    return this.get('list', { params });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '通用数据-我的消息',
    action: '将我的消息标记已读',
    onlyRequireAuthenticated: true,
  })
  async markRead(data: { ids: string[] }): Promise<void> {
    await this.post('markRead', { data });
    // 成功后通知布局重新读取服务端计数，不在客户端猜测未读总量。
    emitFrameworkEvent('personal-message', 'read.changed', {});
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '通用数据-我的消息',
    action: '查看我的消息',
    onlyRequireAuthenticated: true,
  })
  async retrieve(id: string): Promise<MyMessageInfo> {
    return this.get('retrieve', { params: { id } });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '通用数据-我的消息',
    action: '查询我的未读消息数',
    onlyRequireAuthenticated: true,
  })
  async unreadCount(): Promise<number> {
    return this.get('unreadCount');
  }
}

export const userMessageService = new UserMessageService();
