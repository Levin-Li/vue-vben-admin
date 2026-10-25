import { describe, expect, it } from 'vitest';

import {
  createOakBaseAdminCrudRoutes,
  oakBaseAdminCrudResources,
} from '../admin-crud';
import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';
import { oakBaseAdminPageMap } from '../page-map';

describe('领域数据动态模型实体页面', () => {
  it('规范路由使用实体名且保留真实业务API权限来源', () => {
    expect(
      oakBaseAdminCrudResources.find((item) => item.resource === 'DataModel'),
    ).toBeUndefined();
    expect(
      oakBaseAdminCrudResources.find(
        (item) => item.resource === 'DomainDataDynamicModel',
      ),
    ).toMatchObject({
      name: 'DomainDataDynamicModel',
      title: '领域数据动态模型',
      permissionResource: 'DataModel',
    });
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/DomainDataDynamicModel',
    );
    expect(mapping).toMatchObject({
      title: '领域数据动态模型',
      resource: 'DataModel',
      sourceFilePath:
        'modules/com_levin_oak_base/views/domain-data-dynamic-model/index.vue',
      viewPath:
        '/system/com_levin_oak_base/domain-data-dynamic-model/index.vue',
    });
    expect(
      oakBaseAdminBackendRouteMappings.some(
        (item) => item.path === '/clob/V1/DataModel',
      ),
    ).toBe(false);
    expect(
      oakBaseAdminPageMap[
        '/system/com_levin_oak_base/domain-data-dynamic-model/index.vue'
      ],
    ).toBeTypeOf('function');
    expect(
      oakBaseAdminPageMap['/system/com_levin_oak_base/data-model/index.vue'],
    ).toBeUndefined();
    const routes = createOakBaseAdminCrudRoutes();
    const tools = routes[0]?.children?.find(
      (item) => item.meta?.title === '开发&工具',
    );
    expect(
      tools?.children?.some(
        (item) => item.path === '/clob/V1/DomainDataDynamicModel',
      ),
    ).toBe(true);
  });
});
