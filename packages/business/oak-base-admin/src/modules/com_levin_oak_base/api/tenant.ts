import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/Tenant',
  description: '平台租户管理',
  title: '平台租户',
  type: '平台数据-平台租户',
})
export class TenantService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台租户',
    action: '批量新增',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
  })
  async batchCreate(data?: any, options?: any) {
    return this.post('batchCreate', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台租户',
    action: '批量删除',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
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
    type: '平台数据-平台租户',
    action: '批量更新',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
  })
  async batchUpdate(data?: any, options?: any) {
    return this.put('batchUpdate', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台租户',
    action: '清除缓存',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
  })
  async clearCache(params?: any, options?: any) {
    return this.get('clearCache', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台租户',
    action: '新增',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
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
    type: '平台数据-平台租户',
    action: '删除',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
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
    type: '平台数据-平台租户',
    action: '查询列表',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.Tenant',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台租户',
    action: '查看详情',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
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
    type: '平台数据-平台租户',
    action: '统计',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
  })
  async stat(params?: any, options?: any) {
    return this.get('stat', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '平台数据-平台租户',
    action: '更新',
    isAndMode: true,
    anyRoles: ['R_SA', 'R_SAAS_ADMIN'],
  })
  @CRUD.Op()
  async update(data?: any, options?: any) {
    return this.put('update', {
      ...options,
      data,
    });
  }
}

export const tenantService = new TenantService();
