import { describe, expect, it, vi } from 'vitest';

import { buildModuleOptionsLoader } from '../../api-module';
import { buildOrgAssignmentOptionsLoader } from '../../org-assignment-options';
import { changeQuickAddTenant, matchesQuickAddOrg } from '../quick-add-scope';

vi.mock('../../api-module', () => ({
  buildModuleOptionsLoader: vi.fn(() => async () => [
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
  ]),
}));

describe('快捷添加的内部父组织候选', () => {
  it('查询时带入所选租户，只保留该租户的内部组织', async () => {
    const options = await buildOrgAssignmentOptionsLoader('tenant-a')();

    expect(buildModuleOptionsLoader).toHaveBeenCalledWith(
      '/Org/list',
      'name',
      'id',
      expect.objectContaining({ tenantId: 'tenant-a' }),
      'containsName',
    );
    expect(options.map((option) => option.value)).toEqual(['org-a']);
    expect(options[0]?.label).toBe('内部父组织 · 内部组织');
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
