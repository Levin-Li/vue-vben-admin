import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminAgentSkills } from '../agent-admin-skills';

// 网络与授权替身保留真实技能校验，验证每个实际服务绑定与模型出站摘要。
const mocks = vi.hoisted(() => ({
  allowed: true,
  services: Object.fromEntries(
    ['user', 'role', 'tenant', 'servicePlugin', 'servicePluginSetting'].map(
      (resource) => [
        resource,
        {
          list: vi.fn(),
          retrieve: vi.fn(),
          update: vi.fn(),
          create: vi.fn(),
          delete: vi.fn(),
          clearCache: vi.fn(),
        },
      ],
    ),
  ) as Record<
    string,
    {
      [method: string]: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
      retrieve: ReturnType<typeof vi.fn>;
    }
  >,
}));
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: { tenantId: 't1', platformUser: true } }),
  useAccessStore: () => ({ accessToken: 'test' }),
}));
vi.mock('@levin/admin-framework', async () => ({
  ...(await import('../../../../../admin-framework/src/framework-commons/app/ai-agent/skills')),
  currentGlobalTenantId: { value: undefined },
  currentGlobalOrgId: { value: undefined },
}));
vi.mock('@levin/admin-framework/framework-commons/api-authorize', () => ({
  hasResAuthorizeMeta: () => true,
  getResAuthorizeMeta: () => ({}),
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => mocks.allowed }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (_service: unknown, method: string) => [method],
  }),
);
vi.mock('../api/user-service', () => ({ userService: mocks.services.user }));
vi.mock('../api/role-service', () => ({ roleService: mocks.services.role }));
vi.mock('../api/tenant-service', () => ({
  tenantService: mocks.services.tenant,
}));
vi.mock('../api/service-plugin-service', () => ({
  servicePluginService: mocks.services.servicePlugin,
}));
vi.mock('../api/service-plugin-setting-service', () => ({
  servicePluginSettingService: mocks.services.servicePluginSetting,
}));

const cases = [
  {
    resource: 'user',
    filter: { state: 'Normal' },
    scope: { tenantId: 't1', orgId: 'o1' },
    params: { tenantId: 't1', orgId: 'o1' },
  },
  {
    resource: 'role',
    filter: { code: 'R_SUPPORT' },
    scope: { tenantId: 't1', orgId: 'o1' },
    params: { tenantId: 't1' },
  },
  { resource: 'tenant', filter: { level: 'Standard' }, scope: {}, params: {} },
  {
    resource: 'servicePlugin',
    filter: { categoryName: 'AI' },
    scope: {},
    params: {},
  },
  {
    resource: 'servicePluginSetting',
    filter: { servicePluginProviderCode: 'deepseek' },
    scope: { tenantId: 't1', orgId: 'o1' },
    params: { tenantId: 't1' },
  },
];
function skill(resource: string, action: string) {
  const item = adminAgentSkills.find(
    (entry) => entry.id === `com.levin.oak.base.${resource}.${action}`,
  );
  if (!item?.execute) throw new Error('缺少基础配置技能');
  return { ...item, execute: item.execute };
}
function service(resource: string) {
  const item = mocks.services[resource];
  if (!item) throw new Error('缺少基础配置服务');
  return item;
}
beforeEach(() => {
  mocks.allowed = true;
  vi.clearAllMocks();
});

describe('基础配置状态 Agent 技能', () => {
  it('仅登记五类列表和详情，不允许配置凭证或权限', () => {
    expect(adminAgentSkills).toHaveLength(10);
    expect(
      adminAgentSkills.every(
        (item) => item.risk === 'read' && /\.(?:list|retrieve)$/.test(item.id),
      ),
    ).toBe(true);
  });
  it.each(cases)(
    '$resource 按实际查询范围绑定服务并剔除全部敏感配置',
    async ({ resource, filter, scope, params }) => {
      const api = service(resource);
      const record = {
        id: 'record-1',
        nickname: '客服',
        name: '管理配置',
        code: 'code-1',
        enable: true,
        usageCount: 12,
        remainingLicenseCnt: 8,
        password: 'secret-password',
        tenantKey: 'secret-tenant-key',
        mfaSecretKey: 'secret-mfa',
        appSecret: 'secret-app',
        encryptKey: 'secret-encrypt',
        loginName: 'secret-login',
        email: 'secret-email',
        telephone: 'secret-phone',
        contractPerson: 'secret-person',
        contractPhone: 'secret-contact',
        permissionList: ['secret-permission'],
        orgScopeList: ['secret-scope'],
        assignPreCondition: 'secret-expression',
        value: { apiKey: 'secret-key' },
        baseConfig: { apiKey: 'secret-base' },
        configEditor: 'secret-script',
        providerList: [{ apiKey: 'secret-provider' }],
        exInfo: { secret: 'secret-extra' },
      };
      api.list.mockResolvedValue({ items: [record], totals: 7 });
      api.retrieve.mockResolvedValue(record);
      const listed = await skill(resource, 'list').execute(
        { ...scope, ...filter, limit: 2, pageIndex: 2 },
        false,
      );
      const retrieved = await skill(resource, 'retrieve').execute(
        { ...scope, id: 'record-1' },
        false,
      );
      expect(api.list).toHaveBeenCalledExactlyOnceWith({
        ...params,
        ...filter,
        pageIndex: 2,
        pageSize: 2,
      });
      expect(api.retrieve).toHaveBeenCalledExactlyOnceWith({
        ...params,
        id: 'record-1',
      });
      expect(listed.count).toBe(1);
      expect(retrieved.count).toBe(1);
      expect(retrieved.data).toMatchObject({ id: 'record-1', enable: true });
      expect(JSON.stringify([listed.data, retrieved.data])).not.toContain(
        'secret',
      );
      for (const [method, call] of Object.entries(api)) {
        if (method !== 'list' && method !== 'retrieve')
          expect(call).not.toHaveBeenCalled();
      }
    },
  );
  it.each(cases)(
    '$resource 拒绝非法参数并在执行前复核权限',
    async ({ resource }) => {
      const read = skill(resource, 'list');
      for (const args of [
        { password: 'bad' },
        { value: {} },
        { loadServicePlugin: true },
        { enable: 'true' },
        { limit: 21 },
        { pageIndex: 6 },
      ]) {
        await expect(read.execute(args, false)).rejects.toThrow();
      }
      mocks.allowed = false;
      expect(read.available?.()).toBe(false);
      await expect(read.execute({}, false)).rejects.toThrow();
      await expect(
        skill(resource, 'retrieve').execute({ id: 'record-1' }, false),
      ).rejects.toThrow();
      expect(service(resource).list).not.toHaveBeenCalled();
      expect(service(resource).retrieve).not.toHaveBeenCalled();
    },
  );
  it.each(cases)(
    '$resource 空结果和异常不报告执行成功',
    async ({ resource }) => {
      const api = service(resource);
      api.list.mockResolvedValue({ items: [], totals: 0 });
      api.retrieve.mockResolvedValue(null);
      const listed = await skill(resource, 'list').execute({}, false);
      const retrieved = await skill(resource, 'retrieve').execute(
        { id: 'missing' },
        false,
      );
      expect(listed.count).toBe(0);
      expect(retrieved.data).toBeNull();
      api.list.mockRejectedValue(new Error('接口失败'));
      await expect(
        skill(resource, 'list').execute({}, false),
      ).rejects.toThrow();
    },
  );
});
