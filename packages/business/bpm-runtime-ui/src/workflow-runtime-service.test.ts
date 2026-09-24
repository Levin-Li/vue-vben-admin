import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestCalls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@levin/admin-framework', () => ({
  RequestService: class {
    constructor(readonly basePath: string) {}

    get = requestCalls.get;

    post = requestCalls.post;
  },
}));

import { WorkflowRuntimeService } from './workflow-runtime-service';

describe('WorkflowRuntimeService', () => {
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

    expect(requestCalls.get).toHaveBeenNthCalledWith(1, 'workflow-runtime/todo');
    expect(requestCalls.get).toHaveBeenNthCalledWith(2, 'workflow-runtime/done');
    expect(requestCalls.get).toHaveBeenNthCalledWith(3, 'workflow-runtime/started');
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

    expect(requestCalls.post).toHaveBeenNthCalledWith(1, 'workflow-runtime/complete', { data: completion });
    expect(requestCalls.post).toHaveBeenNthCalledWith(2, 'workflow-runtime/step-up-auth/prepare', {
      data: {
        actionCode: 'approve',
        formSummary: 'sha256:example',
        taskId: 'task-1',
        verificationType: 'SMS',
      },
    });
  });
});
