import { describe, expect, it } from 'vitest';

import {
  createOakBaseAdminCrudRoutes,
  oakBaseAdminCrudResources,
} from '../src/modules/com_levin_oak_base';
import { oakBaseAdminBackendRouteMappings } from '../src/modules/com_levin_oak_base/backend-route-mappings';

describe('oak base admin crud resources', () => {
  it('uses the current rbac permission item page instead of the removed permission page', () => {
    expect(oakBaseAdminCrudResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: 'RbacPermissionItem',
          title: '权限项定义',
        }),
      ]),
    );
    expect(
      oakBaseAdminCrudResources.some((item) => item.resource === 'Permission'),
    ).toBe(false);
    expect(
      oakBaseAdminBackendRouteMappings.some(
        (item) => item.path === '/clob/V1/Permission',
      ),
    ).toBe(false);
  });

  it('uses the backend generated local page path for the crud root route', () => {
    const [rootRoute] = createOakBaseAdminCrudRoutes();

    expect(rootRoute).toEqual(
      expect.objectContaining({
        name: 'AdminCrudPages',
        path: '/clob/V1/index',
      }),
    );
    expect(rootRoute?.children?.[0]).toEqual(
      expect.objectContaining({
        path: expect.stringMatching(/^\/clob\/V1\/[A-Z]/),
      }),
    );
  });
});
