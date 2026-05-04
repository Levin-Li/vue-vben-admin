import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/User',
  description: '用户管理',
  title: '用户',
  type: '系统数据-用户',
})
export class UserService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
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
    type: '系统数据-用户',
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
    type: '系统数据-用户',
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
    type: '系统数据-用户',
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
    type: '系统数据-用户',
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
    type: '系统数据-用户',
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
    type: '系统数据-用户',
    action: '查询列表',
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.User',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: '重置MFA密钥',
  })
  @CRUD.Op({
    level: 'Danger',
    successAction: 'ShowQrCode',
  })
  async resetMfaSecretKey(params?: any, options?: any) {
    return this.put('resetMfaSecretKey', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
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
    type: '系统数据-用户',
    action: '更新',
  })
  @CRUD.Op()
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: 'MFA二维码',
  })
  @CRUD.Op({
    successAction: 'ShowForm',
  })
  async viewMfaQrCode(params?: any, options?: any) {
    return this.get('viewMfaQrCode', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-用户',
    action: '查看我的MFA二维码',
    onlyRequireAuthenticated: true,
  })
  @CRUD.Op({
    opRefTargetListName: '',
    successAction: 'ShowForm',
  })
  async viewMyMfaQrCode(params?: any, options?: any) {
    return this.get('viewMyMfaQrCode', {
      ...options,
      params,
    });
  }
}

export const userService = new UserService();
