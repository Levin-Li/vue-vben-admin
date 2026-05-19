import { describe, expect, it } from 'vitest';

import { createOakBaseAdminModule } from '../module';
import { oakBaseAdminRoutes } from '../routes';

describe('oak base admin routes', () => {
  it('registers the tenant setting page in the explicit route table', () => {
    expect(oakBaseAdminRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          meta: expect.objectContaining({
            crudResource: 'SettingForTenant',
            title: '租户系统设置',
          }),
          name: 'AdminCrudSettingForTenant',
          path: '/clob/V1/SettingForTenant',
        }),
      ]),
    );
  });

  it('keeps the tenant setting route when generated CRUD routes are disabled', () => {
    const module = createOakBaseAdminModule({ crud: false });

    expect(module.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/clob/V1/SettingForTenant',
        }),
      ]),
    );
  });
});
