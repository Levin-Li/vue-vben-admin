import type {
  AuditDetail,
  AuditRecord,
  AuditReview,
  SupportPage,
} from './support-workbench-types';

import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

/** 只绑定独立业务控制器，不使用私有实体的默认 CRUD。 */
@Service({
  basePath: '/NotificationAudit',
  controllerClass:
    'com.levin.oak.base.controller.BizNotificationAuditController',
  title: '通知投递',
  type: '业务数据-通知投递',
})
export class NotificationAuditService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '查看通知投递审计' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知投递',
    action: '查看通知投递审计',
  })
  async list(params: {
    orgId?: string;
    pageIndex: number;
    pageSize: number;
    status?: string;
    tenantId?: string;
  }): Promise<SupportPage<AuditRecord>> {
    return this.get('list', { params });
  }

  @CRUD.Op({ label: '核验通知未受理' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知投递',
    action: '核验通知未受理',
  })
  async resolveUnsent(data: AuditReview): Promise<AuditRecord> {
    return this.post('resolveUnsent', { data });
  }

  @CRUD.Op({ label: '查看通知投递审计' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知投递',
    action: '查看通知投递审计',
  })
  async retrieve(params: {
    id: string;
    tenantId?: string;
  }): Promise<AuditDetail> {
    return this.get('retrieve', { params });
  }

  @CRUD.Op({ label: '重试通知投递' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-通知投递',
    action: '重试通知投递',
  })
  async retry(data: AuditReview): Promise<AuditRecord> {
    return this.post('retry', { data });
  }
}
export const notificationAuditService = new NotificationAuditService();
