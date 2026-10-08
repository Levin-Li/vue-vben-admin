import {
  CRUD,
  requestClient,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { toGenericSupportRequestScope } from './support-request-scope';

export interface InboxRecord {
  attachmentFileIds?: string[];
  fromEmail?: string;
  htmlContent?: string;
  id: string;
  inReplyToHeader?: string;
  messageIdHeader?: string;
  orgId?: string;
  parseStatus?: string;
  processError?: string;
  rawMimeFileId?: string;
  receivedTime?: string;
  recipientEmail?: string;
  referencesHeader?: string;
  status?: string;
  subject?: string;
  tenantId?: string;
  textContent?: string;
}

/** 将响应文件名收缩为安全本地名称，不接受路径或控制字符。 */
export function safeMailFileName(
  disposition: string,
  fallback = '邮件内容.bin',
) {
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  let name = plain?.[1] || fallback;
  if (match?.[1]) {
    try {
      name = decodeURIComponent(match[1]);
    } catch {
      name = fallback;
    }
  }
  return (
    [...name.replaceAll(/[\\/]/g, '_')]
      .filter((character) => {
        const code = character.codePointAt(0) ?? -1;
        return code > 31 && !(code >= 127 && code <= 159);
      })
      .join('')
      .slice(0, 180) || fallback
  );
}

@Service({
  basePath: '/Inbox',
  controllerClass: 'com.levin.oak.base.controller.BizInboxController',
  description: '入站邮件收件箱',
  title: '收件箱',
  type: '系统数据-收件箱',
})
export class InboxService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '下载邮件私有内容' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-收件箱',
    action: '下载邮件私有内容',
  })
  async download(params: {
    blobId: string;
    id: string;
    orgId?: string;
    tenantId?: string;
  }): Promise<{ blob: Blob; fileName: string }> {
    const response = await requestClient.request<any>(
      this.buildRequestPath('blob/download'),
      {
        baseURL: '',
        method: 'GET',
        params: toGenericSupportRequestScope(params),
        responseReturn: 'raw',
        responseType: 'blob',
      },
    );
    const contentType = String(response.headers?.['content-type'] || '');
    if (!/application\/octet-stream/i.test(contentType))
      throw new Error('邮件私有内容下载失败');
    const blob =
      response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: contentType });
    const fileName = safeMailFileName(
      String(response.headers?.['content-disposition'] || ''),
    );
    return { blob, fileName };
  }

  @CRUD.Op({ label: '收件转工单' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-收件箱',
    action: '收件转工单',
  })
  async intake(data: {
    id: string;
    orgId?: string;
    supportMailboxRuleId: string;
    tenantId?: string;
  }): Promise<string> {
    return this.post('ticket/intake', { data });
  }

  @CRUD.ListTable({ refEntityClass: 'com.levin.oak.base.entities.Inbox' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-收件箱',
    action: '查询列表',
  })
  async list(
    params?: any,
    options?: any,
  ): Promise<{ items: InboxRecord[]; totals: number }> {
    return this.get('list', {
      ...options,
      params: toGenericSupportRequestScope(params ?? {}),
    });
  }

  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '系统数据-收件箱',
    action: '查看详情',
  })
  async retrieve(params?: any, options?: any): Promise<InboxRecord> {
    return this.get('retrieve', {
      ...options,
      params: toGenericSupportRequestScope(params ?? {}),
    });
  }
}

export const inboxService = new InboxService();
