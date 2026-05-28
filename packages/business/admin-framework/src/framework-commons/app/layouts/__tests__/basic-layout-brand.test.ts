import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadAuthBrand: vi.fn().mockResolvedValue(undefined),
}));

vi.mock(
  '@levin/admin-framework/framework-commons/app/views/_core/authentication/auth-brand',
  async () => {
    const { ref } = await vi.importActual<typeof import('vue')>('vue');

    return {
      useAuthBrand: () => ({
        appName: ref('租户站点后台'),
        loadAuthBrand: mocks.loadAuthBrand,
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
    destroyWatermark: vi.fn(),
    updateWatermark: vi.fn(),
  }),
}));

vi.mock('@vben/layouts', () => ({
  BasicLayout: {
    emits: ['clear-preferences-and-logout'],
    template: `
      <section data-testid="basic-layout">
        <div data-testid="logo-text"><slot name="logo-text" /></div>
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
    template: '<div />',
  },
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      watermark: false,
      watermarkContent: '',
    },
  },
}));

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessToken: '',
    loginExpired: false,
  }),
  useUserStore: () => ({
    userInfo: {},
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
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
  });
});
