import { describe, expect, it } from 'vitest';

import { baseDraftOf, scopeKindOf, toBaseSaveInput } from '../model-form';

describe('领域模型基础信息提交', () => {
  it('没有可信组织时新建草稿不预选归属，提交前要求明确选择', () => {
    expect(baseDraftOf().scopeKind).toBeUndefined();
    expect(() => toBaseSaveInput(baseDraftOf(), true)).toThrow(
      '请选择归属范围',
    );
  });

  it('由归属 ID 推导范围，基础请求不包含字段和归属 ID', () => {
    const existing = {
      key: 'invoice',
      name: 'Invoice',
      title: '发票',
      tenantId: 'tenant-1',
      orgId: 'org-1',
      ownerId: 'user-1',
      tenantShared: true,
      orgShared: true,
      version: 3,
      fields: [
        {
          key: 'amount',
          name: 'amount',
          title: '金额',
          type: 'MONEY' as const,
          nullable: false,
        },
      ],
    };
    expect(scopeKindOf(existing)).toBe('PRIVATE');
    const payload = toBaseSaveInput(baseDraftOf(existing), false);
    expect(payload).toEqual({
      key: 'invoice',
      name: 'Invoice',
      title: '发票',
      description: undefined,
      scopeKind: 'PRIVATE',
      tenantShared: true,
      orgShared: true,
      version: 3,
    });
    expect(payload).not.toHaveProperty('fields');
    expect(payload).not.toHaveProperty('tenantId');
    expect(payload).not.toHaveProperty('orgId');
  });

  it('平台归属清除无效共享标志，管理员只在私人范围提交所选所有者', () => {
    const base = {
      key: 'demo',
      name: 'Demo',
      title: '演示',
      scopeKind: 'PLATFORM' as const,
      tenantShared: true,
      orgShared: true,
      ownerId: 'other',
    };
    const platform = toBaseSaveInput(base, true);
    expect(platform).not.toHaveProperty('tenantShared');
    expect(platform).not.toHaveProperty('orgShared');
    expect(platform).not.toHaveProperty('ownerId');
    expect(
      toBaseSaveInput({ ...base, scopeKind: 'PRIVATE' }, true).ownerId,
    ).toBe('other');
  });
});
