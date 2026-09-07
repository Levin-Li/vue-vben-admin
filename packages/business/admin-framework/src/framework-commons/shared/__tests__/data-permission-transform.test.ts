import { describe, expect, it } from 'vitest';

import {
  buildOrgScopeDraftsFromValue,
  getTenantMatchingExpressionLabel,
  isOrgScopeValid,
  serializeOrgScopes,
  splitMappedAndUnmappedPermissions,
} from '../data-permission-transform';

describe('data-permission-transform', () => {
  it('normalizes org scope values into editable drafts', () => {
    const drafts = buildOrgScopeDraftsFromValue([
      {
        isAllow: true,
        orgId: '/*',
        orgScopeMatchingMode: 'All',
        orgScopeExpression: '/**',
        orgScopeExpressionType: 'IdPath',
        tenantMatchingExpression: '*',
      },
    ]);

    expect(drafts[0]).toMatchObject({
      mode: 'template',
      orgId: '/*',
      orgScopeExpressionType: 'IdPath',
      templateKey: 'All',
      tenantMatchingExpression: '*',
    });
  });

  it('maps role permissions through the pure permission tree matcher', () => {
    const result = splitMappedAndUnmappedPermissions(
      ['com.demo:角色:*', 'legacy:wide:*'],
      [],
      [
        {
          id: 'root',
          name: '权限',
          nodeType: 'Group',
          children: [
            {
              id: 'role-list',
              name: '角色查询',
              nodeType: 'Permission',
              permissionExpr: 'com.demo:角色:查询',
            },
            {
              id: 'role-edit',
              name: '角色编辑',
              nodeType: 'Permission',
              permissionExpr: 'com.demo:角色:编辑',
            },
          ],
        },
      ],
    );

    expect(result.mapped).toEqual(['com.demo:角色:查询', 'com.demo:角色:编辑']);
    expect(result.unmapped).toEqual(['legacy:wide:*']);
  });
});

describe('数据权限模式往返与授权语义', () => {
  it.each(['All', 'OnlySelf', 'OnlyDirectChild', 'SelfAndDirectChild'])(
    '%s预设不要求表达式并保留拒绝规则',
    (mode) => {
      const drafts = buildOrgScopeDraftsFromValue([
        {
          orgId: '/*',
          orgScopeMatchingMode: mode,
          isAllow: false,
          orgScopeExpression: '',
          orgScopeExpressionType: null,
          tenantMatchingExpression: '',
        },
      ]);
      expect(drafts[0]?.templateKey).toBe(mode);
      expect(drafts.every((item) => isOrgScopeValid(item))).toBe(true);
      expect(serializeOrgScopes(drafts, false)).toEqual([
        {
          orgId: '/*',
          orgScopeMatchingMode: mode,
          isAllow: false,
          orgScopeExpression: '',
          orgScopeExpressionType: null,
          tenantMatchingExpression: '',
        },
      ]);
    },
  );
  it.each([undefined, null, '', '_DEFAULT_TENANT_', '*', 'tenant-1'])(
    '保留租户条件%j的语义',
    (value) => {
      const expected = value === undefined ? '_DEFAULT_TENANT_' : (value ?? '');
      const drafts = buildOrgScopeDraftsFromValue([
        {
          orgId: '_USER_ORG_',
          orgScopeMatchingMode: 'All',
          isAllow: true,
          tenantMatchingExpression: value,
        },
      ]);
      expect(drafts[0]?.tenantMatchingExpression).toBe(expected);
      expect(
        serializeOrgScopes(drafts, true)[0]?.tenantMatchingExpression,
      ).toBe(expected);
      if (value === null || value === '')
        expect(getTenantMatchingExpressionLabel(value)).toBe('无租户');
    },
  );
  it('显式自定义路径不推断为预设，普通用户不能保存', () => {
    const drafts = buildOrgScopeDraftsFromValue([
      {
        orgId: '/*',
        orgScopeMatchingMode: 'Custom',
        isAllow: true,
        orgScopeExpression: '/**',
        orgScopeExpressionType: 'IdPath',
      },
    ]);
    expect(drafts[0]?.templateKey).toBe('Custom');
    expect(serializeOrgScopes(drafts, true)[0]?.orgScopeMatchingMode).toBe(
      'Custom',
    );
    expect(() => serializeOrgScopes(drafts, false)).toThrow('超级管理员');
    expect(serializeOrgScopes(drafts, true)[0]).not.toHaveProperty(
      'templateKey',
    );
  });
  it('无模式和不完整自定义对超管同样拒绝', () => {
    for (const item of [
      { orgId: '/*', isAllow: true, orgScopeExpression: '/**' },
      { orgId: '/*', isAllow: true, orgScopeMatchingMode: 'Unknown' },
      {
        orgId: '/*',
        isAllow: true,
        orgScopeMatchingMode: 'Custom',
        orgScopeExpression: '  ',
        orgScopeExpressionType: 'Groovy',
      },
      {
        orgId: '/*',
        isAllow: true,
        orgScopeMatchingMode: 'Custom',
        orgScopeExpression: '/**',
        orgScopeExpressionType: null,
      },
    ])
      expect(() => serializeOrgScopes([item], true)).toThrow('完善');
  });
});
