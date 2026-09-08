import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/AuditReport',
  controllerClass: 'com.levin.oak.base.controller.BizAuditReportController',
  description: '查询和查看审计服务生成的报告。',
  title: '审计报告',
  type: '平台数据-审计报告',
})
export class AuditReportService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.AuditReport',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-审计报告',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-审计报告',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }
}

export const auditReportService = new AuditReportService();
