import { CRUD, ResAuthorize, Service } from '../common/api-authorize';
import { RequestService } from '../common/request-service';
import { OAK_BASE_API_MODULE } from './_module';

export interface TenantSiteDnsRecord {
  host?: string;
  id?: string;
  priority?: number;
  recordType?: string;
  ttl?: number;
  value?: string;
}

export interface TenantSiteRecord {
  domain?: string;
  domainDnsRecords?: TenantSiteDnsRecord[];
  id?: string;
  name?: string;
}

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
  @CRUD.Op({
    confirmText: 'None',
    opRefTargetType: 'SingleRow',
    visibleOn: 'false',
  })
  async createDnsRecord(id: string, data?: TenantSiteDnsRecord, options?: any) {
    return this.post<TenantSiteRecord>(`${id}/dnsRecords`, {
      ...options,
      data,
    });
  }

  async addDnsRecord(id: string, data?: TenantSiteDnsRecord, options?: any) {
    return this.post<TenantSiteRecord>(`${id}/addDnsRecord`, {
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
  @CRUD.Op({
    opRefTargetType: 'SingleRow',
    visibleOn: 'false',
  })
  async deleteDnsRecord(
    id: string,
    recordId: string,
    params?: any,
    options?: any,
  ) {
    return this.deleteRequest<TenantSiteRecord>(`${id}/dnsRecord/${recordId}`, {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '删除解析记录',
  })
  @CRUD.Op({
    opRefTargetType: 'SingleRow',
    visibleOn: 'false',
  })
  async deleteDnsRecordById(
    id: string,
    recordId: string,
    params?: any,
    options?: any,
  ) {
    return this.deleteRequest<TenantSiteRecord>(
      `${id}/dnsRecords/${recordId}`,
      {
        ...options,
        params,
      },
    );
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
  @CRUD.Op({
    confirmText: 'None',
    label: '域名解析',
    opRefTargetType: 'SingleRow',
    successAction: 'ShowForm',
  })
  async listDnsRecords(id: string, params?: any, options?: any) {
    return this.get<TenantSiteDnsRecord[]>(`${id}/dnsRecords`, {
      ...options,
      params,
    });
  }

  async queryDnsRecord(id: string, params?: any, options?: any) {
    return this.listDnsRecords(id, params, options);
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
  @CRUD.Op({
    confirmText: 'None',
    opRefTargetType: 'SingleRow',
    visibleOn: 'false',
  })
  async updateDnsRecord(
    id: string,
    data?: TenantSiteDnsRecord,
    options?: any,
  ) {
    return this.put<TenantSiteRecord>(`${id}/dnsRecord`, {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '更新解析记录',
  })
  @CRUD.Op({
    confirmText: 'None',
    opRefTargetType: 'SingleRow',
    visibleOn: 'false',
  })
  async updateDnsRecordById(
    id: string,
    recordId: string,
    data?: TenantSiteDnsRecord,
    options?: any,
  ) {
    return this.put<TenantSiteRecord>(`${id}/dnsRecords/${recordId}`, {
      ...options,
      data,
    });
  }
}

export const tenantSiteService = new TenantSiteService();
