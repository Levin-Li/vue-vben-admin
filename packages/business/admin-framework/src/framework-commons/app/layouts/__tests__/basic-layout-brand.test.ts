import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  destroyWatermark: vi.fn(),
  loadAuthBrand: vi.fn().mockResolvedValue(undefined),
  refreshAuthBrand: vi.fn().mockResolvedValue(undefined),
  preferences: {
    app: {
      defaultHomePath: '/analytics',
      watermark: false,
      watermarkColor: 'gray',
      watermarkColorCustom: false,
      watermarkTransparency: 85,
      watermarkContent: '',
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

vi.mock('@vben/hooks', () => ({
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

vi.mock('@vben/preferences', () => ({
  preferences: mocks.preferences,
}));

vi.mock('@vben/stores', () => ({
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
  getAdminMenuSyncService: () => null,
  getAdminNoticeService: () => null,
}));

vi.mock('@levin/admin-framework/framework-commons/app/api', () => ({
  rbacService: {
    adjustSiteUiSetting: vi.fn(),
  },
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

vi.mock('../tenant-site-admin-ui-base-setting', () => ({
  buildAdminUiBaseSettingPayload: vi.fn(),
  DEFAULT_ADMIN_UI_BASE_SETTING_UPLOAD_TARGET: 'TenantSite',
}));

import Basic from '../basic.vue';

describe('basic layout tenant site brand', () => {
  beforeEach(() => {
    mocks.loadAuthBrand.mockClear();
    mocks.userInfo.superAdmin = false;
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
