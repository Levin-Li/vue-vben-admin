import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

/** 平台领域默认 CRUD 接口。 */
@Service({
  basePath: '/PlatformDomain',
  controllerClass: 'com.levin.oak.base.controller.BizPlatformDomainController',
  description: '维护平台级数据领域及其发布状态。',
  title: '平台领域',
  type: '平台数据-平台领域',
})
export class PlatformDomainService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ opRefTargetType: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台领域',
    action: '新增',
  })
  async create(data?: any, options?: any) {
    return this.post('create', { ...options, data });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台领域',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', { ...options, params });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.PlatformDomain',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台领域',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', { ...options, params });
  }

  @CRUD.Op({ label: '下线', visibleOn: "state == 'Published'" })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台领域',
    action: '下线',
  })
  async offline(data?: any, options?: any) {
    return this.post('offline', { ...options, data });
  }

  @CRUD.Op({ label: '发布', visibleOn: "state == 'Draft'" })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台领域',
    action: '发布',
  })
  async publish(data?: any, options?: any) {
    return this.post('publish', { ...options, data });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台领域',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', { ...options, params });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台领域',
    action: '更新',
  })
  async update(data?: any, options?: any) {
    return this.put('update', { ...options, data });
  }
}

export const platformDomainService = new PlatformDomainService();
