import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

export interface TenantSiteDnsRecord {
  host?: string;
  id?: string;
  priority?: number;
  recordType?: string;
  ttl?: number;
  value?: string;
}

export interface TenantSiteIdReq {
  id?: string;
}

export interface ManualSslCertConfig {
  certChainPem?: string;
  id?: string;
  privateKeyPem?: string;
  remark?: string;
}

export interface TenantSiteDnsRecordSave {
  id?: string;
  record?: TenantSiteDnsRecord;
  recordId?: string;
}

export interface TenantSiteDnsRecordDelete {
  id?: string;
  recordId?: string;
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
    return this.post<TenantSiteRecord>('dnsRecords/create', {
      ...options,
      data: { id, record: data } satisfies TenantSiteDnsRecordSave,
    });
  }

  async addDnsRecord(id: string, data?: TenantSiteDnsRecord, options?: any) {
    return this.createDnsRecord(id, data, options);
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
    action: '申请域名',
  })
  async applyExistingDomain(id: string, data?: any, options?: any) {
    return this.post('applyExistingDomain', {
      ...options,
      data: { id, site: data },
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
  async canApply(data?: any, options?: any) {
    return this.post('canApply', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '配置SSL证书',
  })
  @CRUD.Op({
    confirmText: 'None',
    label: '配置SSL证书',
    opRefTargetType: 'SingleRow',
    successAction: 'ShowForm',
  })
  async configManualSslCert(
    id: string,
    data?: ManualSslCertConfig,
    options?: any,
  ) {
    return this.post<TenantSiteRecord>('configManualSslCert', {
      ...options,
      data: { ...(data || {}), id },
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '生成NG配置文件',
  })
  @CRUD.Op({
    confirmText: '确认生成当前站点的NG配置和证书文件吗？',
    label: '生成NG配置和证书文件',
    opRefTargetType: 'SingleRow',
  })
  async generateNginxConfig(id: string, data?: any, options?: any) {
    return this.post<TenantSiteRecord>('generateNginxConfig', {
      ...options,
      data: { ...(data || {}), id },
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
    data?: any,
    options?: any,
  ) {
    return this.deleteDnsRecordById(id, recordId, data, options);
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
    data?: any,
    options?: any,
  ) {
    return this.post<TenantSiteRecord>('dnsRecords/delete', {
      ...options,
      data: { ...(data || {}), id, recordId } satisfies TenantSiteDnsRecordDelete,
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
    action: '获取SSL证书提前续期天数',
  })
  async sslRenewBeforeDays(params?: any, options?: any) {
    return this.get('sslRenewBeforeDays', {
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
    return this.post<TenantSiteDnsRecord[]>('dnsRecords/list', {
      ...options,
      data: { ...(params || {}), id },
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
    return this.post('renewDomain', {
      ...options,
      data: { ...(params || {}), id } satisfies TenantSiteIdReq,
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
    return this.post('syncStatus', {
      ...options,
      data: { ...(params || {}), id } satisfies TenantSiteIdReq,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '申请SSL证书',
  })
  async applySslCert(id: string, data?: any, options?: any) {
    return this.post('applySslCert', {
      ...options,
      data: { ...(data || {}), id } satisfies TenantSiteIdReq,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-租户站点',
    action: '同步SSL证书状态',
  })
  async syncSslCertStatus(id: string, data?: any, options?: any) {
    return this.post('syncSslCertStatus', {
      ...options,
      data: { ...(data || {}), id } satisfies TenantSiteIdReq,
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
  async updateDnsRecord(id: string, data?: TenantSiteDnsRecord, options?: any) {
    return this.post<TenantSiteRecord>('dnsRecords/update', {
      ...options,
      data: { id, record: data } satisfies TenantSiteDnsRecordSave,
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
    return this.post<TenantSiteRecord>('dnsRecords/update', {
      ...options,
      data: { id, recordId, record: data } satisfies TenantSiteDnsRecordSave,
    });
  }
}

export const tenantSiteService = new TenantSiteService();
