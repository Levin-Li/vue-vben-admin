import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/MemberUser',
  controllerClass: 'com.levin.oak.base.controller.BizMemberUserController',
  description: '会员用户管理',
  title: '会员用户',
  type: '系统数据-会员用户',
})
export class MemberUserService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-会员用户',
    action: '批量新增',
  })
  async batchCreate(data?: any, options?: any) {
    return this.post('batchCreate', {
      ...options,
      data,
    });
  }

  @CRUD.Op({
    opRefTargetType: 'MultipleRow',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-会员用户',
    action: '批量删除',
  })
  async batchDelete(params?: any, options?: any) {
    return this.deleteRequest('batchDelete', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-会员用户',
    action: '批量更新',
  })
  async batchUpdate(data?: any, options?: any) {
    return this.put('batchUpdate', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-会员用户',
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
    type: '系统数据-会员用户',
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
    type: '系统数据-会员用户',
    action: '删除',
  })
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', {
      ...options,
      params,
    });
  }

  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.MemberUser',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-会员用户',
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
    type: '系统数据-会员用户',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-会员用户',
    action: '统计',
  })
  async stat(params?: any, options?: any) {
    return this.get('stat', {
      ...options,
      params,
    });
  }

  @CRUD.Op()
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-会员用户',
    action: '更新',
  })
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }
}

export const memberUserService = new MemberUserService();
