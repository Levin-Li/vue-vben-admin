import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/EInvoiceProviderConnection',
  controllerClass:
    'com.levin.oak.base.controller.BizEInvoiceProviderConnectionController',
  title: '电子发票供应商连接',
  type: '系统数据-电子发票供应商连接',
})
export class ElectronicInvoiceProviderConnectionService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '确认商户授权' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-电子发票供应商连接',
    action: '确认商户授权',
  })
  async completeAuthorization(data?: any, options?: any) {
    return this.post('completeAuthorization', { ...options, data });
  }

  @CRUD.Op({ label: '开通供应商连接', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-电子发票供应商连接',
    action: '开通供应商连接',
  })
  async create(data?: any, options?: any) {
    return this.post('activate', { ...options, data });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.EInvoiceProviderConnection',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-电子发票供应商连接',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }
}

export const electronicInvoiceProviderConnectionService =
  new ElectronicInvoiceProviderConnectionService();
