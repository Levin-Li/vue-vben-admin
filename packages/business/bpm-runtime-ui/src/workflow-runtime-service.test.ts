import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowRuntimeService } from './workflow-runtime-service';

const requestCalls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    get = requestCalls.get;

    post = requestCalls.post;

    constructor(readonly basePath: string) {}

    buildRequestPath(path: string) {
      return `${this.basePath}/${path}`;
    }
  },
}));

vi.mock('@levin/admin-framework/framework-commons/runtime', () => ({
  requestClient: { upload: requestCalls.upload },
}));

describe('workflowRuntimeService', () => {
  it('显式作用域通过查询参数和请求正文传递，不依赖自定义Header', async () => {
    const service = new WorkflowRuntimeService();
    const reference = {
      businessType: 'workflow-request',
      businessId: 'r1',
      tenantId: 't1',
      orgId: 'o1',
    };
    await service.eligibility(reference);
    await service.history(reference);
    await service.roundState({ ...reference, contractVersion: '1' });
    await service.start({
      ...reference,
      purposeKey: 'review',
      idempotencyKey: 'key',
    });
    await service.retry({ ...reference, dispatchId: 'd1' });
    await service.newRound({
      ...reference,
      contractVersion: '1',
      expectedRevision: '3',
      expectedRoundId: 'round-1',
      idempotencyKey: 'round-key',
    });
    await service.resubmit({
      ...reference,
      contractVersion: '1',
      expectedRevision: '3',
      expectedRoundId: 'round-1',
      purposeKey: 'review',
      idempotencyKey: 'resubmit-1',
      sourceRunId: 'run-1',
    });
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/business/eligibility',
      { params: reference },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/business/history',
      { params: reference },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      3,
      'workflow-runtime/business/roundState',
      { params: { ...reference, contractVersion: '1' } },
    );
    expect(requestCalls.post).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/business/start',
      { data: { ...reference, purposeKey: 'review', idempotencyKey: 'key' } },
    );
    expect(requestCalls.post).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/business/retry',
      { data: { ...reference, dispatchId: 'd1' } },
    );
    expect(requestCalls.post).toHaveBeenNthCalledWith(
      3,
      'workflow-runtime/business/newRound',
      {
        data: {
          ...reference,
          contractVersion: '1',
          expectedRevision: '3',
          expectedRoundId: 'round-1',
          idempotencyKey: 'round-key',
        },
      },
    );
    expect(requestCalls.post).toHaveBeenNthCalledWith(
      4,
      'workflow-runtime/business/resubmit',
      {
        data: {
          ...reference,
          contractVersion: '1',
          expectedRevision: '3',
          expectedRoundId: 'round-1',
          purposeKey: 'review',
          idempotencyKey: 'resubmit-1',
          sourceRunId: 'run-1',
        },
      },
    );
  });

  it('恢复业务交付只提交业务引用和原交付标识', async () => {
    const service = new WorkflowRuntimeService();
    const command = {
      businessType: 'workflow-request',
      businessId: 'r1',
      dispatchId: 'd1',
    };
    await service.retry(command);
    expect(requestCalls.post).toHaveBeenCalledWith(
      'workflow-runtime/business/retry',
      { data: command },
    );
  });

  beforeEach(() => {
    requestCalls.get.mockReset();
    requestCalls.post.mockReset();
    requestCalls.upload.mockReset();
    requestCalls.get.mockResolvedValue([]);
    requestCalls.post.mockResolvedValue({ taskId: 'task-1' });
    requestCalls.upload.mockResolvedValue({ id: 'private-1', attached: false });
  });

  it('私有附件只通过任务上传并以 ID 列表和 Blob 下载，不拼公开 URL', async () => {
    const service = new WorkflowRuntimeService('/workflow-api');
    const file = new File(['private'], 'evidence.txt', { type: 'text/plain' });
    requestCalls.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        new Blob(['private'], { type: 'application/octet-stream' }),
      );
    await service.uploadAttachment('task-1', file);
    await service.attachments('instance-1');
    await service.downloadAttachment('private-1');
    expect(requestCalls.upload).toHaveBeenCalledWith(
      '/workflow-api/workflow-runtime/attachment/upload',
      { taskId: 'task-1', file },
      { baseURL: '' },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/attachment/list',
      { params: { instanceId: 'instance-1' } },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/attachment/download',
      { params: { id: 'private-1' }, responseType: 'blob' },
    );
  });

  it('拒绝下载接口的 JSON 错误 Blob，不能把无权响应保存成附件', async () => {
    const service = new WorkflowRuntimeService('/workflow-api');
    requestCalls.get.mockResolvedValue(
      new Blob(['{"code":10000}'], { type: 'application/json' }),
    );
    await expect(service.downloadAttachment('private-denied')).rejects.toThrow(
      '下载未授权',
    );
  });

  it('待绑定附件的恢复和撤销只提交当前任务与私有附件标识', async () => {
    const service = new WorkflowRuntimeService('/workflow-api');
    await service.pendingAttachments('task-1');
    await service.deletePendingAttachment('task-1', 'private-1');
    expect(requestCalls.get).toHaveBeenCalledWith(
      'workflow-runtime/attachment/pending',
      { params: { taskId: 'task-1' } },
    );
    expect(requestCalls.post).toHaveBeenCalledWith(
      'workflow-runtime/attachment/deletePending',
      { data: { taskId: 'task-1', id: 'private-1' } },
    );
  });

  it('uses session-derived todo endpoints and never sends a front-end user identity', async () => {
    // 待办、已办和我发起均由后端会话识别当前用户，前端不能通过请求参数指定其它主体。
    const service = new WorkflowRuntimeService('/workflow-api');

    await service.todo({ size: 20 });
    await service.done({ cursor: 'done-cursor', size: 20 });
    await service.started({ size: 20 });
    await service.copied({ size: 20 });

    expect(requestCalls.get).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/todo',
      { params: { size: 20 } },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/done',
      { params: { cursor: 'done-cursor', size: 20 } },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      3,
      'workflow-runtime/started',
      { params: { size: 20 } },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      4,
      'workflow-runtime/copied',
      { params: { size: 20 } },
    );
  });

  it('显式抄送只提交实例和接收人标识', async () => {
    const service = new WorkflowRuntimeService();
    await service.copy({ instanceId: 'i1', recipientUserIds: ['u1'] });
    expect(requestCalls.post).toHaveBeenCalledWith('workflow-runtime/copy', {
      data: { instanceId: 'i1', recipientUserIds: ['u1'] },
    });
  });

  it('抄送候选由当前实例专用接口查询，不访问全局用户列表', async () => {
    const service = new WorkflowRuntimeService();
    await service.copyRecipients('instance-1', '小王');
    expect(requestCalls.get).toHaveBeenCalledWith(
      'workflow-runtime/copy-recipients',
      { params: { instanceId: 'instance-1', keyword: '小王' } },
    );
  });

  it('submits only task action/form data and requests step-up verification separately', async () => {
    // 二次验证码仅作为当前动作请求载荷传递，调用方没有 userId 字段可伪造审批主体。
    const service = new WorkflowRuntimeService('/workflow-api');
    const completion = {
      actionCode: 'approve',
      formData: { reason: '预算内' },
      formSummary: 'sha256:example',
      taskId: 'task-1',
      verificationCode: '123456',
      verificationType: 'SMS',
    };

    await service.complete(completion);
    await service.prepareStepUpAuth({
      actionCode: 'approve',
      formSummary: 'sha256:example',
      taskId: 'task-1',
      verificationType: 'SMS',
    });

    expect(requestCalls.post).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/complete',
      { data: completion },
    );
    expect(requestCalls.post).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/step-up-auth/prepare',
      {
        data: {
          actionCode: 'approve',
          formSummary: 'sha256:example',
          taskId: 'task-1',
          verificationType: 'SMS',
        },
      },
    );
  });

  it('按完整业务引用查询资格与历史，发起不伪造身份、轮次或版本', async () => {
    const service = new WorkflowRuntimeService();
    const reference = {
      businessType: 'workflow-request',
      businessId: 'request-1',
    };
    await service.eligibility(reference);
    await service.history(reference);
    await service.start({
      ...reference,
      purposeKey: 'review',
      idempotencyKey: 'request-key',
    });
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/business/eligibility',
      { params: reference },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/business/history',
      { params: reference },
    );
    expect(requestCalls.post).toHaveBeenCalledWith(
      'workflow-runtime/business/start',
      {
        data: {
          ...reference,
          purposeKey: 'review',
          idempotencyKey: 'request-key',
        },
      },
    );
  });
});

// 发起目录与记录独立有界读取，但实际发起仍使用原 start 接口。
describe('手动流程授权选择服务', () => {
  it('按正式控制器路径传递分页和显式契约，不提交用户身份', async () => {
    requestCalls.get.mockClear();
    const service = new WorkflowRuntimeService();
    await service.manualStarts({ tenantId: 't1', pageIndex: 2, pageSize: 20 });
    await service.businessRecords({
      tenantId: 't1',
      businessType: 'request',
      contractVersion: '2',
      pageIndex: 3,
      pageSize: 20,
    });
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/manualStarts',
      { params: { tenantId: 't1', pageIndex: 2, pageSize: 20 } },
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/businessRecords',
      {
        params: {
          tenantId: 't1',
          businessType: 'request',
          contractVersion: '2',
          pageIndex: 3,
          pageSize: 20,
        },
      },
    );
  });
});
