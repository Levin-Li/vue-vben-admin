import { describe, expect, it } from 'vitest';
import { buildMenuRoutes } from '@levin/admin-framework/framework-commons/app/api/core/menu-route';

import { oakBaseAdminBackendRouteMappings } from '../backend-route-mappings';
import { createOakBaseAdminModule } from '../module';
import { oakBaseAdminPageMap } from '../page-map';
import { omitReportMenu } from '../views/report-view/report-menu-visibility';

describe('报表中心导航', () => {
  it('使用独立分组和准确的页面源码映射', () => {
    const path = '/clob/V1/ReportDefinitionManagement';
    const root = createOakBaseAdminModule().routes?.[0];
    const group = root?.children?.find(
      (item) => item.meta?.title === '报表中心',
    );
    expect(group?.children?.find((item) => item.path === path)?.name).toBe(
      path.replaceAll('/', '_'),
    );
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === path,
    );
    expect(mapping).toMatchObject({
      resource: 'ReportDefinition',
      sourceFilePath:
        'modules/com_levin_oak_base/views/report-center/index.vue',
      viewPath: '/system/com_levin_oak_base/report-center/index.vue',
      menuGroup: { title: '报表中心', path: '/clob/V1/index/groups/报表中心' },
    });
    expect(mapping).not.toHaveProperty('name');
    expect(
      oakBaseAdminPageMap['/system/com_levin_oak_base/report-center/index.vue'],
    ).toBeTypeOf('function');
  });

  it('具体报表菜单复用隐藏的运行页映射并保留报表中心归属', () => {
    const mapping = oakBaseAdminBackendRouteMappings.find(
      (item) => item.path === '/clob/V1/ReportView',
    );
    expect(mapping).toMatchObject({
      hideInMenu: true,
      onlyRequireAuthenticated: true,
      sourceFilePath: 'modules/com_levin_oak_base/views/report-view/index.vue',
      viewPath: '/system/com_levin_oak_base/report-view/index.vue',
      menuGroup: { path: '/clob/V1/index/groups/报表中心' },
    });
    expect(oakBaseAdminPageMap['/system/com_levin_oak_base/report-view/index.vue']).toBeTypeOf('function');
  });

  it('服务端生成的报表菜单可按实际路由精确隐藏，其他菜单保留', () => {
    const mapping = oakBaseAdminBackendRouteMappings.find((item) => item.path === '/clob/V1/ReportView')!;
    const menus = buildMenuRoutes([{ id: 'reports', path: '/reports', children: [
      { id: 'report-a', path: '/clob/V1/ReportView/0123456789abcdef0123456789abcdef',
        viewPath: mapping.viewPath, params: { reportId: 'a' }, pageType: 'LocalPage', actionType: 'TabPanel' },
      { id: 'report-b', path: '/clob/V1/ReportView/abcdef0123456789abcdef0123456789',
        viewPath: mapping.viewPath, params: { reportId: 'b' }, pageType: 'LocalPage', actionType: 'TabPanel' },
    ] }], [mapping]);
    const group = menus.find((item) => item.path === '/reports')!;
    expect(group.children?.map((item) => item.path)).toEqual(['/menu/report-a', '/menu/report-b']);
    type RouteNode = { path: string; children?: RouteNode[] };
    const filtered = omitReportMenu<RouteNode>([{ path: '/reports', children: group.children!.map((item) => ({ path: item.path })) }], '/menu/report-a');
    expect(filtered[0]?.children?.map((item) => item.path)).toEqual(['/menu/report-b']);
  });
});
