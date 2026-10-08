import type { SupportPage } from './support-workbench-types';

import {
  CRUD,
  requestClient,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';
import { safeMailFileName } from './inbox-service';
import { toGenericSupportRequestScope } from './support-request-scope';

export interface TicketScope {
  orgId?: string;
  tenantId?: string;
}
export interface TicketLocator extends TicketScope {
  id: string;
}
export interface TicketCommand extends TicketLocator {
  optimisticLock: number;
  remark?: string;
}
export interface TicketRecord extends TicketLocator {
  actionLog?: {
    action: string;
    afterStatus?: string;
    beforeStatus?: string;
    occurTime: string;
    operator: string;
    remark?: string;
  }[];
  assigneeId?: string;
  confirmedContactBy?: string;
  confirmedContactEmail?: string;
  confirmedContactTime?: string;
  optimisticLock: number;
  priority: string;
  queueId: string;
  requesterEmail: string;
  status: string;
  supportEmail: string;
  supportEventsByCurrentStatus?: string[];
  title: string;
}
export interface TicketMessageRecord {
  attachmentFileIds?: string[];
  authorUserId?: string;
  body: string;
  bodyTruncated: boolean;
  createTime?: string;
  direction: string;
  externalSenderEmail?: string;
  id: string;
  occurredTime?: string;
  outboundIntentId?: string;
  sourceInboxId?: string;
}
export interface TicketOutboundRecord {
  attemptCount: number;
  failureSummary?: string;
  id: string;
  messageId: string;
  occurredTime?: string;
  optimisticLock: number;
  status: string;
  submittedTime?: string;
  ticketId: string;
}
export interface TicketReplyCommand extends TicketCommand {
  attachmentIds: string[];
  body: string;
  replyKey: string;
}
export interface TicketUnsentReview extends TicketLocator {
  evidenceRef: string;
  intentId: string;
  intentVersion: number;
  reason: 'VerifiedUnsent';
  verifiedUnsent: true;
}
/** 状态命令仅回传版本和处理说明，不能借此编辑任意工单字段。 */
function toTicketCommand(data: TicketCommand): TicketCommand {
  const { id, tenantId, orgId, optimisticLock, remark } = data;
  return { id, tenantId, orgId, optimisticLock, remark };
}

@Service({
  basePath: '/TicketAction',
  controllerClass: 'com.levin.oak.base.controller.TicketActionController',
  title: '客服工单',
  type: '业务数据-客服工单',
})
export class TicketService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }

  @CRUD.Op({ label: '分派客服工单' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '分派客服工单',
  })
  async assign(
    data: TicketCommand & { assigneeId: string },
  ): Promise<TicketRecord> {
    return this.post('assign', {
      data: { ...toTicketCommand(data), assigneeId: data.assigneeId },
    });
  }

  @CRUD.Op({ label: '下载工单附件' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '下载工单附件',
  })
  async attachmentDownload(
    params: TicketLocator & { blobId: string },
  ): Promise<{ blob: Blob; fileName: string }> {
    const response = await requestClient.request<any>(
      this.buildRequestPath('attachmentDownload'),
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
      throw new Error('工单私有附件不可访问');
    return {
      blob:
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: contentType }),
      fileName: safeMailFileName(
        String(response.headers?.['content-disposition'] || ''),
      ),
    };
  }

  @CRUD.Op({ label: '关闭客服工单' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '关闭客服工单',
  })
  async close(data: TicketCommand): Promise<TicketRecord> {
    return this.post('close', { data: toTicketCommand(data) });
  }

  @CRUD.Op({ label: '核验工单联系人' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '核验工单联系人',
  })
  async confirmContact(
    data: TicketLocator & { evidenceReason: string; optimisticLock: number },
  ): Promise<TicketRecord> {
    const { id, tenantId, orgId, optimisticLock, evidenceReason } = data;
    return this.post('confirmContact', {
      data: { id, tenantId, orgId, optimisticLock, evidenceReason },
    });
  }

  @CRUD.Op({ label: '查询客服工单' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '查询客服工单',
  })
  async list(
    params: TicketScope & {
      pageIndex: number;
      pageSize: number;
      queueId?: string;
      status?: string;
    },
  ): Promise<SupportPage<TicketRecord>> {
    return this.get('list', { params: toGenericSupportRequestScope(params) });
  }

  @CRUD.Op({ label: '查看工单消息' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '查看工单消息',
  })
  async message(
    params: TicketLocator & { messageId: string },
  ): Promise<TicketMessageRecord> {
    return this.get('message', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @CRUD.Op({ label: '查询工单消息' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '查询工单消息',
  })
  async messages(
    params: TicketLocator & { pageIndex: number; pageSize: number },
  ): Promise<SupportPage<TicketMessageRecord>> {
    return this.get('messages', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @CRUD.Op({ label: '查看工单外发结果' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '查看工单外发结果',
  })
  async outbound(
    params: TicketLocator & { intentId: string },
  ): Promise<TicketOutboundRecord> {
    return this.get('outbound', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @CRUD.Op({ label: '重开客服工单' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '重开客服工单',
  })
  async reopen(data: TicketCommand): Promise<TicketRecord> {
    return this.post('reopen', { data: toTicketCommand(data) });
  }

  @CRUD.Op({ label: '发送工单邮件回复' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '发送工单邮件回复',
  })
  async reply(data: TicketReplyCommand): Promise<TicketOutboundRecord> {
    const {
      id,
      tenantId,
      orgId,
      optimisticLock,
      replyKey,
      body,
      attachmentIds,
    } = data;
    return this.post('reply', {
      data: {
        id,
        tenantId,
        orgId,
        optimisticLock,
        replyKey,
        body,
        attachmentIds,
      },
    });
  }

  @CRUD.Op({ label: '解决客服工单' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '解决客服工单',
  })
  async resolve(data: TicketCommand): Promise<TicketRecord> {
    return this.post('resolve', { data: toTicketCommand(data) });
  }

  @CRUD.Op({ label: '核验工单邮件未受理' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '核验工单邮件未受理',
  })
  async resolveOutboundUnsent(
    data: TicketUnsentReview,
  ): Promise<TicketOutboundRecord> {
    const {
      id,
      tenantId,
      orgId,
      intentId,
      intentVersion,
      verifiedUnsent,
      reason,
      evidenceRef,
    } = data;
    return this.post('resolveOutboundUnsent', {
      data: {
        id,
        tenantId,
        orgId,
        intentId,
        intentVersion,
        verifiedUnsent,
        reason,
        evidenceRef,
      },
    });
  }

  @CRUD.Op({ label: '查看客服工单' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '查看客服工单',
  })
  async retrieve(params: TicketLocator): Promise<TicketRecord> {
    return this.get('retrieve', {
      params: toGenericSupportRequestScope(params),
    });
  }

  @CRUD.Op({ label: '重试工单发送前失败' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '重试工单发送前失败',
  })
  async retryOutbound(
    data: TicketLocator & { intentId: string; intentVersion: number },
  ): Promise<TicketOutboundRecord> {
    return this.post('retryOutbound', { data });
  }

  @CRUD.Op({ label: '开始处理工单' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-客服工单',
    action: '开始处理工单',
  })
  async start(data: TicketCommand): Promise<TicketRecord> {
    return this.post('start', { data: toTicketCommand(data) });
  }
}
export const ticketService = new TicketService();
