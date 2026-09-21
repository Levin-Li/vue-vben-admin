import { readFileSync } from 'node:fs';

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminMenuSyncService: null as null | Record<string, never>,
  destroyWatermark: vi.fn(),
  loadAuthBrand: vi.fn().mockResolvedValue(undefined),
  refreshAuthBrand: vi.fn().mockResolvedValue(undefined),
  registerPreferencesUploadAction: vi.fn(() => vi.fn()),
  preferences: {
    app: {
      defaultHomePath: '/analytics',
      watermark: false,
      watermarkColor: 'gray',
      watermarkColorCustom: false,
      watermarkTransparency: 85,
      watermarkContent: '',
    },
    navigation: {
      gradientEndColor: '#fff4f5',
      gradientTransitionColor: '#f1efff',
      gradientTransitionColorEnabled: false,
      visualStyle: 'minimal',
    },
  },
  updateWatermark: vi.fn(),
  push: vi.fn(),
  userInfo: {} as Record<string, any>,
}));

vi.mock(
  '@levin/admin-framework/framework-commons/app/views/_core/authentication/auth-brand',
  async () => {
    const { ref } = await vi.importActual<typeof import('vue')>('vue');

    return {
      useAuthBrand: () => ({
        appName: ref('租户站点后台'),
        copyright: ref('租户站点版权'),
        heroImage: ref(''),
        loadAuthBrand: mocks.loadAuthBrand,
        logo: ref(''),
        refreshAuthBrand: mocks.refreshAuthBrand,
      }),
    };
  },
);

vi.mock('@vben/common-ui', () => ({
  AuthenticationLoginExpiredModal: {
    template: '<div><slot /></div>',
  },
}));

vi.mock('@vben/runtime/hooks', () => ({
  useAppConfig: () => ({
    apiURL: '',
  }),
  useWatermark: () => ({
    destroyWatermark: mocks.destroyWatermark,
    updateWatermark: mocks.updateWatermark,
  }),
}));

vi.mock('@vben/layouts', () => ({
  BasicLayout: {
    emits: ['clickLogo'],
    template: `
      <section data-testid="basic-layout">
        <button data-testid="logo-text" @click="$emit('clickLogo')"><slot name="logo-text" /></button>
        <div data-testid="footer"><slot name="footer" /></div>
        <slot name="user-dropdown" />
        <slot name="notification" />
        <slot name="extra" />
        <slot name="lock-screen" />
      </section>
    `,
  },
  LockScreen: {
    template: '<div />',
  },
  Notification: {
    template: '<div />',
  },
  registerPreferencesUploadAction: mocks.registerPreferencesUploadAction,
  UserDropdown: {
    props: ['systemMenus'],
    template: `
      <div>
        <button
          v-for="menu in systemMenus"
          :key="menu.id"
          :data-testid="'system-menu-' + menu.id"
          @click="menu.handler"
        >{{ menu.text }}</button>
      </div>
    `,
  },
}));

vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: mocks.preferences,
}));

vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({
    accessToken: '',
    loginExpired: false,
  }),
  useUserStore: () => ({
    userInfo: mocks.userInfo,
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock('@levin/admin-framework', () => ({
  getAdminMenuSyncService: () => mocks.adminMenuSyncService,
  getAdminNoticeService: () => null,
}));

vi.mock('@levin/admin-framework/framework-commons/app/locales', () => ({
  $t: (key: string) => key,
}));

vi.mock('@levin/admin-framework/framework-commons/app/pages', () => ({
  resolveAdminPage: () => async () => ({ template: '<div />' }),
}));

vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({
    logout: vi.fn(),
  }),
}));

vi.mock('../../../event-bus', () => ({
  getFrameworkEventListeners: () => [],
  removeFrameworkEventListener: vi.fn(),
  setFrameworkEventListenerEnabled: vi.fn(),
}));

vi.mock('../../../runtime', () => ({
  getAdminI18nLabelSyncService: () => null,
}));

vi.mock('../../../shared/user-dropdown-menu-service', () => ({
  getUserDropdownMenuItems: () => ({
    value: [],
  }),
}));

vi.mock('../sync-i18n-labels-modal.vue', () => ({
  default: {
    template: '<div />',
  },
}));

vi.mock('../sync-menu-routes-modal.vue', () => ({
  default: {
    template: '<div />',
  },
}));

vi.mock('../admin-ui-preferences-setting', () => ({
  ADMIN_UI_PREFERENCES_SETTING_CODE: '界面偏好设置',
  loadAdminUiPreferencesScopeOptions: vi.fn().mockResolvedValue({}),
  saveAdminUiPreferencesSetting: vi.fn(),
}));

import Basic from '../basic.vue';

describe('basic layout tenant site brand', () => {
  beforeEach(() => {
    mocks.loadAuthBrand.mockClear();
    mocks.registerPreferencesUploadAction.mockClear();
    mocks.adminMenuSyncService = null;
    mocks.userInfo.superAdmin = false;
  });

  it('仅为超级管理员向偏好设置注册上传入口，并从用户菜单移除入口', async () => {
    mocks.adminMenuSyncService = {};
    mocks.userInfo.superAdmin = true;

    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await flushPromises();

    expect(mocks.registerPreferencesUploadAction).toHaveBeenCalledOnce();
    expect(
      wrapper
        .find('[data-testid="system-menu-save-admin-ui-base-setting"]')
        .exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it('将界面偏好上传表单放大到默认宽度的 1.3 倍', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );

    expect(source).toContain(':width="676"');
  });

  it('only exposes frontend versions to a super administrator', async () => {
    mocks.userInfo.superAdmin = true;

    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await flushPromises();

    expect(
      wrapper.get('[data-testid="system-menu-frontend-build-versions"]').text(),
    ).toBe('前端组件版本');

    mocks.userInfo.superAdmin = false;
    wrapper.unmount();
  });

  it('打开版本弹窗后显示包名、版本与逐包打包时间', async () => {
    mocks.userInfo.superAdmin = true;
    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Popconfirm: true,
          Tag: { template: '<span><slot /></span>' },
          AModal: {
            props: ['open', 'title'],
            template:
              '<section v-if="open" :aria-label="title"><slot /></section>',
          },
        },
      },
    });
    await flushPromises();
    await wrapper
      .get('[data-testid="system-menu-frontend-build-versions"]')
      .trigger('click');
    const panel = wrapper.get('[aria-label="前端组件版本"]');
    expect(panel.text()).toContain('@levin/admin-framework');
    expect(panel.text()).toContain('@vben/runtime/stores');
    expect(panel.text()).toContain('打包时间：');
    expect(panel.text()).not.toContain('Invalid Date');
    expect(panel.text()).not.toContain('版本不匹配');
    expect(panel.text()).not.toContain('开发模式');
    wrapper.unmount();
  });

  it('renders the layout logo text from tenant site brand state', async () => {
    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await flushPromises();

    expect(mocks.loadAuthBrand).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="logo-text"]').text()).toBe(
      '租户站点后台',
    );
    expect(wrapper.get('[data-testid="footer"]').text()).toBe('租户站点版权');
    expect(wrapper.get('[data-testid="basic-layout"]').classes()).toContain(
      'admin-navigation-theme-minimal',
    );
  });

  it('仅在交互时为主题渐变用户入口显示圆角高亮', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );

    // 静止状态不覆盖用户入口，确保它与默认主题的透明状态一致。
    expect(source).not.toContain(':deep(header.light .header-user-dropdown) {');
  });

  it('使主题渐变顶栏控件使用选中态主题色强度', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );
    const headerControlSection = source.slice(
      source.indexOf(
        '/* 顶栏控件静止透明，交互时与当前选中项使用同强度主题色。 */',
      ),
      source.indexOf('/* 标签栏与侧栏菜单保持一致的悬停、选中渐变层级。 */'),
    );

    // 静止态透明，折叠、刷新和头像等控件继承同一选中态强度。
    expect(headerControlSection).toContain(
      '--header-control-background: transparent;',
    );
    expect(headerControlSection).toContain(
      '--header-control-background-hover: hsl(var(--primary) / 36%);',
    );
    expect(headerControlSection).not.toContain('hsl(var(--primary) / 10%)');
  });

  it('仅在交互时为主题渐变 CRUD 工具栏图标显示选中态主题色', () => {
    const source = readFileSync(
      'packages/business/admin-framework/src/framework-commons/app/layouts/basic.vue',
      'utf8',
    );
    const toolbarControlSection = source.slice(
      source.indexOf(
        '/* 工具栏图标静止时不叠加圆形表面，交互时与顶栏使用同强度主题色。 */',
      ),
      source.indexOf(
        '/* CRUD 操作栏只作轻量承接，不抢占新增和工具按钮的操作层级。 */',
      ),
    );

    // 统一工具栏类覆盖导入、导出、刷新、展示设置、全屏和列设置。
    expect(toolbarControlSection).toContain(
      ':deep(.vben-crud-table-tool-button) {',
    );
    expect(toolbarControlSection).toContain(
      'background: transparent !important;',
    );
    expect(toolbarControlSection).toContain(
      ':deep(.vben-crud-table-tool-button:hover)',
    );
    expect(toolbarControlSection).toContain(
      ':deep(.vben-crud-table-tool-button:focus-visible)',
    );
    expect(toolbarControlSection).toContain(
      'background: hsl(var(--primary) / 36%) !important;',
    );
  });

  it('navigates to the current user home path when the layout logo is clicked', async () => {
    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await wrapper.get('[data-testid="logo-text"]').trigger('click');

    expect(mocks.push).toHaveBeenCalledWith('/analytics');
  });

  it('uses the custom watermark color when creating a watermark', async () => {
    Object.assign(mocks.preferences.app, {
      watermark: true,
      watermarkColor: 'hsl(340 82% 52%)',
      watermarkColorCustom: true,
      watermarkTransparency: 60,
      watermarkContent: '内部资料',
    });
    mocks.updateWatermark.mockClear();

    const wrapper = mount(Basic, {
      global: {
        stubs: {
          Button: true,
          Checkbox: true,
          Empty: true,
          Modal: true,
          Popconfirm: true,
          Tag: true,
        },
      },
    });

    await flushPromises();

    expect(mocks.updateWatermark).toHaveBeenCalledWith({
      advancedStyle: {
        colorStops: [
          { color: 'hsl(340 82% 52%)', offset: 0 },
          { color: 'hsl(340 82% 52%)', offset: 1 },
        ],
        type: 'linear',
      },
      content: '内部资料',
      globalAlpha: 0.4,
    });

    wrapper.unmount();
    Object.assign(mocks.preferences.app, {
      watermark: false,
      watermarkColor: 'gray',
      watermarkColorCustom: false,
      watermarkTransparency: 85,
      watermarkContent: '',
    });
  });
});
