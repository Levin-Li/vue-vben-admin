import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  permission: vi.fn(),
  register: vi.fn(),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/app/session-resources',
  () => ({ registerAdminSessionInitializer: mocks.register }),
);
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: mocks.permission }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({ buildApiMethodPermissions: () => ['workflow.catalog'] }),
);
vi.mock('../workflow-runtime-service', () => ({
  workflowRuntimeService: { catalog: mocks.catalog },
}));

async function setup() {
  const module = await import('../session-directories');
  module.registerOakSessionDirectories();
  const task = mocks.register.mock.calls.at(-1)?.[1] as {
    clear: () => void;
    load: () => Promise<void>;
  };
  return { ...module, task };
}
beforeEach(() => {
  vi.resetModules();
  mocks.catalog.mockReset();
  mocks.register.mockReset();
  mocks.permission.mockReturnValue(true);
});
describe('登录会话工作流目录', () => {
  it('页面只消费初始化结果，不发起独立目录请求', async () => {
    const { getSessionWorkflowCatalog, task } = await setup();
    expect(await getSessionWorkflowCatalog()).toEqual([]);
    expect(mocks.catalog).not.toHaveBeenCalled();
    mocks.catalog.mockResolvedValue([{ businessType: 'invoice' }]);
    await task.load();
    expect(await getSessionWorkflowCatalog()).toEqual([
      { businessType: 'invoice' },
    ]);
    expect(await getSessionWorkflowCatalog()).toHaveLength(1);
    expect(mocks.catalog).toHaveBeenCalledTimes(1);
  });
  it('没有目录权限或目录服务失败均保留空快照', async () => {
    const { getSessionWorkflowCatalog, task } = await setup();
    mocks.permission.mockReturnValue(false);
    await task.load();
    expect(mocks.catalog).not.toHaveBeenCalled();
    expect(await getSessionWorkflowCatalog()).toEqual([]);
    mocks.permission.mockReturnValue(true);
    mocks.catalog.mockRejectedValue(new Error('module missing'));
    await task.load();
    expect(await getSessionWorkflowCatalog()).toEqual([]);
    expect(await getSessionWorkflowCatalog()).toEqual([]);
    expect(mocks.catalog).toHaveBeenCalledTimes(1);
  });
  it('退出时清空目录并拒绝旧请求回填', async () => {
    const { getSessionWorkflowCatalog, task } = await setup();
    let resolveOld!: (value: unknown[]) => void;
    mocks.catalog.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const old = task.load();
    task.clear();
    mocks.catalog.mockResolvedValueOnce([{ businessType: 'new' }]);
    await task.load();
    resolveOld([{ businessType: 'old' }]);
    await old;
    expect(await getSessionWorkflowCatalog()).toEqual([
      { businessType: 'new' },
    ]);
  });
});
