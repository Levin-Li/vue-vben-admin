import {
  fieldAllowed,
  initializeDataAttrFieldGrants,
  loadDataAttrPolicy,
} from '@levin/admin-framework/framework-commons/data-attr-policy';
import { describe, expect, it, vi } from 'vitest';

import contract from '../api/data-attr-contract.json';
import { registerOakDataAttrContract } from '../api/register-data-attr-contract';

describe('基础模块静态字段契约', () => {
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
    ['LegalSubject', ['subject', 'maintain']],
    ['Customer', ['subject', 'sales', 'presales', 'aftersales', 'finance']],
    ['Partner', ['subject', 'sales', 'presales', 'aftersales', 'finance']],
    [
      'SupplierPartner',
      ['subject', 'sales', 'presales', 'aftersales', 'finance'],
    ],
    [
      'ChannelPartner',
      ['subject', 'sales', 'presales', 'aftersales', 'finance'],
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
    ['LegalSubject', 'update', ['subject', 'maintain']],
    [
      'SupplierPartner',
      'updateSupplierPartner',
      ['subject', 'sales', 'presales', 'aftersales', 'finance'],
    ],
    [
      'ChannelPartner',
      'updateChannelPartner',
      ['subject', 'sales', 'presales', 'aftersales', 'finance'],
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

  it('无字段分组的客户保存仍显式声明为不受字段组裁剪', async () => {
    registerOakDataAttrContract();
    initializeDataAttrFieldGrants({ version: 1, allowed: [] });
    const policy = await loadDataAttrPolicy(
      'POST',
      '/com.levin.oak.base/V1/api/Customer/saveCustomer',
    );
    expect(policy.restricted).toBe(false);
    for (const party of [
      'subject',
      'sales',
      'presales',
      'aftersales',
      'finance',
    ]) {
      expect(fieldAllowed(policy, 'input', `${party}OrgId`)).toBe(true);
      expect(fieldAllowed(policy, 'input', `${party}UserId`)).toBe(true);
    }
  });
});
