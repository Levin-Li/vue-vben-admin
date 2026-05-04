import { ResAuthorize, Service } from '@levin/admin-framework';
import { RequestService } from '@levin/admin-framework';
import { requestClient } from '@levin/admin-framework';
import { OAK_BASE_API_MODULE } from './_module';

export interface DomainSslCertApply {
  email?: string;
  id?: string;
}

export interface DomainSslCertDnsRecordApply {
  email?: string;
  id?: string;
  recordId?: string;
}

export interface DomainSslCertManualConfig {
  id?: string;
  remark?: string;
  sslCertChainPem?: string;
  sslPrivateKeyPem?: string;
}

export interface DomainSslCertDownload {
  domain?: string;
  id?: string;
}

export interface DomainSslCertRecord {
  domain?: string;
  id?: string;
  localSaveDir?: string;
  rootDomain?: string;
  sslApplyStatus?: string;
  sslCertChainPem?: string;
  sslCertExpiredTime?: string;
  sslPrivateKeyPem?: string;
}

@Service({
  basePath: '/DomainSslCert',
  description: 'SSL证书管理',
  title: 'SSL证书',
  type: '系统数据-SSL证书',
})
export class DomainSslCertService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-SSL证书',
    action: '新增',
  })
  async create(data?: any, options?: any) {
    return this.post<DomainSslCertRecord>('create', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-SSL证书',
    action: '查询列表',
  })
  async list(params?: any, options?: any) {
    return this.get<any>('list', {
      ...options,
      params,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-SSL证书',
    action: '申请SSL',
  })
  async applySslCert(data?: DomainSslCertApply, options?: any) {
    return this.post<DomainSslCertRecord>('applySslCert', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-SSL证书',
    action: '申请SSL',
  })
  async applyForDnsRecord(data?: DomainSslCertDnsRecordApply, options?: any) {
    return this.post<DomainSslCertRecord>('applyForDnsRecord', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-SSL证书',
    action: '配置SSL',
  })
  async configManualSslCert(
    data?: DomainSslCertManualConfig,
    options?: any,
  ) {
    return this.post<DomainSslCertRecord>('configManualSslCert', {
      ...options,
      data,
    });
  }

  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-SSL证书',
    action: '下载证书',
  })
  async downloadCert(data?: DomainSslCertDownload) {
    const response = await requestClient.request<any>(
      `${OAK_BASE_API_MODULE}/DomainSslCert/downloadCert`,
      {
        baseURL: '',
        data,
        method: 'POST',
        responseReturn: 'raw',
        responseType: 'blob',
      },
    );
    const contentType = String(response?.headers?.['content-type'] || '');
    const responseBlob =
      response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: contentType });
    if (/json|text/i.test(contentType)) {
      throw new Error(await readDownloadError(responseBlob));
    }
    const header = new Uint8Array(await responseBlob.slice(0, 4).arrayBuffer());
    const isZip =
      header.length >= 2 && header[0] === 0x50 && header[1] === 0x4b;
    if (!isZip) {
      throw new Error(await readDownloadError(responseBlob));
    }
    const disposition = String(
      response?.headers?.['content-disposition'] ||
        response?.headers?.['Content-Disposition'] ||
        '',
    );
    const matched = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const fileName = matched?.[1]
      ? decodeURIComponent(matched[1])
      : `${data?.domain || data?.id || 'ssl-cert'}.zip`;
    const url = URL.createObjectURL(responseBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}

async function readDownloadError(blob: Blob) {
  const text = await blob.text();
  if (!text) {
    return '下载证书失败：服务端没有返回有效证书压缩包';
  }
  try {
    const data = JSON.parse(text);
    return data?.msg || data?.detailMsg || data?.message || text;
  } catch {
    return text;
  }
}

export const domainSslCertService = new DomainSslCertService();
