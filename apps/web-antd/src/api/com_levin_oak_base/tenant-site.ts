import { CRUD, ResAuthorize, Service } from '../common/api-authorize';
import { RequestService } from '../common/request-service';
import { OAK_BASE_API_MODULE } from './_module';

@Service({
  basePath: '/TenantSite',
  description: '租户站点管理',
  title: '租户站点',
  type: '系统数据-租户站点',
})
export class TenantSiteService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '添加解析记录',
  })
  async addDnsRecord(id: string, data?: any, options?: any) {
    return this.post(`${id}/addDnsRecord`, {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '申请域名',
  })
  async applyDomain(data?: any, options?: any) {
    return this.post('applyDomain', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '获取所有可用域名后缀',
  })
  async availableSuffixes(params?: any, options?: any) {
    return this.get('availableSuffixes', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '检查域名是否可注册',
  })
  async canApply(params?: any, options?: any) {
    return this.get('canApply', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
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
    type: '系统数据-租户站点',
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
    type: '系统数据-租户站点',
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
    type: '系统数据-租户站点',
    action: '删除解析记录',
  })
  async deleteDnsRecord(
    id: string,
    recordId: string,
    params?: any,
    options?: any,
  ) {
    return this.deleteRequest(`${id}/dnsRecord/${recordId}`, {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '查询列表',
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.TenantSite',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '获取服务器公网IP',
  })
  async publicIp(params?: any, options?: any) {
    return this.get('publicIp', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '查询解析记录',
  })
  async queryDnsRecord(id: string, params?: any, options?: any) {
    return this.get(`${id}/dnsRecords`, {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '续期域名',
  })
  async renewDomain(id: string, params?: any, options?: any) {
    return this.post(`${id}/renewDomain`, {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
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
    type: '系统数据-租户站点',
    action: '同步域名状态',
  })
  async syncDomainStatus(id: string, params?: any, options?: any) {
    return this.post(`${id}/syncStatus`, {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
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
    type: '系统数据-租户站点',
    action: '更新解析记录',
  })
  async updateDnsRecord(id: string, data?: any, options?: any) {
    return this.put(`${id}/dnsRecord`, {
      ...options,
      data,
    });
  }
}

export const tenantSiteService = new TenantSiteService();
