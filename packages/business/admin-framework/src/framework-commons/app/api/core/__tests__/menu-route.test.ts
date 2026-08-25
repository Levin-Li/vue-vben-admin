import { describe, expect, it } from 'vitest';

import { buildMenuRoutes, convertMenuNodeForTest } from '../menu-route';

const testBackendRouteMappings = [
  {
    icon: 'lucide:shield-check',
    resource: 'Role',
    path: '/clob/V1/Role',
    title: '角色管理',
    viewPath: '/system/com_levin_oak_base/role/index.vue',
  },
  {
    icon: 'lucide:file-text',
    resource: 'Article',
    path: '/clob/V1/Article',
    title: '文章管理',
    viewPath: '/system/com_levin_oak_base/article/index.vue',
  },
  {
    icon: 'lucide:shield',
    resource: 'RbacPermissionItem',
    path: '/clob/V1/RbacPermissionItem',
    title: '权限项定义',
    viewPath: '/system/com_levin_oak_base/rbac-permission-item/index.vue',
  },
  {
    icon: 'lucide:settings',
    resource: 'SettingForTenant',
    path: '/clob/V1/SettingForTenant',
    title: '租户系统设置',
    viewPath: '/system/com_levin_oak_base/setting-for-tenant/index.vue',
  },
];

describe('menu route conversion', () => {
  it('routes LocalPage to local Vue mapping when available', () => {
    expect(
      convertMenuNodeForTest(
        {
          name: '角色管理',
          pageType: 'LocalPage-本地页面',
          path: '/clob/V1/Role',
        },
        testBackendRouteMappings,
      )?.component,
    ).toBe('/system/com_levin_oak_base/role/index.vue');
  });

  it('uses a custom menu label as the mapped local page title', () => {
    const route = convertMenuNodeForTest(
      {
        name: '自定义菜单',
        pageType: 'LocalPage-本地页面',
        path: '/clob/V1/Role',
      },
      testBackendRouteMappings,
    );

    expect(route?.meta?.title).toBe('自定义菜单');
  });

  it('falls back to the local page title when the menu label is empty', () => {
    const route = convertMenuNodeForTest(
      {
        name: '',
        pageType: 'LocalPage-本地页面',
        path: '/clob/V1/Role',
      },
      testBackendRouteMappings,
    );

    expect(route?.meta?.title).toBe('角色管理');
  });

  it('uses local mapping icon when backend still stores the old generic leaf icon', () => {
    const route = convertMenuNodeForTest(
      {
        icon: 'lucide:panel-right-open',
        name: '文章管理',
        pageType: 'LocalPage-本地页面',
        path: '/clob/V1/Article',
      },
      testBackendRouteMappings,
    );

    expect(route?.meta?.icon).toBe('lucide:file-text');
  });

  it('uses the generic leaf icon when an unmapped backend leaf has no explicit icon', () => {
    const route = convertMenuNodeForTest({
      icon: 'lucide:panel-right-open',
      name: '合同签署记录',
      pageType: 'LocalPage-本地页面',
      path: '/contract/V1/SignLog',
    });

    expect(route?.meta?.icon).toBe('lucide:panel-right-open');
  });

  it('preserves explicit backend icons', () => {
    const route = convertMenuNodeForTest({
      icon: 'lucide:star',
      name: '商品订单',
      pageType: 'LocalPage-本地页面',
      path: '/trade/V1/ProductOrder',
    });

    expect(route?.meta?.icon).toBe('lucide:star');
  });

  it('routes removed backend menu paths to the 404 page', () => {
    const route = convertMenuNodeForTest(
      {
        name: '权限管理',
        pageType: 'LocalPage-本地页面',
        path: '/clob/V1/Permission',
      },
      testBackendRouteMappings,
    );

    expect(route?.path).toBe('/clob/V1/Permission');
    expect(route?.component).toBe('/_core/fallback/not-found.vue');
    expect(route?.meta?.menuRouteMissingPage).toBe(true);
  });

  it('routes tenant setting path to the tenant setting local page', () => {
    expect(
      convertMenuNodeForTest(
        {
          name: '租户系统设置',
          pageType: 'LocalPage-本地页面',
          path: '/clob/V1/SettingForTenant',
        },
        testBackendRouteMappings,
      )?.component,
    ).toBe('/system/com_levin_oak_base/setting-for-tenant/index.vue');
  });

  it('routes unmapped LocalPage backend menus to the 404 page', () => {
    const route = convertMenuNodeForTest(
      {
        name: '用户扩展信息',
        pageType: 'LocalPage-本地页面',
        path: '/cvf/V1/UserExt',
      },
      testBackendRouteMappings,
    );

    expect(route?.component).toBe('/_core/fallback/not-found.vue');
    expect(route?.path).toBe('/cvf/V1/UserExt');
    expect(route?.meta?.backendIframeSrc).toBeUndefined();
    expect(route?.meta?.menuRouteMissingPage).toBe(true);
  });

  it('routes unmapped old backend page types to the 404 page', () => {
    const route = convertMenuNodeForTest(
      {
        name: '旧 AMIS 页面',
        pageType: 'AmisPage-Amis页面',
        path: '/cvf/merchant',
      },
      testBackendRouteMappings,
    );

    expect(route?.component).toBe('/_core/fallback/not-found.vue');
    expect(route?.path).toBe('/cvf/merchant');
    expect(route?.meta?.backendIframeSrc).toBeUndefined();
    expect(route?.meta?.menuRouteMissingPage).toBe(true);
  });

  it('routes HtmlPage to iframe view', () => {
    const route = convertMenuNodeForTest({
      name: '外部页面',
      pageType: 'HtmlPage-Html页面',
      path: 'https://example.com',
    });

    expect(route?.component).toBe('IFrameView');
    expect(route?.meta?.link).toBe('https://example.com');
  });

  it('normalizes TabPanelIFrame to TabPanel behavior', () => {
    const route = convertMenuNodeForTest({
      actionType: 'TabPanelIFrame-Tab栏Iframe',
      name: '文章管理',
      pageType: 'LocalPage-本地页面',
      path: '/clob/V1/Article',
    });

    expect(route?.meta?.menuActionType).toBe('TabPanel');
  });

  it('routes ModalWindow action to modal page before pageType', () => {
    const route = convertMenuNodeForTest({
      actionType: 'ModalWindow-模态窗口',
      name: '弹窗页面',
      pageType: 'HtmlPage-Html页面',
      path: '/clob/V1/Article',
    });

    expect(route?.component).toBe('/system/shared/menu-modal-page.vue');
    expect(route?.meta?.menuActionType).toBe('ModalWindow');
  });

  it('routes ServerSideAction to server action page before pageType', () => {
    const route = convertMenuNodeForTest({
      actionType: 'ServerSideAction-服务端动作',
      name: '服务端动作',
      pageType: 'LocalPage-本地页面',
      path: '/clob/V1/Article',
    });

    expect(route?.component).toBe('/system/shared/server-action-page.vue');
    expect(route?.meta?.menuActionType).toBe('ServerSideAction');
  });

  it('uses actionType before pageType for NewWindow', () => {
    const route = convertMenuNodeForTest({
      actionType: 'NewWindow-新浏览器窗口',
      name: '外部链接',
      pageType: 'LocalPage-本地页面',
      path: 'https://example.com',
    });

    expect(route?.component).toBe('IFrameView');
    expect(route?.meta?.link).toBe('https://example.com');
    expect(route?.meta?.openInNewWindow).toBe(true);
  });

  it('routes pages absent from backend menus to the forbidden page', () => {
    const routes = buildMenuRoutes([], testBackendRouteMappings);
    const roleRoute = routes.find((route) => route.path === '/clob/V1/Role');

    expect(routes.every((route) => route.meta?.hideInMenu)).toBe(true);
    expect(roleRoute?.component).toBe('/_core/fallback/forbidden.vue');
    expect(roleRoute?.meta?.menuRouteForbidden).toBe(true);
  });

  it('keeps a custom-layout leaf on its mapped page instead of adding a forbidden duplicate', () => {
    const routes = buildMenuRoutes(
      [
        {
          children: [
            {
              name: '自定义菜单',
              pageType: 'LocalPage-本地页面',
              path: '/clob/V1/TenantCustomMenu',
            },
          ],
          id: 'custom-layout-group',
          name: '测试分组',
        },
      ],
      [
        {
          icon: 'lucide:waypoints',
          resource: 'TenantCustomMenu',
          path: '/clob/V1/TenantCustomMenu',
          title: '自定义菜单',
          viewPath: '/system/com_levin_oak_base/tenant-custom-menu/index.vue',
        },
      ],
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]?.children?.[0]?.component).toBe(
      '/system/com_levin_oak_base/tenant-custom-menu/index.vue',
    );
    expect(routes[0]?.children?.[0]?.meta?.menuRouteForbidden).toBeUndefined();
  });

  it('uses virtual-group ids to keep Chinese-named custom groups from replacing each other', () => {
    const routes = buildMenuRoutes(
      [
        {
          children: [
            {
              name: '自定义菜单',
              pageType: 'LocalPage-本地页面',
              path: '/clob/V1/TenantCustomMenu',
            },
          ],
          id: 'tenant-custom-menu:root:0',
          name: '测试分组',
        },
        {
          children: [
            {
              name: '用户管理',
              pageType: 'LocalPage-本地页面',
              path: '/clob/V1/User',
            },
          ],
          id: 'tenant-custom-menu:root:1',
          name: '系统管理',
        },
      ],
      [
        {
          icon: 'lucide:waypoints',
          resource: 'TenantCustomMenu',
          path: '/clob/V1/TenantCustomMenu',
          title: '自定义菜单',
          viewPath: '/system/com_levin_oak_base/tenant-custom-menu/index.vue',
        },
        {
          icon: 'lucide:users',
          resource: 'User',
          path: '/clob/V1/User',
          title: '用户管理',
          viewPath: '/system/com_levin_oak_base/user/index.vue',
        },
      ],
    );

    expect(routes.map((route) => route.name)).toEqual([
      '_menu_tenant-custom-menu:root:0',
      '_menu_tenant-custom-menu:root:1',
    ]);
    expect(routes[0]?.children?.[0]?.component).toBe(
      '/system/com_levin_oak_base/tenant-custom-menu/index.vue',
    );
    expect(routes[1]?.children?.[0]?.component).toBe(
      '/system/com_levin_oak_base/user/index.vue',
    );
  });

  it('keeps a virtual-group route name stable when its editable label changes', () => {
    const buildGroupRoute = (name: string) =>
      convertMenuNodeForTest({
        children: [
          {
            name: '用户管理',
            pageType: 'LocalPage-本地页面',
            path: '/clob/V1/User',
          },
        ],
        id: 'tenant-custom-menu:root:0',
        name,
      });

    expect(buildGroupRoute('测试分组')?.name).toBe(
      '_menu_tenant-custom-menu:root:0',
    );
    expect(buildGroupRoute('已修改的分组')?.name).toBe(
      '_menu_tenant-custom-menu:root:0',
    );
  });

  it('routes backend root menu to the default frontend home page', () => {
    const route = convertMenuNodeForTest({
      name: '首页',
      pageType: 'LocalPage-本地页面',
      path: '/',
    });

    expect(route?.name).toBe('_index');
    expect(route?.path).toBe('/index');
    expect(route?.component).toBe('/_core/home/index.vue');
  });

  it('keeps disabled backend menus as disabled menu routes for display fallback', () => {
    const route = convertMenuNodeForTest({
      enable: false,
      name: '项目系统',
      pageType: 'LocalPage-本地页面',
      path: '/cvf/merchant',
    });

    expect(route).toBeTruthy();
    expect(route?.meta?.disabled).toBe(true);
  });

  it('uses a lightweight route view for nested backend menu groups', () => {
    const route = convertMenuNodeForTest(
      {
        children: [
          {
            children: [
              {
                name: '店铺商品',
                pageType: 'LocalPage-本地页面',
                path: '/clob/V1/Article',
              },
            ],
            name: '线上店铺',
            path: '/cvf/online-shops',
          },
        ],
        name: '项目系统',
        path: '/cvf',
      },
      testBackendRouteMappings,
    );
    const nestedGroup = route?.children?.[0];

    expect(route?.component).toBe('BasicLayout');
    expect(nestedGroup?.component).toBe('RouteView');
    expect(nestedGroup?.children?.[0]?.component).toBe(
      '/system/com_levin_oak_base/article/index.vue',
    );
  });

  it('keeps a group page accessible while preserving its child menus', () => {
    const route = convertMenuNodeForTest(
      {
        children: [
          {
            name: '角色管理',
            pageType: 'LocalPage-本地页面',
            path: '/clob/V1/Role',
          },
        ],
        id: 'group:country',
        name: '国家地区',
        pageType: 'LocalPage-本地页面',
        path: '/clob/V1/Article',
      },
      testBackendRouteMappings,
    );

    expect(route?.component).toBe('RouteView');
    expect(route?.redirect).toBeUndefined();
    expect(route?.meta?.navigateOnClick).toBe(true);
    expect(route?.meta?.preserveComponentWhenChildren).toBe(true);
    expect(route?.children?.[0]).toMatchObject({
      component: '/system/com_levin_oak_base/article/index.vue',
      meta: { hideInMenu: true },
      path: '',
    });
    expect(route?.children?.[0]?.name).not.toBe(route?.name);
    expect(route?.children?.[1]?.path).toBe('/clob/V1/Role');
  });

  it('keeps third-level menu groups from creating another basic layout', () => {
    const route = convertMenuNodeForTest(
      {
        children: [
          {
            children: [
              {
                children: [
                  {
                    name: '门店管理',
                    pageType: 'LocalPage-本地页面',
                    path: '/clob/V1/Role',
                  },
                ],
                name: '门店资料',
                path: '/cvf/offline/stores',
              },
            ],
            name: '线下门店',
            path: '/cvf/offline',
          },
        ],
        name: '项目系统',
        path: '/cvf',
      },
      testBackendRouteMappings,
    );
    const secondLevelGroup = route?.children?.[0];
    const thirdLevelGroup = secondLevelGroup?.children?.[0];

    expect(route?.component).toBe('BasicLayout');
    expect(secondLevelGroup?.component).toBe('RouteView');
    expect(thirdLevelGroup?.component).toBe('RouteView');
    expect(thirdLevelGroup?.children?.[0]?.component).toBe(
      '/system/com_levin_oak_base/role/index.vue',
    );
  });

  it('keeps fourth-level menu groups from creating another basic layout', () => {
    const route = convertMenuNodeForTest(
      {
        children: [
          {
            children: [
              {
                children: [
                  {
                    children: [
                      {
                        name: '终端管理',
                        pageType: 'LocalPage-本地页面',
                        path: '/clob/V1/SettingForTenant',
                      },
                    ],
                    name: '终端设备',
                    path: '/cvf/offline/stores/terminals',
                  },
                ],
                name: '门店资料',
                path: '/cvf/offline/stores',
              },
            ],
            name: '线下门店',
            path: '/cvf/offline',
          },
        ],
        name: '项目系统',
        path: '/cvf',
      },
      testBackendRouteMappings,
    );
    const secondLevelGroup = route?.children?.[0];
    const thirdLevelGroup = secondLevelGroup?.children?.[0];
    const fourthLevelGroup = thirdLevelGroup?.children?.[0];

    expect(route?.component).toBe('BasicLayout');
    expect(secondLevelGroup?.component).toBe('RouteView');
    expect(thirdLevelGroup?.component).toBe('RouteView');
    expect(fourthLevelGroup?.component).toBe('RouteView');
    expect(fourthLevelGroup?.children?.[0]?.component).toBe(
      '/system/com_levin_oak_base/setting-for-tenant/index.vue',
    );
  });
});
