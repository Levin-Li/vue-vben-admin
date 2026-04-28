import { CRUD, ResAuthorize, Service } from '../common/api-authorize';
import { RequestService } from '../common/request-service';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Address',
  description: '地址管理',
  title: '地址',
  type: '业务数据-地址',
})
export class AddressService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-地址',
    action: '批量新增',
    onlyRequireAuthenticated: true,
  })
  async batchCreate(data?: any, options?: any) {
    return this.post('batchCreate', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-地址',
    action: '批量删除',
    onlyRequireAuthenticated: true,
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
    type: '业务数据-地址',
    action: '批量更新',
    onlyRequireAuthenticated: true,
  })
  async batchUpdate(data?: any, options?: any) {
    return this.put('batchUpdate', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-地址',
    action: '清除缓存',
    onlyRequireAuthenticated: true,
  })
  async clearCache(params?: any, options?: any) {
    return this.get('clearCache', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-地址',
    action: '新增',
    onlyRequireAuthenticated: true,
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
    type: '业务数据-地址',
    action: '删除',
    onlyRequireAuthenticated: true,
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
    type: '业务数据-地址',
    action: '查询列表',
    onlyRequireAuthenticated: true,
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.Address',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-地址',
    action: '查看详情',
    onlyRequireAuthenticated: true,
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
    type: '业务数据-地址',
    action: '统计',
    onlyRequireAuthenticated: true,
  })
  async stat(params?: any, options?: any) {
    return this.get('stat', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-地址',
    action: '更新',
    onlyRequireAuthenticated: true,
  })
  @CRUD.Op()
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }
}

export const addressService = new AddressService();
