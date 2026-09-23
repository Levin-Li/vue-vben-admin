import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Inbox',
  controllerClass: 'com.levin.oak.base.controller.BizInboxController',
  description: '入站邮件收件箱',
  title: '收件箱',
  type: '系统数据-收件箱',
})
export class InboxService extends RequestService {
  constructor() { super(OAK_BASE_API_MODULE); }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-收件箱', action: '查询列表' })
  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.Inbox' })
  async list(params?: any, options?: any) { return this.get('list', { ...options, params }); }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-收件箱', action: '查看详情' })
  @CRUD.Op({ confirmText: 'None' })
  async retrieve(params?: any, options?: any) { return this.get('retrieve', { ...options, params }); }
}

export const inboxService = new InboxService();
