import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/AppClient',
  description: '应用接入管理',
  title: '应用接入',
  type: '系统数据-应用接入',
})
export class AppClientService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    ignored: true,
  })
  async auth(params?: any, options?: any) {
    return this.get('auth', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-应用接入',
    action: '批量新增',
  })
  async batchCreate(data?: any, options?: any) {
    return this.post('batchCreate', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-应用接入',
    action: '批量删除',
  })
  @CRUD.Op({
    opRefTargetType: 'MultipleRow',
  })
  async batchDelete(params?: any, options?: any) {
    return this.deleteRequest('batchDelete', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-应用接入',
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
    type: '系统数据-应用接入',
    action: '清除缓存',
  })
  async clearCache(params?: any, options?: any) {
    return this.get('clearCache', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-应用接入',
    action: '新增',
  })
  @CRUD.Op({
    opRefTargetType: 'None',
  })
  async create(data?: any, options?: any) {
    return this.post('create', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-应用接入',
    action: '删除',
  })
  @CRUD.Op()
  async delete(params?: any, options?: any) {
    return this.deleteRequest('delete', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-应用接入',
    action: '查询列表',
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.AppClient',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-应用接入',
    action: '查看详情',
  })
  @CRUD.Op({
    confirmText: 'None',
  })
  async retrieve(params?: any, options?: any) {
    return this.get('retrieve', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-应用接入',
    action: '更新',
  })
  @CRUD.Op()
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }
}

export const appClientService = new AppClientService();
