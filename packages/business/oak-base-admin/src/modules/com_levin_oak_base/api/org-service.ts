import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Org',
  controllerClass: 'com.levin.oak.base.controller.BizOrgController',
  description: '机构管理',
  title: '机构',
  type: '系统数据-组织机构',
})
export class OrgService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-组织机构',
    action: '清除缓存',
  })
  async clearCache(params?: any, options?: any) {
    return this.get('clearCache', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    opRefTargetType: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-组织机构',
    action: '新增',
  })
  async create(data?: any, options?: any) {
    return this.post('create', {
      ...options,
      data,
    });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-组织机构',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', {
      ...options,
      params,
    });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.Org',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-组织机构',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @CRUD.Op({
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-组织机构',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', {
      ...options,
      params,
    });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-组织机构',
    action: '更新',
  })
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }
}

export const orgService = new OrgService();
