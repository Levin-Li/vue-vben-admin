import { buildMenuRoutes } from '@levin/admin-framework/framework-commons/app/api/core/menu-route';
import { describe, expect, it } from 'vitest';

import { createOakBaseAdminModule } from '../module';
import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';
import { oakBaseAdminPageMap } from '../page-map';

describe('个人工单工作台路由', () => {
  it('两个页面在个人中心且映射各自真实页面', () => {
    const root = createOakBaseAdminModule().routes?.[0];
    const group = root?.children?.find(
      (item) => item.meta?.title === '个人&中心',
    );
    for (const [resource, directory] of [
      ['MyTickets', 'my-tickets'],
      ['MyHandlingTickets', 'my-handling-tickets'],
    ]) {
      const path = `/clob/V1/${resource}`;
      const mapping = oakBaseAdminBackendRouteMappings.find(
        (item) => item.path === path,
      );
      expect(group?.children?.find((item) => item.path === path)?.name).toBe(
        path.replaceAll('/', '_'),
      );
      expect(mapping).toMatchObject({
        resource: 'Ticket',
        fullPathKey: false,
        menuGroup: { title: '个人&中心' },
        viewPath: `/system/com_levin_oak_base/${directory}/index.vue`,
      });
      expect(oakBaseAdminPageMap[mapping!.viewPath]).toBeTypeOf('function');
    }
  });
  it('同一权限资源的两个独立菜单按路径绑定对应页面', () => {
    const paths = ['/clob/V1/MyTickets', '/clob/V1/MyHandlingTickets'];
    const mappings = oakBaseAdminBackendRouteMappings.filter((item) =>
      paths.includes(item.path),
    );
    const menus = mappings.map((mapping) => ({
      id: mapping.path,
      path: mapping.path,
      label: mapping.title,
      enable: true,
      pageType: 'LocalPage',
      requireAuthorizations: [],
    }));
    const routes = buildMenuRoutes(menus, mappings);
    for (const mapping of mappings)
      expect(
        routes.find((route) => route.path === mapping.path)?.component,
      ).toBe(mapping.viewPath);
  });
});
