import { describe, expect, it } from 'vitest';

import { convertMenuNodeForTest } from '../menu-route';

describe('menu route conversion', () => {
  it('routes LocalPage to local Vue mapping when available', () => {
    expect(
      convertMenuNodeForTest({
        name: '角色管理',
        pageType: 'LocalPage-本地页面',
        path: '/clob/V1/Role',
      })?.component,
    ).toBe('/system/com_levin_oak_base/role/index.vue');
  });

  it('routes tenant setting path to the tenant setting local page', () => {
    expect(
      convertMenuNodeForTest({
        name: '租户系统设置',
        pageType: 'LocalPage-本地页面',
        path: '/clob/V1/SettingForTenant',
      })?.component,
    ).toBe('/system/com_levin_oak_base/setting-for-tenant/index.vue');
  });

  it('routes AmisPage to local Vue mapping when a local page exists', () => {
    expect(
      convertMenuNodeForTest({
        name: '文章管理',
        pageType: 'AmisPage-Amis页面',
        path: '/clob/V1/Article',
      })?.component,
    ).toBe('/system/com_levin_oak_base/article/index.vue');
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
      pageType: 'AmisPage-Amis页面',
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
});
