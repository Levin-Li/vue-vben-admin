import { beforeEach, describe, expect, it, vi } from 'vitest';

import { contentAgentSkills } from '../agent-content-skills';

// 各控制器使用独立 mock，防止相同方法名掩盖资源绑定错误。
const mocks = vi.hoisted(() => ({
  services: Object.fromEntries(
    [
      'article',
      'articleChannel',
      'notice',
      'simplePage',
      'simpleForm',
      'brand',
      'dict',
      'tenantSite',
      'domain',
      'scheduledTask',
      'scheduledLog',
    ].map((resource) => [resource, { list: vi.fn(), retrieve: vi.fn() }]),
  ),
  allowed: new Set<string>(),
  platformUser: true,
  tenant: { value: undefined as string | undefined },
  org: { value: undefined as string | undefined },
}));

// 元数据和当前身份与共享权限校验保持一致；业务数据投影仍使用真实实现。
vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({
    userInfo: { tenantId: 'tenant-a', platformUser: mocks.platformUser },
  }),
  useAccessStore: () => ({ accessToken: 'test-access' }),
}));
vi.mock('@levin/admin-framework/framework-commons/api-authorize', () => ({
  hasResAuthorizeMeta: () => true,
  getResAuthorizeMeta: () => ({}),
}));
vi.mock('@levin/admin-framework', async () => {
  const actual =
    await import('../../../../../admin-framework/src/framework-commons/app/ai-agent/skills');
  return {
    ...actual,
    currentGlobalTenantId: mocks.tenant,
    currentGlobalOrgId: mocks.org,
  };
});
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({
    hasPermission: (permissions: string[]) =>
      permissions.some((item) => mocks.allowed.has(item)),
  }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: (service: object, method: string) => {
      const resource = Object.entries(mocks.services).find(
        ([, candidate]) => candidate === service,
      )?.[0];
      return resource ? [`${resource}.${method}`] : [];
    },
  }),
);
vi.mock('../api/article-service', () => ({
  articleService: mocks.services.article,
}));
vi.mock('../api/article-channel-service', () => ({
  articleChannelService: mocks.services.articleChannel,
}));
vi.mock('../api/notice-service', () => ({
  noticeService: mocks.services.notice,
}));
vi.mock('../api/simple-page-service', () => ({
  simplePageService: mocks.services.simplePage,
}));
vi.mock('../api/simple-form-service', () => ({
  simpleFormService: mocks.services.simpleForm,
}));
vi.mock('../api/brand-service', () => ({ brandService: mocks.services.brand }));
vi.mock('../api/dict-service', () => ({ dictService: mocks.services.dict }));
vi.mock('../api/tenant-site-service', () => ({
  tenantSiteService: mocks.services.tenantSite,
}));
vi.mock('../api/domain-service', () => ({
  domainService: mocks.services.domain,
}));
vi.mock('../api/scheduled-task-service', () => ({
  scheduledTaskService: mocks.services.scheduledTask,
}));
vi.mock('../api/scheduled-log-service', () => ({
  scheduledLogService: mocks.services.scheduledLog,
}));

const cases = [
  ['article', { title: '标题', status: 'Draft' }],
  ['articleChannel', { containsName: '栏目', parentId: 'parent-1' }],
  ['notice', { title: '公告', status: 'Published' }],
  ['simplePage', { containsName: '页面', category: 'help' }],
  ['simpleForm', { containsName: '表单', groupName: 'main' }],
  ['brand', { name: '品牌' }],
  ['dict', { code: 'industry', category: 'base' }],
  ['tenantSite', { brandId: 'brand-1', type: 'Portal' }],
  ['domain', { lifecycleStatus: 'Active', emailReceivingEnabled: true }],
  ['scheduledTask', { name: '定时任务', enable: true }],
  [
    'scheduledLog',
    { taskId: 'task-1', isError: true, gteCreateTime: '2026-10-18T08:00:00' },
  ],
] as const;

beforeEach(() => {
  mocks.allowed.clear();
  mocks.platformUser = true;
  mocks.tenant.value = 'tenant-a';
  mocks.org.value = 'org-a';
  for (const [resource, service] of Object.entries(mocks.services)) {
    service.list.mockReset();
    service.retrieve.mockReset();
    mocks.allowed.add(`${resource}.list`);
    mocks.allowed.add(`${resource}.retrieve`);
  }
});

function serviceFor(resource: string) {
  const service = mocks.services[resource];
  if (!service) throw new Error('未登记的测试服务');
  return service;
}

function skillFor(resource: string, action: string) {
  const skill = contentAgentSkills.find(
    (item) => item.id === `com.levin.oak.base.${resource}.${action}`,
  );
  if (!skill?.execute) throw new Error('缺少显式业务查询技能');
  return { ...skill, execute: skill.execute };
}

// 逐资源验证真实服务绑定、分页参数和详情参数，避免错误接口也被认为通过。
describe('内容与站点基础配置 Agent 只读技能', () => {
  it('仅开放 11 类资源的列表和详情', () => {
    expect(contentAgentSkills).toHaveLength(22);
    expect(
      contentAgentSkills.every(
        (skill) => skill.risk === 'read' && !skill.preview,
      ),
    ).toBe(true);
  });

  it.each(cases)(
    '%s 绑定独立服务且只提交已登记过滤条件',
    async (resource, filter) => {
      const list = skillFor(resource, 'list');
      const retrieve = skillFor(resource, 'retrieve');
      const service = serviceFor(resource);
      const record = {
        id: 'record-1',
        name: '名称',
        title: '标题',
        createTime: '2026-10-18T08:00:00',
        isError: false,
      };
      service.list.mockResolvedValue({ items: [record], totals: 30 });
      service.retrieve.mockResolvedValue(record);

      const result = await list.execute(
        { ...filter, limit: 5, pageIndex: 2 },
        false,
      );
      await retrieve.execute({ id: 'record-1' }, false);
      expect(service.list).toHaveBeenCalledWith({
        ...filter,
        tenantId: 'tenant-a',
        orgId: 'org-a',
        pageIndex: 2,
        pageSize: 5,
      });
      expect(service.retrieve).toHaveBeenCalledWith({
        tenantId: 'tenant-a',
        orgId: 'org-a',
        id: 'record-1',
      });
      expect(result.data).toMatchObject({
        pageIndex: 2,
        total: 30,
        hasMore: true,
      });
      expect(result.count).toBe(1);
    },
  );

  // 所有响应都混入凭证、正文和嵌套资料，确认模型只能获得已声明摘要字段。
  it.each(cases)('%s 过滤正文、私人资料、脚本和配置凭证', async (resource) => {
    const secretRecord = {
      id: 'record-1',
      name: '可见',
      title: '可见',
      createTime: '2026-10-18T08:00:00',
      content: 'SECRET',
      body: 'SECRET',
      summary: 'SECRET',
      textContent: 'SECRET',
      exInfo: { key: 'SECRET' },
      config: { key: 'SECRET' },
      script: 'SECRET',
      domainApplyApi: 'SECRET',
      domainApplyToken: 'SECRET',
      executionContent: 'SECRET',
      executionResult: 'SECRET',
      executionSnapshot: 'SECRET',
      author: 'SECRET',
      ownerName: 'SECRET',
      commitApi: 'SECRET',
      domain: 'SECRET',
      path: 'SECRET',
      actionLog: [{ message: 'SECRET' }],
      owner: { name: 'SECRET' },
      creator: 'SECRET',
      apiKey: 'SECRET',
    };
    serviceFor(resource).list.mockResolvedValue({
      items: [secretRecord],
      totals: 1,
    });
    serviceFor(resource).retrieve.mockResolvedValue(secretRecord);
    const listed = await skillFor(resource, 'list').execute({}, false);
    const retrieved = await skillFor(resource, 'retrieve').execute(
      { id: 'record-1' },
      false,
    );
    expect(JSON.stringify([listed.data, retrieved.data])).not.toContain(
      'SECRET',
    );
    expect(retrieved.data).toMatchObject({
      id: 'record-1',
      createTime: '2026-10-18T08:00:00',
    });
  });

  // 权限会话可能在目录加载之后变化，执行时必须再次拒绝。
  it.each(cases)('%s 执行前复核权限并拒绝未知参数', async (resource) => {
    const list = skillFor(resource, 'list');
    expect(list.available?.()).toBe(true);
    await expect(
      list.execute({ selectColumns: ['domainApplyToken'] }, false),
    ).rejects.toThrow('未登记');
    await expect(list.execute({ limit: 21 }, false)).rejects.toThrow();
    await expect(list.execute({ pageIndex: 6 }, false)).rejects.toThrow();
    mocks.allowed.delete(`${resource}.list`);
    expect(list.available?.()).toBe(false);
    await expect(list.execute({}, false)).rejects.toThrow('无权');
    expect(serviceFor(resource).list).not.toHaveBeenCalled();
  });

  // 租户用户的身份由服务端可信上下文注入，通用接口线上请求不得附带 tenantId。
  it.each(cases)(
    '%s 普通租户请求省略 tenantId 并拒绝外租户范围',
    async (resource) => {
      mocks.platformUser = false;
      const service = serviceFor(resource);
      service.list.mockResolvedValue({ items: [], totals: 0 });
      service.retrieve.mockResolvedValue({ id: 'record-1' });
      await skillFor(resource, 'list').execute({}, false);
      await skillFor(resource, 'retrieve').execute({ id: 'record-1' }, false);
      expect(service.list).toHaveBeenCalledWith({
        orgId: 'org-a',
        pageIndex: 1,
        pageSize: 20,
      });
      expect(service.retrieve).toHaveBeenCalledWith({
        orgId: 'org-a',
        id: 'record-1',
      });
      mocks.tenant.value = 'tenant-other';
      await expect(
        skillFor(resource, 'list').execute({}, false),
      ).rejects.toThrow('当前登录用户');
      expect(service.list).toHaveBeenCalledTimes(1);
    },
  );

  it('在 HTTP 调用前拒绝跨当前范围、错误时间和错误布尔值', async () => {
    await expect(
      skillFor('article', 'list').execute({ tenantId: 'other' }, false),
    ).rejects.toThrow('范围');
    await expect(
      skillFor('scheduledLog', 'list').execute({ gteCreateTime: 'bad' }, false),
    ).rejects.toThrow('时间');
    await expect(
      skillFor('domain', 'list').execute(
        { emailReceivingEnabled: 'true' },
        false,
      ),
    ).rejects.toThrow('布尔');
    expect(
      Object.values(mocks.services).every(
        (service) => service.list.mock.calls.length === 0,
      ),
    ).toBe(true);
  });
});
