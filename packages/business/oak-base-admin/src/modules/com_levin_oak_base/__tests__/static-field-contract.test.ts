import {
  fieldAllowed,
  initializeDataAttrFieldGrants,
  loadDataAttrPolicy,
  pruneDataAttrInput,
} from '@levin/admin-framework/framework-commons/data-attr-policy';
import { describe, expect, it, vi } from 'vitest';
import { ownershipFieldAllowed } from '@levin/admin-framework/framework-commons/shared/party-ownership-policy';

import contract from '../api/data-attr-contract.json';
import { registerOakDataAttrContract } from '../api/register-data-attr-contract';

describe('基础模块静态字段契约', () => {
  it.each([
    ['Customer', ['subject', 'business', 'presales', 'aftersales', 'finance']],
    ['SupplierPartner', ['subject', 'business', 'presales', 'aftersales', 'finance']],
    ['ChannelPartner', ['subject', 'business', 'presales', 'aftersales', 'finance']],
    ['LegalSubject', ['subject', 'business']],
    ['SettlementOrder', ['payee', 'business', 'finance']],
  ] as const)('%s 的绑定和调整请求均包含全部归属字段及权限分组', (resource, parties) => {
    for (const action of ['bindOwnership', 'adjustOwnership']) {
      const policy = contract.policies.find((item) => item.methods.includes('PUT')
        && item.pathPatterns.includes(`/com.levin.oak.base/V1/api/${resource}/${action}/{group}`));
      if (!policy) throw new Error(`缺少 ${resource} ${action} 契约`);
      const fields = policy.viewRoots.request.flatMap((root) =>
        ((policy.nodes as Record<string, any>)[root]?.fields || []) as Array<{ name: string; groupIds: string[] }>);
      for (const party of parties) for (const suffix of ['OrgId', 'UserId']) {
        const field = fields.find((item) => item.name === `${party}${suffix}`);
        expect(field?.groupIds.length, `${resource}.${action}.${party}${suffix}`).toBeGreaterThan(0);
      }
    }
  });
  it.each(['bindOwnership', 'adjustOwnership'] as const)('结算单 %s 只开放获授权的归属字段', async (action) => {
    registerOakDataAttrContract();
    const declaration = contract.policies.find((item) => item.methods.includes('PUT')
      && item.pathPatterns.includes(`/com.levin.oak.base/V1/api/SettlementOrder/${action}/{group}`));
    if (!declaration?.operation) throw new Error('缺少结算单归属操作声明');
    initializeDataAttrFieldGrants({ version: 1, allowed: [{
      operation: declaration.operation, groupKeys: ['com.levin.oak.base.entities.SettlementOrder#商务'],
    }] });
    const policy = await loadDataAttrPolicy('PUT', `/com.levin.oak.base/V1/api/SettlementOrder/${action}/business`);
    for (const suffix of ['OrgId', 'UserId']) {
      expect(ownershipFieldAllowed(policy, 'input', `business${suffix}`)).toBe(true);
      expect(ownershipFieldAllowed(policy, 'input', `payee${suffix}`)).toBe(false);
      expect(ownershipFieldAllowed(policy, 'input', `finance${suffix}`)).toBe(false);
    }
  });
  it('客户敏感资料按各接口独立授权，无权限时不可显示或提交', async () => {
    registerOakDataAttrContract();
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const keys = ['contactInfo', 'shippingInfo', 'bankAccount', 'invoiceInfo'];
    for (const [method, action, direction] of [
      ['GET', 'list', 'output'], ['GET', 'retrieve', 'output'],
      ['POST', 'saveCustomer', 'input'], ['PUT', 'updateCustomer', 'input'],
    ] as const) {
      const policy = await loadDataAttrPolicy(method, `/com.levin.oak.base/V1/api/Customer/${action}`);
      expect(policy.restricted, action).toBe(true);
      for (const key of keys) expect(fieldAllowed(policy, direction, key), `${action}:${key}`).toBe(false);
      if (direction === 'input') {
        const payload = Object.fromEntries(keys.map((key) => [key, { name: '敏感资料' }]));
        const pruned = pruneDataAttrInput(policy, payload);
        for (const key of keys) expect(pruned).not.toHaveProperty(key);
      }
    }
  });

  it('客户详情银行资料授权不扩大到保存或更新接口', async () => {
    registerOakDataAttrContract();
    const path = '/com.levin.oak.base/V1/api/Customer/retrieve';
    const declaration = contract.policies.find((policy) =>
      policy.pathPatterns.includes(path) && policy.methods.includes('GET'));
    if (!declaration?.operation) throw new Error('缺少客户详情操作声明');
    initializeDataAttrFieldGrants({ version: 1, allowed: [{
      operation: declaration.operation,
      groupKeys: ['com.levin.oak.base.entities.Customer#结算账户信息'],
    }] });
    expect(fieldAllowed(await loadDataAttrPolicy('GET', path), 'output', 'bankAccount')).toBe(true);
    for (const [method, action] of [['POST', 'saveCustomer'], ['PUT', 'updateCustomer']] as const) {
      const policy = await loadDataAttrPolicy(method, `/com.levin.oak.base/V1/api/Customer/${action}`);
      expect(fieldAllowed(policy, 'input', 'bankAccount')).toBe(false);
    }
  });
  it('真实受控接口在本地结合登录许可，换号后不能沿用授权', async () => {
    registerOakDataAttrContract();
    const declaration = contract.policies.find(
      (policy) =>
        policy.pathPatterns.includes(
          '/com.levin.oak.base/V1/api/LegalSubject/retrieve',
        ) && policy.methods.includes('GET'),
    );
    expect(declaration?.restricted).toBe(true);
    expect(declaration?.groups.length).toBeGreaterThan(0);
    if (!declaration?.operation) throw new Error('缺少法律主体详情操作声明');
    expect(
      contract.policies.every((policy) =>
        policy.groups.every((group) => !('allowed' in group)),
      ),
    ).toBe(true);

    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const denied = await loadDataAttrPolicy(
      'GET',
      '/com.levin.oak.base/V1/api/LegalSubject/retrieve',
    );
    expect(fieldAllowed(denied, 'output', 'invoiceInfo')).toBe(false);

    initializeDataAttrFieldGrants({
      version: 1,
      allowed: [
        {
          operation: declaration.operation,
          groupKeys: declaration.groups
            .filter((group) => group.authorizable)
            .map((group) => group.id),
        },
      ],
    });
    const path = '/com.levin.oak.base/V1/api/LegalSubject/retrieve';
    const granted = await loadDataAttrPolicy('GET', path);
    expect(fieldAllowed(granted, 'output', 'invoiceInfo')).toBe(true);
    expect(
      granted.groups.filter((group) => group.allowed).length,
    ).toBeGreaterThan(0);
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const changedUser = await loadDataAttrPolicy('GET', path);
    expect(changedUser.groups.every((group) => !group.allowed)).toBe(true);
  });

  it('无组业务接口有明确声明，不产生缺失警告', async () => {
    registerOakDataAttrContract();
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const policy = await loadDataAttrPolicy(
        'GET',
        '/com.levin.oak.base/V1/api/TenantCustomMenu/list',
      );
      expect(policy.restricted).toBe(false);
      expect(warning).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  it.each([
    ['LegalSubject', ['subject', 'business']],
    ['Customer', ['subject', 'business', 'presales', 'aftersales', 'finance']],
    ['Partner', ['subject', 'business', 'presales', 'aftersales', 'finance']],
    [
      'SupplierPartner',
      ['subject', 'business', 'presales', 'aftersales', 'finance'],
    ],
    [
      'ChannelPartner',
      ['subject', 'business', 'presales', 'aftersales', 'finance'],
    ],
  ] as const)('%s 的主档响应只包含新的多方归属字段', (resource, parties) => {
    const policy = contract.policies.find((item) =>
      item.pathPatterns.includes(
        `/com.levin.oak.base/V1/api/${resource}/retrieve`,
      ),
    );
    if (!policy) throw new Error(`缺少 ${resource} 详情契约`);
    const roots = policy.viewRoots.response;
    const fields = roots.flatMap((root) =>
      ((policy.nodes as Record<string, any>)[root]?.fields || []).map(
        (field: { wireName: string }) => field.wireName,
      ),
    );
    for (const party of parties) {
      expect(fields).toContain(`${party}OrgId`);
      expect(fields).toContain(`${party}UserId`);
      expect(fields).toContain(`${party}Org`);
      expect(fields).toContain(`${party}User`);
    }
    expect(fields).not.toContain('orgId');
    expect(fields).not.toContain('ownerId');
  });

  it.each([
    ['LegalSubject', 'update', ['subject', 'business']],
    [
      'SupplierPartner',
      'updateSupplierPartner',
      ['subject', 'business', 'presales', 'aftersales', 'finance'],
    ],
    [
      'ChannelPartner',
      'updateChannelPartner',
      ['subject', 'business', 'presales', 'aftersales', 'finance'],
    ],
  ] as const)(
    '%s 的受字段策略控制的写入契约识别多方 ID',
    (resource, action, parties) => {
      const policy = contract.policies.find((item) =>
        item.pathPatterns.includes(
          `/com.levin.oak.base/V1/api/${resource}/${action}`,
        ),
      );
      if (!policy) throw new Error(`缺少 ${resource} 写入契约`);
      const fields = policy.viewRoots.request.flatMap((root) =>
        ((policy.nodes as Record<string, any>)[root]?.fields || []).map(
          (field: { wireName: string }) => field.wireName,
        ),
      );
      for (const party of parties) {
        expect(fields).toContain(`${party}OrgId`);
        expect(fields).toContain(`${party}UserId`);
      }
      expect(fields).not.toContain('orgId');
      expect(fields).not.toContain('ownerId');
    },
  );

  it('客户保存的参与方字段按各自归属组授权', async () => {
    registerOakDataAttrContract();
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    let policy = await loadDataAttrPolicy(
      'POST',
      '/com.levin.oak.base/V1/api/Customer/saveCustomer',
    );
    expect(policy.restricted).toBe(true);
    expect(fieldAllowed(policy, 'input', 'subjectOrgId')).toBe(false);
    const declaration = contract.policies.find((item) =>
      item.pathPatterns.includes('/com.levin.oak.base/V1/api/Customer/saveCustomer') && item.methods.includes('POST'));
    if (!declaration?.operation) throw new Error('缺少客户保存操作声明');
    initializeDataAttrFieldGrants({ version: 1, allowed: [{
      operation: declaration.operation,
      groupKeys: ['主体方', '商务', '售前', '售后', '财务'].map((name) => `com.levin.oak.base.entities.Customer#${name}`),
    }] });
    policy = await loadDataAttrPolicy('POST', '/com.levin.oak.base/V1/api/Customer/saveCustomer');
    for (const party of [
      'subject',
      'business',
      'presales',
      'aftersales',
      'finance',
    ]) {
      expect(fieldAllowed(policy, 'input', `${party}OrgId`)).toBe(true);
      expect(fieldAllowed(policy, 'input', `${party}UserId`)).toBe(true);
    }
  });

  it('新建并绑定主体的伙伴字段受控，主体草稿由主体服务单独授权', async () => {
    registerOakDataAttrContract();
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const policy = await loadDataAttrPolicy('POST', '/com.levin.oak.base/V1/api/Customer/createAndBindLegalSubject');
    expect(fieldAllowed(policy, 'input', 'partner.subjectOrgId')).toBe(false);
    expect(fieldAllowed(policy, 'input', 'subject.subjectName')).toBe(true);
    expect(fieldAllowed(policy, 'input', 'subject.businessOrgId')).toBe(true);
  });
});
