import { CRUD, ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

export interface DomainDnsRecord {
  enable?: boolean;
  host?: string;
  id?: string;
  priority?: number;
  recordType?: string;
  ttl?: number;
  value?: string;
  zoneId?: string;
}

export interface DomainIdReq {
  id?: string;
}

export interface DomainDnsRecordBatchDelete {
  id?: string;
  recordIds?: string[];
}

export interface DomainDnsRecordSave {
  id?: string;
  record?: DomainDnsRecord;
  recordId?: string;
}

export interface DomainDnsRecordDelete {
  id?: string;
  recordId?: string;
}

export interface DomainRecord {
  domainApplyApi?: string;
  domainApplyStatus?: string;
  domainExpiredTime?: string;
  dnsRecords?: DomainDnsRecord[];
  enable?: boolean;
  emailReceivingEnabled?: boolean;
  id?: string;
  name?: string;
  neverExpires?: boolean;
  providerName?: string;
}

export interface DomainEmailReceivingStatus {
  conflicts?: string[];
  domain?: string;
  enabled?: boolean;
  missingRecords?: string[];
  publicIpv4?: string;
  ready?: boolean;
  warnings?: string[];
}

export interface DomainOperationProfile {
  providerAvailable?: boolean;
  providerCode?: string;
  providerName?: string;
  operations?: Record<string, { enabled?: boolean; reason?: string; visible?: boolean }>;
}

@Service({
  basePath: '/Domain',
  controllerClass: 'com.levin.oak.base.controller.BizDomainController',
  description: '根域名管理',
  title: '根域名',
  type: '系统数据-根域名',
})
export class DomainService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({ domain: 'com.levin.oak.base', type: '系统数据-根域名', action: '获取域名动态操作画像' })
  async operationProfile(id: string, options?: any) {
    return this.get<DomainOperationProfile>('operationProfile', { ...options, params: { id } });
  }

  async checkEmailReceiving(id: string, options?: any) {
    return this.post<DomainEmailReceivingStatus>('emailReceiving/check', { ...options, data: { id } });
  }

  async enableEmailReceiving(id: string, options?: any) {
    return this.post<DomainEmailReceivingStatus>('emailReceiving/enable', { ...options, data: { id } });
  }

  async syncEmailReceiving(id: string, options?: any) {
    return this.post<DomainEmailReceivingStatus>('emailReceiving/sync', { ...options, data: { id } });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
    action: '申请域名',
  })
  async applyDomain(data?: any, options?: any) {
    return this.post<DomainRecord>('applyDomain', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
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
    type: '系统数据-根域名',
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
    type: '系统数据-根域名',
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
    type: '系统数据-根域名',
    action: '添加解析记录',
  })
  @CRUD.Op({
    confirmText: 'None',
    opRefTargetType: 'SingleRow',
    visibleOn: 'false',
  })
  async createDnsRecord(id: string, data?: DomainDnsRecord, options?: any) {
    return this.post<DomainRecord>('dnsRecords/create', {
      ...options,
      data: { id, record: data } satisfies DomainDnsRecordSave,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
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
    type: '系统数据-根域名',
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
    return this.post<DomainRecord>('dnsRecords/delete', {
      ...options,
      data: { ...(data || {}), id, recordId } satisfies DomainDnsRecordDelete,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
    action: '批量删除解析记录',
  })
  @CRUD.Op({
    opRefTargetType: 'SingleRow',
    visibleOn: 'false',
  })
  async batchDeleteDnsRecords(
    id: string,
    data?: DomainDnsRecordBatchDelete,
    options?: any,
  ) {
    return this.post<DomainRecord>('dnsRecords/batchDelete', {
      ...options,
      data: { ...(data || {}), id },
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
    action: '查询列表',
  })
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.Domain',
  })
  async list(params?: any, options?: any) {
    return this.get('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
    action: '查询解析记录',
  })
  @CRUD.Op({
    confirmText: 'None',
    label: '域名解析',
    opRefTargetType: 'SingleRow',
    successAction: 'ShowForm',
  })
  async listDnsRecords(id: string, params?: any, options?: any) {
    return this.post<DomainDnsRecord[]>('dnsRecords/list', {
      ...options,
      data: { ...(params || {}), id },
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
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
    type: '系统数据-根域名',
    action: '续期域名',
  })
  async renewDomain(id: string, data?: any, options?: any) {
    return this.post<DomainRecord>('renewDomain', {
      ...options,
      data: { ...(data || {}), id } satisfies DomainIdReq,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
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
    type: '系统数据-根域名',
    action: '同步域名状态',
  })
  async syncDomainStatus(id: string, data?: any, options?: any) {
    return this.post<DomainRecord>('syncStatus', {
      ...options,
      data: { ...(data || {}), id } satisfies DomainIdReq,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-根域名',
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
    type: '系统数据-根域名',
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
    data?: DomainDnsRecord,
    options?: any,
  ) {
    return this.post<DomainRecord>('dnsRecords/update', {
      ...options,
      data: { id, recordId, record: data } satisfies DomainDnsRecordSave,
    });
  }
}

export const domainService = new DomainService();
