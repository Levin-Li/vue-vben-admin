import type { WorkflowRequestActor } from '../api/workflow-request-service';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OakWorkflowRuntimeService,
  workflowRuntimeService,
} from '../api/workflow-runtime-service';

const calls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  store: vi.fn(),
}));
vi.mock('@levin/admin-framework', () => ({
  CRUD: { ListTable: () => () => {}, Op: () => () => {} },
  ResAuthorize: () => () => {},
  Service: () => () => {},
  rbacService: {},
  RequestService: class {
    get = calls.get;
    post = calls.post;
  },
}));
vi.mock('@vben/runtime/stores', () => ({ useUserStore: calls.store }));

// 捕获模块初始化时的访问次数，防止单例在Pinia就绪前读取用户。
const importTimeStoreReads = calls.store.mock.calls.length;
const reference = {
  businessType: 'workflow-request',
  businessId: 'r1',
  tenantId: 'tenant-a',
  orgId: 'org-a',
};
const round = {
  ...reference,
  contractVersion: '1',
  expectedRoundId: 'round-1',
  expectedRevision: 'revision-3',
  idempotencyKey: 'key-1',
};
const cases = [
  { method: 'eligibility', verb: 'get', field: 'params', input: reference },
  { method: 'history', verb: 'get', field: 'params', input: reference },
  {
    method: 'start',
    verb: 'post',
    field: 'data',
    input: { ...reference, purposeKey: 'review', idempotencyKey: 'start-key' },
  },
  {
    method: 'roundState',
    verb: 'get',
    field: 'params',
    input: { ...reference, contractVersion: '1' },
  },
  { method: 'newRound', verb: 'post', field: 'data', input: round },
  {
    method: 'resubmit',
    verb: 'post',
    field: 'data',
    input: { ...round, sourceRunId: 'run-1', purposeKey: 'review' },
  },
  {
    method: 'retry',
    verb: 'post',
    field: 'data',
    input: { ...reference, dispatchId: 'dispatch-1' },
  },
] as const;

describe('oak运行时业务范围连接器', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.store.mockReturnValue({ userInfo: { tenantId: 'tenant-a' } });
  });

  it('单例构造不读取用户，实际请求每次读取当前会话', async () => {
    expect(importTimeStoreReads).toBe(0);
    await workflowRuntimeService.roundState({
      ...reference,
      contractVersion: '1',
    });
    expect(calls.store).toHaveBeenCalledTimes(1);
    calls.store.mockReturnValue({ userInfo: { tenantId: 'tenant-b' } });
    expect(() =>
      workflowRuntimeService.roundState({ ...reference, contractVersion: '1' }),
    ).toThrow('不属于当前会话租户');
    expect(calls.get).toHaveBeenCalledTimes(1);
  });

  it.each(cases)(
    '$method同租户剥离tenantId并保留完整业务命令，不修改原输入',
    async ({ method, verb, field, input }) => {
      const service = new OakWorkflowRuntimeService(undefined, () => ({
        tenantId: 'tenant-a',
      }));
      const frozen = Object.freeze({ ...input });
      const before = { ...input };
      await Reflect.apply(service[method], service, [frozen]);
      const { tenantId: _tenantId, ...expected } = before;
      expect(calls[verb]).toHaveBeenCalledWith(
        `workflow-runtime/business/${method}`,
        { [field]: expected },
      );
      expect(frozen).toEqual(before);
      expect(calls[verb].mock.calls[0]?.[1]?.[field]).not.toHaveProperty(
        'tenantId',
      );
    },
  );

  it.each(cases)(
    '$method跨租户或会话归属未知时不发送任何网络请求',
    ({ method, input }) => {
      for (const actor of [{ tenantId: 'tenant-b' }, {}]) {
        const service = new OakWorkflowRuntimeService(undefined, () => actor);
        expect(() => Reflect.apply(service[method], service, [input])).toThrow(
          '不属于当前会话租户',
        );
      }
      expect(calls.get).not.toHaveBeenCalled();
      expect(calls.post).not.toHaveBeenCalled();
    },
  );

  it.each(cases)(
    '$method为超级管理员和平台管理员保留显式租户及全部参数',
    async ({ method, verb, field, input }) => {
      for (const actor of [
        { superAdmin: true },
        { platformAdmin: true },
        { isPlatformAdmin: true },
      ]) {
        const service = new OakWorkflowRuntimeService(undefined, () => actor);
        await Reflect.apply(service[method], service, [input]);
        expect(calls[verb]).toHaveBeenLastCalledWith(
          `workflow-runtime/business/${method}`,
          { [field]: input },
        );
      }
    },
  );

  it('幂等重试不丢来源、轮次、修订或标识，当前主体改变时重新核验', async () => {
    let actor: WorkflowRequestActor = { tenantId: 'tenant-a' };
    const service = new OakWorkflowRuntimeService(undefined, () => actor);
    const command = Object.freeze({
      ...round,
      sourceRunId: 'run-1',
      purposeKey: 'review',
    });
    calls.post.mockRejectedValueOnce(new Error('响应丢失'));
    await expect(service.resubmit(command)).rejects.toThrow('响应丢失');
    await service.resubmit(command);
    expect(calls.post.mock.calls[1]).toEqual(calls.post.mock.calls[0]);
    expect(calls.post.mock.calls[1]?.[1]?.data).toMatchObject({
      sourceRunId: 'run-1',
      purposeKey: 'review',
      expectedRoundId: 'round-1',
      expectedRevision: 'revision-3',
      contractVersion: '1',
      idempotencyKey: 'key-1',
    });
    actor = { tenantId: 'tenant-b' };
    expect(() => service.resubmit(command)).toThrow('不属于当前会话租户');
    expect(calls.post).toHaveBeenCalledTimes(2);
  });
});
