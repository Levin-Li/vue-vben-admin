import { buildMenuRoutes } from '@levin/admin-framework/framework-commons/app/api/core/menu-route';
import {
  buildModuleSyncMenuPayload,
  buildSyncMenuPayload,
} from '@levin/admin-framework/framework-commons/app/utils/sync-menu-routes';
import { describe, expect, it } from 'vitest';

import { oakBaseAdminBackendRouteMappings } from '../../../backend-route-mappings';
import { oakBaseAdminPageMap } from '../../../page-map';

describe('领域模型通用记录页', () => {
  it('旧通用菜单不显示且同步不再生成，具体模型菜单保持可见', () => {
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'DataModelRecord',
    );
    if (!mapping) throw new Error('缺少模型页面映射');
    const routes = buildMenuRoutes(
      [
        {
          path: mapping.path,
          label: mapping.title,
          viewPath: mapping.viewPath,
        },
        {
          id: 'invoice-menu',
          path: `${mapping.path}/invoice`,
          label: '发票',
          viewPath: mapping.viewPath,
          params: { modelKey: 'invoice' },
        },
      ],
      [mapping],
    );
    expect(
      routes.find((item) => item.path === mapping.path)?.meta?.hideInMenu,
    ).toBe(true);
    expect(
      routes.find((item) => item.path === '/menu/invoice-menu')?.meta
        ?.hideInMenu,
    ).toBe(false);
    const payload = buildModuleSyncMenuPayload([
      {
        name: 'com.levin.oak.base',
        title: '基础模块',
        backendRouteMappings: [mapping],
        routes: [],
      },
    ]);
    expect(payload.menuList).toEqual([]);
    expect(
      buildSyncMenuPayload(
        [{ path: mapping.path, component: {}, meta: { title: mapping.title } }],
        'com.levin.oak.base',
        [mapping],
      ).menuList,
    ).toEqual([]);
  });
  it('只登记一个稳定页面映射，生成菜单可按 viewPath 复用', () => {
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.resource === 'DataModelRecord',
    );
    expect(mapping).toMatchObject({
      path: '/clob/V1/DataModelRecord',
      onlyRequireAuthenticated: true,
      hideInMenu: true,
      viewPath: '/system/com_levin_oak_base/data-model-record-page/index.vue',
      sourceFilePath:
        'modules/com_levin_oak_base/views/data-model-record-page/index.vue',
    });
    expect(mapping).toBeDefined();
    expect(oakBaseAdminPageMap[mapping?.viewPath || '']).toBeTypeOf('function');
    expect(mapping?.operations?.map((operation) => operation.opName)).toContain(
      'createRecord',
    );
    expect(mapping?.operations?.map((operation) => operation.opName)).toContain(
      'deleteRecord',
    );
    expect(
      oakBaseAdminBackendRouteMappings.filter(
        (item) => item.resource === 'DataModelRecord',
      ),
    ).toHaveLength(1);
  });
});
