import { CRUD, ResAuthorize, Service } from '../common/api-authorize';
import { RequestService } from '../common/request-service';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Demo',
  description: 'Demo管理',
  title: 'Demo',
  type: '专家数据-Demo',
})
export class DemoService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Demo',
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
    type: '专家数据-Demo',
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
    type: '专家数据-Demo',
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
    type: '专家数据-Demo',
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
    type: '专家数据-Demo',
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
    type: '专家数据-Demo',
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
    type: '专家数据-Demo',
    action: '查询列表',
    onlyRequireAuthenticated: true,
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.Demo',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Demo',
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
    type: '专家数据-Demo',
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
    type: '专家数据-Demo',
    action: '统计',
    onlyRequireAuthenticated: true,
  })
  async testRequestBody1(data?: any, options?: any) {
    return this.post('testRequestBody1', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Demo',
    action: '统计',
    onlyRequireAuthenticated: true,
  })
  async testRequestBody2(data?: any, options?: any) {
    return this.post('testRequestBody2', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Demo',
    action: '统计',
    onlyRequireAuthenticated: true,
  })
  async testRequestBody3(data?: any, options?: any) {
    return this.post('testRequestBody3', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '专家数据-Demo',
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

export const demoService = new DemoService();
