import { describe, expect, it, vi } from 'vitest';

import { userPageCrudConfig } from '../config';

vi.mock('../../../api/user-service', () => ({
  userService: {
    buildRequestPath: (path: string) =>
      `/com.levin.oak.base/V1/api/User/${path}`,
  },
}));

vi.mock('../../api-module', () => ({
  tenantOptionsLoader: async () => [],
}));

describe('user page config', () => {
  it('queries field policies through the actual CRUD endpoints', () => {
    expect(userPageCrudConfig.dataAttrTargets).toMatchObject({
      create: {
        method: 'POST',
        path: '/com.levin.oak.base/V1/api/User/create',
      },
      update: { method: 'PUT', path: '/com.levin.oak.base/V1/api/User/update' },
      delete: {
        method: 'DELETE',
        path: '/com.levin.oak.base/V1/api/User/delete',
      },
      list: { method: 'GET', path: '/com.levin.oak.base/V1/api/User/list' },
      retrieve: {
        method: 'GET',
        path: '/com.levin.oak.base/V1/api/User/retrieve',
      },
    });
  });
  it('renders MFA enrollment as a form with an explicit QR field', () => {
    const mfaQrAction = userPageCrudConfig.rowActions?.find(
      (action) => action.label === 'MFA二维码',
    );

    expect(mfaQrAction).toMatchObject({
      successAction: 'showForm',
    });

    expect(userPageCrudConfig.fields).toContainEqual(
      expect.objectContaining({
        form: false,
        fullRow: true,
        key: 'mfaQrCode',
        table: false,
        type: 'qrcode',
      }),
    );
  });

  it('shows the nested organization name with an organization ID fallback', () => {
    const orgField = userPageCrudConfig.fields.find(
      (field) => field.key === 'orgName',
    );

    expect(
      orgField?.tableValue?.({ org: { name: '研发中心' }, orgId: 'org-1' }),
    ).toBe('研发中心');
    expect(orgField?.tableValue?.({ orgId: 'org-1' })).toBe('org-1');
  });

  it('supports district-level area selection in CRUD forms and list queries', () => {
    expect(userPageCrudConfig.fields).toContainEqual(
      expect.objectContaining({
        areaCascader: {
          selectableLevels: ['district'],
          valueKey: 'areaCode',
        },
        key: 'areaCode',
        search: true,
        table: true,
        type: 'area-cascader',
      }),
    );
  });
});
