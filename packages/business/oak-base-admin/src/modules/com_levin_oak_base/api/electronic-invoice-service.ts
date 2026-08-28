import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/EInvoice',
  controllerClass: 'com.levin.oak.base.controller.BizEInvoiceController',
  title: '电子发票',
  type: '系统数据-电子发票',
})
export class ElectronicInvoiceService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '申请开票', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-电子发票',
    action: '申请开票',
  })
  async create(data?: any, options?: any) {
    return this.post('issue', { ...options, data });
  }

  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.EInvoice' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-电子发票',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ label: '重新对账', opRefTargetType: 'SingleRow' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-电子发票',
    action: '重新对账',
  })
  async reconcile(data?: any, options?: any) {
    return this.post('reconcile', { ...options, data });
  }

  @CRUD.Op({ label: '申请红冲', opRefTargetType: 'SingleRow' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-电子发票',
    action: '申请红冲',
  })
  async redIssue(data?: any, options?: any) {
    return this.post('redIssue', { ...options, data });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-电子发票',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }
}

export const electronicInvoiceService = new ElectronicInvoiceService();
