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

// 新目录和记录选择器延续当前租户的受保护参数处理，不能把外租户选择静默删除。
describe('发起页选择器范围', () => {
  it('普通租户省略tenantId但保留分页和技术契约，平台保留明确选择', async () => {
    calls.get.mockClear();
    const service = new OakWorkflowRuntimeService(undefined, () => ({
      tenantId: 'tenant-a',
    }));
    await service.manualStarts({
      tenantId: 'tenant-a',
      pageIndex: 2,
      pageSize: 20,
    });
    await service.businessRecords({
      tenantId: 'tenant-a',
      businessType: 'request',
      contractVersion: '2',
      pageIndex: 3,
      pageSize: 20,
    });
    expect(calls.get).toHaveBeenNthCalledWith(
      1,
      'workflow-runtime/manualStarts',
      { params: { pageIndex: 2, pageSize: 20 } },
    );
    expect(calls.get).toHaveBeenNthCalledWith(
      2,
      'workflow-runtime/businessRecords',
      {
        params: {
          businessType: 'request',
          contractVersion: '2',
          pageIndex: 3,
          pageSize: 20,
        },
      },
    );
    const platform = new OakWorkflowRuntimeService(undefined, () => ({
      superAdmin: true,
    }));
    await platform.manualStarts({
      tenantId: 'tenant-a',
      pageIndex: 1,
      pageSize: 20,
    });
    expect(calls.get).toHaveBeenLastCalledWith(
      'workflow-runtime/manualStarts',
      { params: { tenantId: 'tenant-a', pageIndex: 1, pageSize: 20 } },
    );
  });
  it('跨租户选择器请求被拦截且不发送网络请求', () => {
    calls.get.mockClear();
    const service = new OakWorkflowRuntimeService(undefined, () => ({
      tenantId: 'tenant-b',
    }));
    expect(() => service.manualStarts({ tenantId: 'tenant-a' })).toThrow(
      '不属于当前会话租户',
    );
    expect(() =>
      service.businessRecords({
        tenantId: 'tenant-a',
        businessType: 'request',
        contractVersion: '2',
      }),
    ).toThrow('不属于当前会话租户');
    expect(calls.get).not.toHaveBeenCalled();
  });
});

// 已有平台身份字段只表达明确范围意图，网络接口仍执行最终租户与对象授权。
describe('平台身份标记范围传递', () => {
  it.each(['platformUser', 'isPlatformUser', 'isSuperAdmin'])(
    '%s保留明确租户选择及完整选择/发起命令',
    async (flag) => {
      calls.get.mockClear();
      calls.post.mockClear();
      const service = new OakWorkflowRuntimeService(undefined, () => ({
        [flag]: true,
      }));
      await service.manualStarts({
        tenantId: 'tenant-a',
        pageIndex: 1,
        pageSize: 20,
      });
      expect(calls.get).toHaveBeenCalledWith('workflow-runtime/manualStarts', {
        params: { tenantId: 'tenant-a', pageIndex: 1, pageSize: 20 },
      });
      const command = {
        ...reference,
        contractVersion: '2',
        purposeKey: 'review',
        idempotencyKey: 'selected-contract',
      };
      await service.start(command);
      expect(calls.post).toHaveBeenCalledWith(
        'workflow-runtime/business/start',
        { data: command },
      );
    },
  );
});
