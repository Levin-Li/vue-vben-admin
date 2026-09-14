import { describe, expect, it } from 'vitest';

import {
  buildCrudTemplateScopePayload,
  canDeleteCrudTemplateByOwnership,
  canShowCrudTemplateDelete,
  getCrudTemplateDeleteParams,
  getCrudTemplateOwnershipLabel,
  normalizeCreatedCrudTemplate,
  normalizeCrudTemplateList,
  removeCrudTemplateFromList,
} from '../crud-template-service';

const user = {
  id: 'user-1',
  orgId: 'org-1',
  tenantId: 'tenant-1',
};

describe('crud template service', () => {
  it.each([
    [
      'personal',
      {
        orgId: 'org-1',
        orgShared: false,
        ownerId: 'user-1',
        tenantId: 'tenant-1',
        tenantShared: false,
      },
    ],
    [
      'platform',
      {
        orgId: null,
        orgShared: true,
        ownerId: null,
        tenantId: null,
        tenantShared: true,
      },
    ],
    [
      'tenant',
      {
        orgId: null,
        orgShared: true,
        ownerId: null,
        tenantId: 'tenant-1',
        tenantShared: false,
      },
    ],
    [
      'org',
      {
        orgId: 'org-1',
        orgShared: false,
        ownerId: null,
        tenantId: 'tenant-1',
        tenantShared: false,
      },
    ],
  ] as const)('builds the %s sharing payload', (scope, expectedPayload) => {
    expect(buildCrudTemplateScopePayload(scope, user)).toEqual(expectedPayload);
  });

  it('labels template ownership with the most specific returned owner field', () => {
    expect(
      getCrudTemplateOwnershipLabel({ name: '个人', ownerId: 'user-1' }),
    ).toBe('个人');
    expect(
      getCrudTemplateOwnershipLabel({
        name: '个人优先',
        orgId: 'org-1',
        ownerId: 'user-1',
        tenantId: 'tenant-1',
      }),
    ).toBe('个人');
    expect(
      getCrudTemplateOwnershipLabel({ name: '组织', orgId: 'org-1' }),
    ).toBe('组织');
    expect(
      getCrudTemplateOwnershipLabel({ name: '租户', tenantId: 'tenant-1' }),
    ).toBe('租户');
    expect(getCrudTemplateOwnershipLabel({ name: '平台' })).toBeUndefined();
  });

  it('only permits deletion for the template owner or the matching sharing administrator', () => {
    expect(
      canDeleteCrudTemplateByOwnership(
        { editable: true, name: '个人', ownerId: 'user-1' },
        user,
      ),
    ).toBe(true);
    expect(
      canDeleteCrudTemplateByOwnership(
        { editable: true, name: '租户', tenantId: 'tenant-1' },
        { ...user, tenantAdmin: true },
      ),
    ).toBe(true);
    expect(
      canDeleteCrudTemplateByOwnership(
        { editable: true, name: '组织', orgId: 'org-1' },
        { ...user, orgAdmin: true },
      ),
    ).toBe(true);
    expect(
      canDeleteCrudTemplateByOwnership(
        {
          editable: true,
          name: '平台',
          orgShared: true,
          tenantId: null,
          tenantShared: true,
        },
        user,
      ),
    ).toBe(false);
    expect(
      canDeleteCrudTemplateByOwnership(
        { editable: false, name: '只读', ownerId: 'user-1' },
        { ...user, topSuperAdmin: true },
      ),
    ).toBe(false);
    expect(
      canDeleteCrudTemplateByOwnership(
        { editable: true, name: '平台', tenantId: null },
        { ...user, topSuperAdmin: true },
      ),
    ).toBe(true);
  });

  it('requires the delete API permission in addition to ownership', () => {
    const template = { editable: true, name: '个人', ownerId: 'user-1' };

    expect(
      canShowCrudTemplateDelete({
        hasDeletePermission: false,
        template,
        userInfo: user,
      }),
    ).toBe(false);
    expect(
      canShowCrudTemplateDelete({
        hasDeletePermission: true,
        template,
        userInfo: user,
      }),
    ).toBe(true);
  });

  it('normalizes create/list responses and deletes by stable identity', () => {
    expect(
      normalizeCreatedCrudTemplate({ data: { id: 8, name: '导出' } }),
    ).toEqual({
      id: 8,
      name: '导出',
    });
    expect(
      normalizeCrudTemplateList({ items: [{ id: 8, name: '导出' }] }),
    ).toEqual([{ id: 8, name: '导出' }]);
    expect(getCrudTemplateDeleteParams({ id: 8, name: '导出' })).toEqual({
      id: '8',
    });
    expect(
      getCrudTemplateDeleteParams({ code: 'legacy', name: '旧模板' }),
    ).toBe(undefined);
    expect(
      removeCrudTemplateFromList(
        [
          { id: 8, name: '导出' },
          { code: 'keep', name: '保留' },
        ],
        { id: 8, name: '导出' },
      ),
    ).toEqual([{ code: 'keep', name: '保留' }]);
  });
});
