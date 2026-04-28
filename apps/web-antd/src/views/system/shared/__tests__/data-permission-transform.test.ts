import { describe, expect, it } from 'vitest';

import {
  buildOrgScopeDraftsFromValue,
  collectPermissionValues,
  getTenantMatchingExpressionLabel,
  mergeUnmappedPermissions,
  removePermissionValue,
  splitMappedAndUnmappedPermissions,
  toggleOrgScopeDraft,
} from '../data-permission-transform';

describe('data-permission-transform', () => {
  it('adds a new org scope draft when selecting a new org', () => {
    const next = toggleOrgScopeDraft([], {
      id: 'org-1',
      title: '总部',
    });

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      isAllow: true,
      orgScopeExpression: '/**',
      orgScopeExpressionType: 'IdPath',
      orgId: 'org-1',
      orgName: '总部',
      templateKey: 'All',
      tenantMatchingExpression: '_DEFAULT_TENANT_',
    });
  });

  it('formats tenant matching expression labels from OrgScope constants', () => {
    expect(getTenantMatchingExpressionLabel('_DEFAULT_TENANT_')).toBe(
      '默认租户',
    );
    expect(getTenantMatchingExpressionLabel('*')).toBe('所有租户');
    expect(getTenantMatchingExpressionLabel('')).toBe('无租户');
    expect(getTenantMatchingExpressionLabel('#!groovy:_tenant != null')).toBe(
      'Groovy：_tenant != null',
    );
  });

  it('removes the draft when the selected org already exists', () => {
    const next = toggleOrgScopeDraft(
      [
        {
          isAllow: true,
          mode: 'template',
          orgId: 'org-1',
          orgName: '总部',
          orgScopeExpression: '/org-1/**',
          orgScopeExpressionType: 'IdPath',
          templateKey: 'current-and-children',
          tenantMatchingExpression: '_DEFAULT_TENANT_',
        },
      ],
      {
        id: 'org-1',
        title: '总部',
      },
    );

    expect(next).toEqual([]);
  });

  it('keeps unmapped permissions when merging selected permissions', () => {
    expect(
      mergeUnmappedPermissions(['module:a:1:view'], ['legacy:res:*:edit']),
    ).toEqual(['module:a:1:view', 'legacy:res:*:edit']);
  });

  it('deduplicates checked permissions', () => {
    expect(
      collectPermissionValues(['perm:view', 'perm:view', 'perm:edit']),
    ).toEqual(['perm:view', 'perm:edit']);
  });

  it('converts backend org scopes into editor drafts', () => {
    expect(
      buildOrgScopeDraftsFromValue([
        {
          expressionType: 'Ant',
          isAllow: false,
          orgId: 'org-2',
          orgScopeExpression: '/org-2/**',
          tenantExpression: '*',
        },
      ]),
    ).toEqual([
      {
        expressionType: 'Ant',
        isAllow: false,
        mode: 'advanced',
        orgId: 'org-2',
        orgScopeExpression: '/org-2/**',
        orgScopeExpressionType: 'Ant',
        templateKey: 'Custom',
        tenantExpression: '*',
        tenantMatchingExpression: '*',
      },
    ]);
  });

  it('removes one permission value from a permission list', () => {
    expect(
      removePermissionValue(
        ['known:perm:view', 'legacy:perm:edit'],
        'legacy:perm:edit',
      ),
    ).toEqual(['known:perm:view']);
  });

  it('maps wildcard role permissions to concrete permission expressions', () => {
    expect(
      splitMappedAndUnmappedPermissions(
        ['com.levin.oak.base:系统数据-角色::*'],
        [
          {
            id: 'module',
            typeList: [
              {
                id: 'type',
                resList: [
                  {
                    actionList: [
                      {
                        permissionExpr:
                          'com.levin.oak.base:系统数据-角色::查询列表',
                      },
                      {
                        permissionExpr:
                          'com.levin.oak.base:系统数据-角色::修改',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      ),
    ).toEqual({
      mapped: [
        'com.levin.oak.base:系统数据-角色::查询列表',
        'com.levin.oak.base:系统数据-角色::修改',
      ],
      unmapped: [],
    });
  });
});
