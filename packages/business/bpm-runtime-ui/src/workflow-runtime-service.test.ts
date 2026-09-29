import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowRuntimeService } from './workflow-runtime-service';

const requestCalls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    get = requestCalls.get;

    post = requestCalls.post;

    constructor(readonly basePath: string) {}
  },
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
    requestCalls.get.mockResolvedValue([]);
    requestCalls.post.mockResolvedValue({ taskId: 'task-1' });
  });

  it('uses session-derived todo endpoints and never sends a front-end user identity', async () => {
    // 待办、已办和我发起均由后端会话识别当前用户，前端不能通过请求参数指定其它主体。
    const service = new WorkflowRuntimeService('/workflow-api');

    await service.todo();
    await service.done();
    await service.started();

    expect(requestCalls.get).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/todo',
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/done',
    );
    expect(requestCalls.get).toHaveBeenNthCalledWith(
      3,
      'workflow-runtime/started',
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
