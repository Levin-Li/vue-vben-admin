import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Customer',
  controllerClass: 'com.levin.oak.base.controller.BizCustomerController',
  description: '客户管理',
  title: '客户',
  type: '系统数据-客户',
})
export class CustomerService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '保存客户', opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-客户',
    action: '保存客户',
  })
  async create(data?: any, options?: any) {
    return this.post('saveCustomer', { ...options, data });
  }

  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.Customer' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-客户',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-客户',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @CRUD.Op({ label: '更新客户' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-客户',
    action: '更新客户',
  })
  async update(data?: any, options?: any) {
    return this.put('updateCustomer', { ...options, data });
  }
}

export const customerService = new CustomerService();
