import { describe, expect, it } from 'vitest';

import {
  createOakBaseAdminCrudRoutes,
  oakBaseAdminCrudResources,
} from '../admin-crud';
import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';
import { oakBaseAdminRoutes } from '../routes';

describe('邀请链接管理入口', () => {
  it('归入已有用户权限分组并上传真实页面与操作元数据', () => {
    expect(
      oakBaseAdminCrudResources.some(
        (item) => item.resource === 'InvitationLink',
      ),
    ).toBe(true);
    const groups = createOakBaseAdminCrudRoutes()[0]?.children || [];
    const owners = groups.filter((group) =>
      group.children?.some((route) => route.path === '/clob/V1/InvitationLink'),
    );
    expect(owners).toHaveLength(1);
    expect(owners[0]?.meta?.title).toBe('用户&权限');
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'InvitationLink',
    );
    expect(mapping?.path).toBe('/clob/V1/InvitationLink');
    expect(mapping?.viewPath).toBe(
      '/system/com_levin_oak_base/invitation-link/index.vue',
    );
    expect(mapping?.sourceFilePath).toBe(
      'modules/com_levin_oak_base/views/invitation-link/index.vue',
    );
    expect(mapping?.operations?.map((item) => item.opName)).toEqual(
      expect.arrayContaining([
        'createInternal',
        'createMember',
        'createCustomer',
        'createSupplierPartner',
        'createChannelPartner',
        'copyLink',
        'revoke',
      ]),
    );
    expect(
      oakBaseAdminRoutes.some(
        (route) => route.path === '/clob/V1/RecommendationLink',
      ),
    ).toBe(false);
  });
});
