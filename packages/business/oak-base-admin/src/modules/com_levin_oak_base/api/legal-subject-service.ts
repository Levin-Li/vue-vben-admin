import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/LegalSubject',
  controllerClass: 'com.levin.oak.base.controller.BizLegalSubjectController',
  description: '法律主体管理',
  title: '法律主体',
  type: '业务数据-法律主体',
})
export class LegalSubjectService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '认证通过' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '认证通过',
  })
  async approveCertification(data?: any, options?: any) {
    return this.post('approveCertification', { ...options, data });
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '新增',
  })
  async create(data?: any, options?: any) {
    return this.post('create', { ...options, data });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.LegalSubject',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ label: '认证拒绝' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '认证拒绝',
  })
  async rejectCertification(data?: any, options?: any) {
    return this.post('rejectCertification', { ...options, data });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @CRUD.Op({ label: '撤销认证' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '撤销认证',
  })
  async revokeCertification(data?: any, options?: any) {
    return this.post('revokeCertification', { ...options, data });
  }

  @CRUD.Op({ label: '提交认证' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '提交认证',
  })
  async submitCertification(data?: any, options?: any) {
    return this.post('submitCertification', { ...options, data });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-法律主体',
    action: '更新',
  })
  async update(data?: any, options?: any) {
    return this.put('update', { ...options, data });
  }
}

export const legalSubjectService = new LegalSubjectService();
