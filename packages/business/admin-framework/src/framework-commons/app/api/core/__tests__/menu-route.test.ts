import { describe, expect, it } from 'vitest';

import { buildMenuRoutes, convertMenuNodeForTest } from '../menu-route';

const testBackendRouteMappings = [
  {
    icon: 'lucide:shield-check',
    name: 'Role',
    resource: 'Role',
    path: '/clob/V1/Role',
    title: '角色管理',
    viewPath: '/system/com_levin_oak_base/role/index.vue',
  },
  {
    icon: 'lucide:file-text',
    name: 'Article',
    resource: 'Article',
    path: '/clob/V1/Article',
    title: '文章管理',
    viewPath: '/system/com_levin_oak_base/article/index.vue',
  },
  {
    icon: 'lucide:settings',
    name: 'SettingForTenant',
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

  it('does not create visible menus when backend menus are empty', () => {
    const routes = buildMenuRoutes([], testBackendRouteMappings);

    expect(routes.every((route) => route.meta?.hideInMenu)).toBe(true);
    expect(routes.some((route) => route.path === '/clob/V1/Role')).toBe(true);
  });

  it('routes backend root menu to the default frontend home page', () => {
    const route = convertMenuNodeForTest({
      name: '首页',
      pageType: 'LocalPage-本地页面',
      path: '/',
    });

    expect(route?.name).toBe('Index');
    expect(route?.path).toBe('/index');
    expect(route?.component).toBe('/_core/home/index.vue');
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
