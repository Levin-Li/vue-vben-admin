import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowDefinitionService } from '../api/workflow-definition-service';
import { WorkflowRequestService } from '../api/workflow-request-service';

const calls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));

vi.mock('@levin/admin-framework', () => ({
  CRUD: { ListTable: () => () => {}, Op: () => () => {} },
  ResAuthorize: () => () => {},
  Service: () => () => {},
  requestClient: {},
  rbacService: {},
  RequestService: class {
    get = calls.get;
    post = calls.post;
    put = calls.put;
  },
}));

describe('流程申请业务 API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('稳定定义不会伪保存仅属于版本正文的用途字段', async () => {
    const service = new WorkflowDefinitionService();
    const input = {
      name: '合同审核',
      processKey: 'contract-review',
      businessType: 'workflow-request',
      purposeKey: 'not-a-root-field',
    };
    await service.create(input);
    expect(calls.post).toHaveBeenCalledWith('create', {
      data: {
        name: '合同审核',
        processKey: 'contract-review',
        businessType: 'workflow-request',
      },
    });
  });

  it('本页明确选择的范围随CRUD请求传递，不改全局Header或信任表单残留归属', async () => {
    let scope = { tenantId: 'tenant-a', orgId: 'org-a' };
    const service = new WorkflowRequestService(
      () => scope,
      () => ({ superAdmin: true }),
    );
    const input = {
      title: '申请',
      amount: 0,
      category: 'review',
      documentsComplete: false,
      tenantId: 'forged',
    };
    await service.create(input);
    expect(calls.post).toHaveBeenCalledWith('create', {
      data: {
        title: '申请',
        amount: 0,
        category: 'review',
        documentsComplete: false,
        tenantId: 'tenant-a',
        orgId: 'org-a',
      },
    });
    scope = { tenantId: 'tenant-b', orgId: 'org-b' };
    await service.list({ pageSize: 10 });
    expect(calls.get).toHaveBeenCalledWith('list', {
      params: { pageSize: 10, tenantId: 'tenant-b', orgId: 'org-b' },
    });
  });

  it('租户管理员四类请求核对同租户后省略受保护tenantId，保留业务组织定位', async () => {
    const scope = { tenantId: 'tenant-a', orgId: 'org-a' };
    const service = new WorkflowRequestService(
      () => scope,
      () => ({ tenantId: 'tenant-a', superAdmin: false, platformAdmin: false }),
    );
    const input = {
      title: '申请',
      amount: 1,
      category: 'review',
      documentsComplete: true,
    };
    await service.create(input);
    await service.list({ pageSize: 10 });
    await service.retrieve({ id: 'record-a', ...scope });
    await service.update({ ...input, id: 'record-a', optimisticLock: 1 });
    expect(calls.post).toHaveBeenCalledWith('create', {
      data: { ...input, orgId: 'org-a' },
    });
    expect(calls.get).toHaveBeenNthCalledWith(1, 'list', {
      params: { pageSize: 10, orgId: 'org-a' },
    });
    expect(calls.get).toHaveBeenNthCalledWith(2, 'retrieve', {
      params: { id: 'record-a', orgId: 'org-a' },
    });
    expect(calls.put).toHaveBeenCalledWith('update', {
      data: { ...input, id: 'record-a', optimisticLock: 1, orgId: 'org-a' },
      autoForceUpdateField: false,
    });
  });

  it('租户用户遇到外租户引用或身份范围缺失时拒绝发送，不静默删除冲突字段', () => {
    const service = new WorkflowRequestService(undefined, () => ({
      tenantId: 'tenant-a',
    }));
    expect(() =>
      service.retrieve({
        id: 'record-b',
        tenantId: 'tenant-b',
        orgId: 'org-b',
      }),
    ).toThrow('不属于当前会话租户');
    const unknown = new WorkflowRequestService(undefined, () => ({}));
    expect(() =>
      unknown.retrieve({ id: 'record-a', tenantId: 'tenant-a' }),
    ).toThrow('不属于当前会话租户');
    expect(calls.get).not.toHaveBeenCalled();
  });

  it('旧身份字段不能授予跨租户范围', () => {
    const service = new WorkflowRequestService(undefined, () => ({
      tenantId: 'tenant-a',
      saasAdmin: true,
    }));
    expect(() =>
      service.retrieve({ id: 'record-b', tenantId: 'tenant-b' }),
    ).toThrow('不属于当前会话租户');
    expect(calls.get).not.toHaveBeenCalled();
  });

  it('平台管理主体仍明确传出租户；页面范围与业务引用冲突不以页面选择覆盖', async () => {
    for (const actor of [
      { superAdmin: true },
      { platformAdmin: true },
      { isPlatformAdmin: true },
    ]) {
      const service = new WorkflowRequestService(undefined, () => actor);
      await service.retrieve({
        id: 'record-b',
        tenantId: 'tenant-b',
        orgId: 'org-b',
      });
      expect(calls.get).toHaveBeenLastCalledWith('retrieve', {
        params: { id: 'record-b', tenantId: 'tenant-b', orgId: 'org-b' },
      });
    }
    const selected = new WorkflowRequestService(
      () => ({ tenantId: 'tenant-a', orgId: 'org-a' }),
      () => ({ superAdmin: true }),
    );
    expect(() =>
      selected.retrieve({ id: 'record-b', tenantId: 'tenant-b' }),
    ).toThrow('页面选择与业务引用租户不一致');
  });

  it('创建只提交业务输入，不允许携带归属、流程状态或结果字段', async () => {
    const service = new WorkflowRequestService();
    const input = {
      title: '合同审查',
      amount: '12.30',
      category: 'contract',
      documentsComplete: false,
      ownerId: 'forged',
      tenantId: 'forged',
      resultSummary: '伪造通过',
      status: 'Approved',
    };
    await service.create(input);
    expect(calls.post).toHaveBeenCalledWith('create', {
      data: {
        title: '合同审查',
        amount: '12.30',
        category: 'contract',
        documentsComplete: false,
      },
    });
  });

  it('更新保留记录定位与乐观锁，不把只读结果送回服务器', async () => {
    const service = new WorkflowRequestService();
    await service.update({
      id: 'request-1',
      optimisticLock: 7,
      title: '资料补齐',
      amount: 0,
      category: 'contract',
      documentsComplete: true,
    });
    expect(calls.put).toHaveBeenCalledWith('update', {
      data: {
        id: 'request-1',
        optimisticLock: 7,
        title: '资料补齐',
        amount: 0,
        category: 'contract',
        documentsComplete: true,
      },
      autoForceUpdateField: false,
    });
  });

  it('详情与列表通过查询参数传递，查询不会启动流程', async () => {
    const service = new WorkflowRequestService();
    await service.retrieve({ id: 'request-1' });
    await service.list({ pageIndex: 2, pageSize: 10 });
    expect(calls.get).toHaveBeenNthCalledWith(1, 'retrieve', {
      params: { id: 'request-1' },
    });
    expect(calls.get).toHaveBeenNthCalledWith(2, 'list', {
      params: { pageIndex: 2, pageSize: 10 },
    });
    expect(calls.post).not.toHaveBeenCalled();
  });
});
