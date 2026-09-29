import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowExpenseService } from '../api/workflow-expense-service';

const calls = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@levin/admin-framework', () => ({
  CRUD: { ListTable: () => () => {}, Op: () => () => {} },
  ResAuthorize: () => () => {},
  Service: () => () => {},
  rbacService: {},
  RequestService: class {
    get = calls.get;
  },
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: {} }),
}));

describe('报销只读API作用域', () => {
  beforeEach(() => vi.clearAllMocks());

  it('同租户主体省略受保护tenantId并保留对象与组织定位', async () => {
    const service = new WorkflowExpenseService(() => ({
      tenantId: 'tenant-a',
    }));
    await service.retrieve({
      id: 'expense-1',
      tenantId: 'tenant-a',
      orgId: 'org-a',
    });
    expect(calls.get).toHaveBeenCalledWith('retrieve', {
      params: { id: 'expense-1', orgId: 'org-a' },
    });
  });

  it.each([
    { superAdmin: true },
    { platformAdmin: true },
    { isPlatformAdmin: true },
  ])('平台授权主体保留显式租户选择', async (actor) => {
    const service = new WorkflowExpenseService(() => actor);
    await service.retrieve({
      id: 'expense-1',
      tenantId: 'tenant-a',
      orgId: 'org-a',
    });
    expect(calls.get).toHaveBeenCalledWith('retrieve', {
      params: { id: 'expense-1', tenantId: 'tenant-a', orgId: 'org-a' },
    });
  });

  it.each([{ tenantId: 'tenant-b' }, {}])(
    '跨租户或身份归属缺失拒绝发送，不删除冲突租户继续请求',
    (actor) => {
      const service = new WorkflowExpenseService(() => actor);
      expect(() =>
        service.retrieve({
          id: 'expense-1',
          tenantId: 'tenant-a',
          orgId: 'org-a',
        }),
      ).toThrow('不属于当前会话租户');
      expect(calls.get).not.toHaveBeenCalled();
    },
  );
});
