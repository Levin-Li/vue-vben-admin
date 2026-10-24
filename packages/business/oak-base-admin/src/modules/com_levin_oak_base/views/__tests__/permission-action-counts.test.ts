import { describe, expect, it } from 'vitest';

import {
  countConfiguredItems,
  getDataPermissionBadgeItems,
  getDataPermissionCount,
  getResourcePermissionBadgeItems,
  getResourcePermissionCount,
  getResourcePermissionCounts,
  getUserDataPermissionBadgeItems,
} from '../permission-action-counts';

describe('permission-action-counts', () => {
  it('counts non-empty array and string permission values', () => {
    expect(countConfiguredItems(['a', '', ' b ', null, undefined])).toBe(2);
    expect(countConfiguredItems('a,\n b\n\n,c')).toBe(3);
  });

  it('counts resource and data permission fields from a record', () => {
    expect(
      getResourcePermissionCount({
        permissionList: ['res:a', 'res:b'],
      }),
    ).toBe(2);
    expect(
      getDataPermissionCount({
        orgScopeList: [{ orgId: '1' }, { orgId: '2' }],
      }),
    ).toBe(2);
  });

  it('splits allowed and prohibited data rules for row badges', () => {
    expect(
      getDataPermissionBadgeItems({
        domainScopeList: ['domain-a'],
        orgScopeList: ['org-a'],
        deniedTenantScopeList: ['tenant-b'],
      }),
    ).toEqual([
      { count: 2, label: '允许规则', tone: 'success' },
      { count: 1, label: '禁止规则', tone: 'danger' },
    ]);
  });

  it('splits menu, operation and data-field resource rules', () => {
    const record = {
      permissionList: [
        'module:系统数据-系统菜单:home:展示',
        'module:系统数据-系统菜单:home:编辑',
        'module:系统数据-页面操作:home:导出',
        'module:DataAttrGroup:finance:access',
        'module:@value:hash:approved',
        'module:属性组:legacy:查询',
        'legacy:unknown:item:action',
      ],
    };
    expect(getResourcePermissionCounts(record)).toEqual({
      menu: 1,
      action: 3,
      field: 3,
    });
    expect(getResourcePermissionBadgeItems(record)).toEqual([
      { count: 1, label: '菜单权限', tone: 'menu' },
      { count: 3, label: '操作权限', tone: 'action' },
      { count: 3, label: '数据字段权限', tone: 'field' },
    ]);
  });

  it('counts role rules only for inherited user scope sides', () => {
    const roles = [
      {
        code: 'R_A',
        tenantId: 'tenant-1',
        domainScopeList: ['domain-a'],
        orgScopeList: ['org-a'],
        deniedOrgScopeList: ['org-b'],
      },
      {
        code: 'R_B',
        tenantId: 'tenant-1',
        domainScopeList: ['domain-a'],
        orgScopeList: ['org-c'],
      },
    ];
    expect(
      getUserDataPermissionBadgeItems(
        {
          tenantId: 'tenant-1',
          roleList: ['R_A', 'R_B'],
          domainScopeList: null,
          orgScopeList: [],
          deniedOrgScopeList: null,
        },
        roles,
      ),
    ).toEqual([
      { count: 1, label: '允许规则（含角色继承）', tone: 'success' },
      { count: 1, label: '禁止规则（含角色继承）', tone: 'danger' },
    ]);
  });
});
