import { describe, expect, it } from 'vitest';

import {
  assertUserTenantOrg,
  changeUserTenant,
  tenantOrgChoices,
} from '../user-tenant-org';

const tree = [
  {
    key: '__tenant__:a',
    label: '租户甲',
    virtual: true,
    children: [
      {
        key: 'org-a',
        label: '甲公司',
        tenantId: 'a',
        children: [{ key: 'org-a-child', label: '甲部门' }],
      },
    ],
  },
  {
    key: '__tenant__:b',
    label: '租户乙',
    virtual: true,
    children: [{ key: 'org-b', label: '乙公司', tenantId: 'b' }],
  },
];

describe('组织与用户表单的租户组织联动', () => {
  it('切换租户会清空旧组织，重新选择后只接受目标租户的授权组织', () => {
    const state: Record<string, any> = { tenantId: 'a', orgId: 'org-a-child' };
    changeUserTenant(state, 'b');
    expect(state).toEqual({ tenantId: 'b', orgId: undefined });
    expect(tenantOrgChoices(tree, 'b').map((node) => node.key)).toEqual([
      'org-b',
    ]);
    expect(() => assertUserTenantOrg(tree, 'b', 'org-a')).toThrow(
      '所属组织不属于所选租户',
    );
    expect(() => assertUserTenantOrg(tree, 'b', 'org-b')).not.toThrow();
  });

  it('同一租户保持已选组织，子组织继承父节点的租户', () => {
    const state: Record<string, any> = { tenantId: 'a', orgId: 'org-a-child' };
    changeUserTenant(state, 'a');
    expect(state.orgId).toBe('org-a-child');
    expect(() => assertUserTenantOrg(tree, 'a', 'org-a-child')).not.toThrow();
    expect(() => assertUserTenantOrg(tree, 'a', '')).toThrow('请选择归属租户');
  });
});
