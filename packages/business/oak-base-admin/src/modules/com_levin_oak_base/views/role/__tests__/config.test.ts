import { describe, expect, it, vi } from 'vitest';

import { useRolePageConfig } from '../config';

vi.mock('../../../api/role-service', () => ({
  roleService: {},
}));

vi.mock('../../api-module', () => ({
  confidentialLevelOptionsLoader: async () => [],
  moduleFetchDictOptions: () => async () => [],
  roleOptionsLoader: async () => [],
  tenantOptionsLoader: async () => [],
}));

vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildCrudOperationPermissions: () => 'Role:update',
  }),
);

describe('role page config', () => {
  it('shows role constraint fields as single-line tooltip table columns', () => {
    const { config } = useRolePageConfig();
    const fields = config.value.fields;

    for (const key of [
      'coexistRoleList',
      'exclusiveRoleList',
      'assignPreCondition',
    ]) {
      const field = fields.find((item) => item.key === key) as any;

      expect(field, key).toBeTruthy();
      expect(field.table, key).toBe(true);
      expect(field.cellSingleLine, key).toBe(true);
      expect(field.cellTooltip, key).not.toBe(false);
      expect(field.help, key).toEqual(expect.any(String));
      expect(field.help.length, key).toBeGreaterThan(30);
    }
  });

  it('starts role list constraints on separate form rows', () => {
    const { config } = useRolePageConfig();

    for (const key of ['exclusiveRoleList', 'coexistRoleList']) {
      const field = config.value.fields.find((item) => item.key === key) as any;

      expect(field, key).toBeTruthy();
      expect(field.layoutNewRow, key).toBe(true);
    }
  });

  it('limits role assignment precondition form field to super admins', () => {
    const { config } = useRolePageConfig();
    const field = config.value.fields.find(
      (item) => item.key === 'assignPreCondition',
    ) as any;

    expect(field).toBeTruthy();
    expect(field.formVisibleForSuperAdmin).toBe(true);
  });

  it('rejects creating overlapping mutually exclusive and coexisting roles', async () => {
    const { config } = useRolePageConfig();

    await expect(
      config.value.transformSubmit?.(
        {
          coexistRoleList: ['R_ADMIN', 'R_CUSTOMER'],
          exclusiveRoleList: ['R_CUSTOMER', 'R_AGENT'],
        },
        null,
      ),
    ).rejects.toThrow('互斥角色列表和必须共存角色列表不能同时包含：R_CUSTOMER');
  });

  it('rejects editing overlapping mutually exclusive and coexisting roles', async () => {
    const { config } = useRolePageConfig();

    await expect(
      config.value.transformSubmit?.(
        {
          coexistRoleList: ['R_ADMIN', 'R_CUSTOMER'],
          exclusiveRoleList: ['R_CUSTOMER', 'R_AGENT'],
        },
        { id: 'role-1' },
      ),
    ).rejects.toThrow('互斥角色列表和必须共存角色列表不能同时包含：R_CUSTOMER');
  });

  it('allows saving role constraints when the role lists do not overlap', async () => {
    const { config } = useRolePageConfig();

    await expect(
      config.value.transformSubmit?.(
        {
          coexistRoleList: ['R_ADMIN'],
          exclusiveRoleList: ['R_CUSTOMER'],
        },
        { id: 'role-1' },
      ),
    ).resolves.toMatchObject({
      coexistRoleList: ['R_ADMIN'],
      exclusiveRoleList: ['R_CUSTOMER'],
    });
  });
});
