import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Partner',
  controllerClass: 'com.levin.oak.base.controller.BizPartnerController',
  description: '合作伙伴管理',
  title: '合作伙伴',
  type: '业务数据-合作伙伴',
})
export class PartnerService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({
    label: '认证通过',
    visibleOn: "certificationStatus == 'AuditPending'",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-合作伙伴',
    action: '认证通过',
  })
  async approveCertification(data?: any, options?: any) {
    return this.post('approveCertification', { ...options, data });
  }

  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.Partner' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-合作伙伴',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({
    label: '认证拒绝',
    visibleOn: "certificationStatus == 'AuditPending'",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-合作伙伴',
    action: '认证拒绝',
  })
  async rejectCertification(data?: any, options?: any) {
    return this.post('rejectCertification', { ...options, data });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-合作伙伴',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @CRUD.Op({
    label: '撤销认证',
    visibleOn: "certificationStatus == 'Certified'",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-合作伙伴',
    action: '撤销认证',
  })
  async revokeCertification(data?: any, options?: any) {
    return this.post('revokeCertification', { ...options, data });
  }

  // 认证状态仅通过语义化事件接口迁移，不能写入普通资料更新。
  @CRUD.Op({
    label: '提交认证',
    visibleOn:
      "(certificationStatus == 'Draft' || certificationStatus == 'AuditRejected')",
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-合作伙伴',
    action: '提交认证',
  })
  async submitCertification(data?: any, options?: any) {
    return this.post('submitCertification', { ...options, data });
  }
}

export const partnerService = new PartnerService();
