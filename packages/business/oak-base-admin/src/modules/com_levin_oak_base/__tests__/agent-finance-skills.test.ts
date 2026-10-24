import { beforeEach, describe, expect, it, vi } from 'vitest';

import { financeAgentSkills } from '../agent-finance-skills';

// 仅替换网络服务与权限上下文，保留真实技能参数校验和字段投影。
const mocks = vi.hoisted(() => ({
  allowed: true,
  services: Object.fromEntries(
    [
      'payOrder',
      'fundAccount',
      'fundAccountLog',
      'settlementOrder',
      'electronicInvoice',
      'electronicContract',
      'electronicContractTemplate',
    ].map((resource) => [
      resource,
      {
        list: vi.fn(),
        retrieve: vi.fn(),
        pay: vi.fn(),
        refund: vi.fn(),
        reconcile: vi.fn(),
        submitSigning: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        payQuery: vi.fn(),
        refundQuery: vi.fn(),
        readFinancialDetails: vi.fn(),
      },
    ]),
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
vi.mock('../api/pay-order-service', () => ({
  payOrderService: mocks.services.payOrder,
}));
vi.mock('../api/fund-account-service', () => ({
  fundAccountService: mocks.services.fundAccount,
}));
vi.mock('../api/fund-account-log-service', () => ({
  fundAccountLogService: mocks.services.fundAccountLog,
}));
vi.mock('../api/settlement-order-service', () => ({
  settlementOrderService: mocks.services.settlementOrder,
}));
vi.mock('../api/electronic-invoice-service', () => ({
  electronicInvoiceService: mocks.services.electronicInvoice,
}));
vi.mock('../api/electronic-contract-service', () => ({
  electronicContractService: mocks.services.electronicContract,
}));
vi.mock('../api/electronic-contract-template-service', () => ({
  electronicContractTemplateService: mocks.services.electronicContractTemplate,
}));

const cases = [
  { resource: 'payOrder', filter: { payStatus: 'Success' } },
  { resource: 'fundAccount', filter: { currencyCode: 'CNY' } },
  { resource: 'fundAccountLog', filter: { tradeAccountId: 'account-1' } },
  { resource: 'settlementOrder', filter: { partnerId: 'partner-1' } },
  { resource: 'electronicInvoice', filter: { status: 'Issued' } },
  { resource: 'electronicContract', filter: { templateId: 'template-1' } },
  { resource: 'electronicContractTemplate', filter: { enable: true } },
];

function skill(resource: string, action: string) {
  const result = financeAgentSkills.find(
    (item) => item.id === `com.levin.oak.base.${resource}.${action}`,
  );
  if (!result?.execute) throw new Error('缺少财务只读技能');
  return { ...result, execute: result.execute };
}

function financeService(resource: string) {
  const service = mocks.services[resource];
  if (!service) throw new Error('缺少财务服务测试绑定');
  return service;
}

beforeEach(() => {
  mocks.allowed = true;
  vi.clearAllMocks();
});

describe('财务与合同 Agent 技能', () => {
  it('仅登记七类资源的列表和详情，不开放资金或供应商动作', () => {
    expect(financeAgentSkills).toHaveLength(14);
    expect(financeAgentSkills.every((item) => item.risk === 'read')).toBe(true);
    expect(
      financeAgentSkills.every((item) => /\.(?:list|retrieve)$/.test(item.id)),
    ).toBe(true);
  });

  it.each(cases)(
    '$resource 使用明确绑定的查询与详情，并过滤敏感字段',
    async ({ resource, filter }) => {
      const service = financeService(resource);
      const record = {
        id: 'record-1',
        tenantId: 'tenant-1',
        orgId: 'org-1',
        amount: '12.34',
        balance: '23.45',
        status: 'Issued',
        payStatus: 'Success',
        payeeBankAccount: { account: 'secret-bank' },
        payerInvoiceInfo: { taxId: 'secret-tax' },
        financialDetails: { secret: 'secret-financial' },
        payInfo: { secret: 'secret-payment' },
        product: { title: 'secret-product' },
        signer: { identityNo: 'secret-signer' },
        signers: [{ identityNo: 'secret-signers' }],
        invoiceReceiveEmail: 'secret@example.com',
        invoiceFileUrl: 'https://secret.example/invoice',
        fileUrl: 'https://secret.example/contract',
        signedFileUrl: 'https://secret.example/signed',
        privateKey: 'secret-key',
        arbitraryField: 'secret-arbitrary',
      };
      service.list.mockResolvedValue({ items: [record], totals: 8 });
      service.retrieve.mockResolvedValue(record);
      const list = await skill(resource, 'list').execute(
        {
          tenantId: 'tenant-1',
          orgId: 'org-1',
          limit: 2,
          pageIndex: 2,
          ...filter,
        },
        false,
      );
      const detail = await skill(resource, 'retrieve').execute(
        { id: 'record-1', tenantId: 'tenant-1', orgId: 'org-1' },
        false,
      );
      expect(service.list).toHaveBeenCalledExactlyOnceWith({
        tenantId: 'tenant-1',
        orgId: 'org-1',
        pageIndex: 2,
        pageSize: 2,
        ...filter,
      });
      expect(service.retrieve).toHaveBeenCalledExactlyOnceWith({
        id: 'record-1',
        tenantId: 'tenant-1',
        orgId: 'org-1',
      });
      expect(list.count).toBe(1);
      expect(detail.count).toBe(1);
      expect(detail.data).toMatchObject({ id: 'record-1' });
      expect(JSON.stringify([list.data, detail.data])).not.toContain('secret');
      for (const [method, spy] of Object.entries(service)) {
        if (method !== 'list' && method !== 'retrieve')
          expect(spy).not.toHaveBeenCalled();
      }
    },
  );

  it.each(cases)(
    '$resource 在请求前拒绝注入参数、越界分页和撤销权限',
    async ({ resource }) => {
      const read = skill(resource, 'list');
      for (const args of [
        { select: 'privateKey' },
        { loadOwner: true },
        { pageSize: 9999 },
        { limit: 21 },
        { pageIndex: 6 },
      ]) {
        await expect(read.execute(args, false)).rejects.toThrow();
      }
      mocks.allowed = false;
      expect(read.available?.()).toBe(false);
      await expect(read.execute({ limit: 1 }, false)).rejects.toThrow();
      await expect(
        skill(resource, 'retrieve').execute({ id: 'record-1' }, false),
      ).rejects.toThrow();
      expect(financeService(resource).list).not.toHaveBeenCalled();
      expect(financeService(resource).retrieve).not.toHaveBeenCalled();
    },
  );

  it.each(cases)(
    '$resource 对空结果和接口失败不伪造数据',
    async ({ resource }) => {
      const service = financeService(resource);
      service.list.mockResolvedValue({ items: [], totals: 0 });
      service.retrieve.mockResolvedValue(null);
      const listed = await skill(resource, 'list').execute({}, false);
      expect(listed.count).toBe(0);
      const retrieved = await skill(resource, 'retrieve').execute(
        { id: 'missing' },
        false,
      );
      expect(retrieved.count).toBe(0);
      service.list.mockRejectedValue(new Error('接口失败'));
      await expect(
        skill(resource, 'list').execute({}, false),
      ).rejects.toThrow();
    },
  );
});
