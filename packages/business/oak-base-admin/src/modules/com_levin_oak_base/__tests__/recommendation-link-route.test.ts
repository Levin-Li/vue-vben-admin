import { describe, expect, it } from 'vitest';

import {
  createOakBaseAdminCrudRoutes,
  oakBaseAdminCrudResources,
} from '../admin-crud';
import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';

describe('邀请注册链接管理入口', () => {
  it('归入已有用户权限分组并上传真实页面与操作元数据', () => {
    expect(
      oakBaseAdminCrudResources.some(
        (item) => item.resource === 'RecommendationLink',
      ),
    ).toBe(true);
    const groups = createOakBaseAdminCrudRoutes()[0]?.children || [];
    const owners = groups.filter((group) =>
      group.children?.some(
        (route) => route.path === '/clob/V1/RecommendationLink',
      ),
    );
    expect(owners).toHaveLength(1);
    expect(owners[0]?.meta?.title).toBe('用户&权限');
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'RecommendationLink',
    );
    expect(mapping?.path).toBe('/clob/V1/RecommendationLink');
    expect(mapping?.viewPath).toBe(
      '/system/com_levin_oak_base/recommendation-link/index.vue',
    );
    expect(mapping?.sourceFilePath).toBe(
      'modules/com_levin_oak_base/views/recommendation-link/index.vue',
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
  });
});
