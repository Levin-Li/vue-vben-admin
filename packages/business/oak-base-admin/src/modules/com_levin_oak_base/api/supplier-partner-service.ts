import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/SupplierPartner',
  controllerClass: 'com.levin.oak.base.controller.BizSupplierPartnerController',
  description: '供应伙伴管理',
  title: '供应伙伴',
  type: '业务数据-供应伙伴',
})
export class SupplierPartnerService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({
    label: '保存供应伙伴',
    opRefTargetType: 'None',
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-供应伙伴',
    action: '保存供应伙伴',
  })
  async create(data?: any, options?: any) {
    return this.post('saveSupplierPartner', { ...options, data });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.SupplierPartner',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-供应伙伴',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-供应伙伴',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @CRUD.Op({ confirmText: 'None', label: '更新供应伙伴' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-供应伙伴',
    action: '更新供应伙伴',
  })
  async update(data?: any, options?: any) {
    return this.put('updateSupplierPartner', { ...options, data });
  }
}

export const supplierPartnerService = new SupplierPartnerService();
