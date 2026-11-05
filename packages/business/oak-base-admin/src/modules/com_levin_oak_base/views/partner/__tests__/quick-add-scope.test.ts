import { rbacService } from '@levin/admin-framework/framework-commons/app/api/rbac-service';
import { describe, expect, it, vi } from 'vitest';

import { buildOrgAssignmentOptionsLoader } from '../../org-assignment-options';
import { changeQuickAddTenant, matchesQuickAddOrg } from '../quick-add-scope';

vi.mock(
  '@levin/admin-framework/framework-commons/app/api/rbac-service',
  () => ({
    rbacService: { fetchAuthorizedOrgTreeByTenant: vi.fn() },
  }),
);

vi.mock('../../api-module', () => ({
  buildModuleOptionsLoader: vi.fn(
    (_path, _label, _value, params) => async () =>
      params.pageIndex > 1
        ? []
        : [
            {
              code: 'same-tenant',
              label: '内部组织',
              tenantId: 'tenant-a',
              type: 'Company',
              value: 'org-a',
            },
            {
              code: 'other-tenant',
              label: '其他租户组织',
              tenantId: 'tenant-b',
              type: 'Company',
              value: 'org-b',
            },
            {
              code: 'external',
              label: '外部组织',
              tenantId: 'tenant-a',
              type: 'SupplierPartner',
              value: 'org-external',
            },
          ],
  ),
}));

describe('快捷添加的内部父组织候选', () => {
  it('按租户读取授权树，只保留完整、启用、正常的内部组织', async () => {
    vi.mocked(rbacService.fetchAuthorizedOrgTreeByTenant).mockResolvedValueOnce(
      [
        {
          id: 'a',
          name: '总部',
          tenantId: 'tenant-a',
          type: 'Company',
          state: 'Normal',
          enable: true,
          children: [
            {
              id: 'child',
              name: '销售部',
              tenantId: 'tenant-a',
              type: 'Department',
              state: 'Normal',
              enable: true,
            },
            {
              id: 'other',
              name: '跨租户',
              tenantId: 'tenant-b',
              type: 'Company',
              state: 'Normal',
              enable: true,
            },
            {
              id: 'external',
              name: '外部',
              tenantId: 'tenant-a',
              type: 'Customer',
              state: 'Normal',
              enable: true,
            },
            {
              id: 'disabled',
              name: '停用',
              tenantId: 'tenant-a',
              type: 'Team',
              state: 'Normal',
              enable: false,
            },
            {
              id: 'incomplete',
              name: '无状态',
              tenantId: 'tenant-a',
              type: 'Team',
              enable: true,
            },
          ],
        },
      ],
    );
    const options = await buildOrgAssignmentOptionsLoader('tenant-a')();
    expect(rbacService.fetchAuthorizedOrgTreeByTenant).toHaveBeenCalledWith(
      'tenant-a',
    );
    expect(options.map((option) => option.value)).toEqual(['child', 'a']);
    expect(options[0]).toMatchObject({
      label: '内部父组织 · 销售部',
      tenantId: 'tenant-a',
    });
  });

  it('已加载的授权组织支持本地搜索', async () => {
    vi.mocked(rbacService.fetchAuthorizedOrgTreeByTenant).mockResolvedValueOnce(
      [
        {
          id: 'a',
          name: '总部',
          tenantId: 'tenant-a',
          type: 'Company',
          state: 'Normal',
          enable: true,
        },
        {
          id: 'b',
          name: '销售部',
          tenantId: 'tenant-a',
          type: 'Department',
          state: 'Normal',
          enable: true,
        },
      ],
    );
    const options = await buildOrgAssignmentOptionsLoader('tenant-a')('销售');
    expect(options.map((option) => option.value)).toEqual(['b']);
  });

  it('切换租户撤销旧组织，拒绝跨租户或旧组织提交', () => {
    const scope = { tenantId: 'tenant-a', parentOrgId: 'org-a' };
    const selected = { tenantId: 'tenant-a', value: 'org-a' };
    expect(matchesQuickAddOrg(scope, selected)).toBe(true);

    expect(changeQuickAddTenant(scope, 'tenant-b')).toBe(true);
    expect(scope).toEqual({ tenantId: 'tenant-b', parentOrgId: '' });
    expect(matchesQuickAddOrg(scope, selected)).toBe(false);

    scope.parentOrgId = 'org-a';
    expect(matchesQuickAddOrg(scope, selected)).toBe(false);
  });
});
