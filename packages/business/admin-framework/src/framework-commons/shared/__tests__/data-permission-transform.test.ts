import { describe, expect, it } from 'vitest';

import {
  buildOrgScopeDraftsFromValue,
  splitMappedAndUnmappedPermissions,
} from '../data-permission-transform';

describe('data-permission-transform', () => {
  it('normalizes org scope values into editable drafts', () => {
    const drafts = buildOrgScopeDraftsFromValue([
      {
        isAllow: true,
        orgId: '/*',
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
