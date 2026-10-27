import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InboxService, safeMailFileName } from '../api/inbox-service';
import { NoticeService } from '../api/notice-service';
import { NotificationAuditService } from '../api/notification-audit-service';
import { SupportMailboxSettingService } from '../api/support-mailbox-setting-service';
import { TicketQueueService } from '../api/ticket-queue-service';
import { TicketService } from '../api/ticket-service';
import { WorkflowNotificationRouteService } from '../api/workflow-notification-route-service';

const actor = vi.hoisted(() => ({
  userInfo: { platformUser: true, tenantId: 'tenant' },
}));
vi.mock('@vben/runtime/stores', () => ({ useUserStore: () => actor }));

const calls = vi.hoisted(() => ({
  get: vi.fn(),
  remove: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
}));
vi.mock('@levin/admin-framework', () => ({
  CRUD: { ListTable: () => () => {}, Op: () => () => {} },
  ResAuthorize: () => () => {},
  Service: () => () => {},
  requestClient: { request: calls.request },
  RequestService: class {
    deleteRequest = calls.remove;
    get = calls.get;
    post = calls.post;
    buildRequestPath(path: string) {
      return `/Inbox/${path}`;
    }
  },
}));
describe('邮件工单受控 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actor.userInfo = { platformUser: true, tenantId: 'tenant' };
  });
  it.each([true, false])(
    'generic Query/Id requests respect platform actor=%s without mutating UI scope',
    async (platformUser) => {
      actor.userInfo = { platformUser, tenantId: 'tenant' };
      const params = {
        tenantId: 'tenant',
        orgId: 'org',
        id: 'record',
        pageIndex: 1,
        pageSize: 20,
      };
      const expected = platformUser
        ? { ...params, orgIdList: [params.orgId] }
        : {
            orgIdList: [params.orgId],
            orgId: 'org',
            id: 'record',
            pageIndex: 1,
            pageSize: 20,
          };
      for (const ServiceClass of [
        WorkflowNotificationRouteService,
        TicketQueueService,
        SupportMailboxSettingService,
        TicketService,
        InboxService,
      ]) {
        const service = new ServiceClass();
        await service.list(params);
        expect(calls.get).toHaveBeenLastCalledWith('list', {
          params: expected,
        });
        await service.retrieve(params);
        expect(calls.get).toHaveBeenLastCalledWith('retrieve', {
          params: expected,
        });
        expect(params.tenantId).toBe('tenant');
      }
      await new WorkflowNotificationRouteService().remove(params);
      expect(calls.remove).toHaveBeenCalledWith('delete', { params: expected });
      await new NotificationAuditService().retrieve({
        id: 'delivery',
        tenantId: 'tenant',
      });
      expect(calls.get).toHaveBeenLastCalledWith('retrieve', {
        params: { id: 'delivery', tenantId: 'tenant' },
      });
    },
  );

  it.each([
    { orgIdList: ['explicit'] },
    { orgIdList: [] },
    { orgIdList: undefined },
  ])('preserves caller-owned orgIdList=%j', async ({ orgIdList }) => {
    actor.userInfo = { platformUser: false, tenantId: 'tenant' };
    const params = {
      tenantId: 'tenant',
      orgId: 'org',
      orgIdList,
      pageIndex: 1,
      pageSize: 20,
    };
    await new WorkflowNotificationRouteService().list(params);
    expect(calls.get).toHaveBeenLastCalledWith('list', {
      params: { orgId: 'org', orgIdList, pageIndex: 1, pageSize: 20 },
    });
    expect(params).toMatchObject({
      tenantId: 'tenant',
      orgId: 'org',
      orgIdList,
    });
  });
  it.each([undefined, '', ' '])(
    'does not invent an org list for empty orgId=%j',
    async (orgId) => {
      const params = { orgId, pageIndex: 1, pageSize: 20 };
      await new WorkflowNotificationRouteService().list(params);
      expect(calls.get).toHaveBeenLastCalledWith('list', { params });
      expect(params).not.toHaveProperty('orgIdList');
    },
  );

  it('本人公告仅传noticeId，不使用已删除的公告消息处理接口', async () => {
    const service = new NoticeService();
    await service.myDetail('notice-1');
    expect(calls.get).toHaveBeenCalledWith('myDetail', {
      params: { noticeId: 'notice-1' },
    });
    expect('myMessages' in service).toBe(false);
    expect('processMyMessage' in service).toBe(false);
    expect(calls.post).not.toHaveBeenCalled();
  });

  it('队列保存仅提交专用DTO，回传版本但不携带内部范围键', async () => {
    const input = {
      tenantId: 'tenant',
      orgId: 'org',
      id: 'queue',
      optimisticLock: 3,
      code: 'support',
      name: '支持队列',
      enabled: true,
      handlerUserIds: ['user'],
      handlerRoleCodes: ['handler'],
      scopeKey: 'private',
    };
    await new TicketQueueService().save(input);
    expect(calls.post).toHaveBeenCalledWith('save', {
      data: {
        tenantId: 'tenant',
        orgId: 'org',
        id: 'queue',
        optimisticLock: 3,
        code: 'support',
        name: '支持队列',
        enabled: true,
        handlerUserIds: ['user'],
        handlerRoleCodes: ['handler'],
      },
    });
  });
  it('工单回复只提交固定业务内容，不传发件身份、收件地址或状态', async () => {
    const input = {
      id: 'ticket',
      optimisticLock: 3,
      replyKey: 'reply-1',
      body: '处理完成',
      attachmentIds: ['private'],
      from: 'forged',
      to: ['outside@example.com'],
      status: 'Closed',
    };
    await new TicketService().reply(input);
    expect(calls.post).toHaveBeenCalledWith('reply', {
      data: {
        id: 'ticket',
        tenantId: undefined,
        orgId: undefined,
        optimisticLock: 3,
        replyKey: 'reply-1',
        body: '处理完成',
        attachmentIds: ['private'],
      },
    });
    await new TicketService().retryOutbound({
      id: 'ticket',
      intentId: 'intent',
      intentVersion: 7,
    });
    expect(calls.post).toHaveBeenLastCalledWith('retryOutbound', {
      data: { id: 'ticket', intentId: 'intent', intentVersion: 7 },
    });
  });

  it('未知工单外发核验绑定意图版本并只传安全证据，不发送或自动重试', async () => {
    const service = new TicketService();
    await service.resolveOutboundUnsent({
      id: 'ticket-1',
      intentId: 'intent-1',
      intentVersion: 7,
      verifiedUnsent: true,
      reason: 'VerifiedUnsent',
      evidenceRef: 'CASE-1',
      body: 'must-drop',
      secret: 'must-drop',
    } as Parameters<TicketService['resolveOutboundUnsent']>[0]);
    expect(calls.post).toHaveBeenCalledWith('resolveOutboundUnsent', {
      data: {
        id: 'ticket-1',
        tenantId: undefined,
        orgId: undefined,
        intentId: 'intent-1',
        intentVersion: 7,
        verifiedUnsent: true,
        reason: 'VerifiedUnsent',
        evidenceRef: 'CASE-1',
      },
    });
    expect(calls.post).toHaveBeenCalledTimes(1);
  });

  it('规则通过独立配置命令启停，审计核验与重试不合并', async () => {
    const command = {
      tenantId: 'tenant',
      orgId: 'org',
      id: 'rule',
      optimisticLock: 4,
    };
    await new SupportMailboxSettingService().enable(command);
    await new SupportMailboxSettingService().disable(command);
    expect(calls.post).toHaveBeenNthCalledWith(1, 'enable', { data: command });
    expect(calls.post).toHaveBeenNthCalledWith(2, 'disable', { data: command });
    const review = {
      id: 'delivery',
      optimisticLock: 9,
      reason: 'VerifiedUnsent' as const,
      verifiedUnsent: true,
      verificationRef: 'CASE-1',
    };
    await new NotificationAuditService().resolveUnsent(review);
    expect(calls.post).toHaveBeenLastCalledWith('resolveUnsent', {
      data: review,
    });
    expect(calls.post).not.toHaveBeenCalledWith('retry', expect.anything());
  });
  it('私有内容使用正常鉴权HTTP客户端，绑定来源收件ID和BlobID', async () => {
    const blob = new Blob(['private']);
    calls.request.mockResolvedValue({
      data: blob,
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': "attachment; filename*=UTF-8''mail.eml",
      },
    });
    const result = await new InboxService().download({
      id: 'inbox',
      blobId: 'private',
      tenantId: 'tenant',
    });
    expect(calls.request).toHaveBeenCalledWith('/Inbox/blob/download', {
      baseURL: '',
      method: 'GET',
      params: { id: 'inbox', blobId: 'private', tenantId: 'tenant' },
      responseReturn: 'raw',
      responseType: 'blob',
    });
    expect(result.blob).toBe(blob);
    expect(result.fileName).toBe('mail.eml');
  });
  it('下载错误响应不冒充附件；文件名去掉路径和控制字符', async () => {
    calls.request.mockResolvedValue({
      data: new Blob(['error']),
      headers: { 'content-type': 'application/json' },
    });
    await expect(
      new InboxService().download({ id: 'inbox', blobId: 'blob' }),
    ).rejects.toThrow('下载失败');
    expect(
      safeMailFileName("attachment; filename*=UTF-8''..%2Fsecret%0A.txt"),
    ).toBe('.._secret.txt');
    expect(safeMailFileName("attachment; filename*=UTF-8''%ZZ")).toBe(
      '邮件内容.bin',
    );
  });
});
