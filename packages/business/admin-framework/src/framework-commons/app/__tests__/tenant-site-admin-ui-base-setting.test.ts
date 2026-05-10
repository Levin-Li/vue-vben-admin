import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  store: {
    userInfo: {} as Record<string, any>,
  },
  updatePreferences: vi.fn(),
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      enableRefreshToken: false,
    },
  },
  updatePreferences: mocks.updatePreferences,
}));

vi.mock('@vben/stores', () => ({
  useUserStore: () => mocks.store,
}));

import { emitApiRequestEvent } from '../api/request-events';
import { ADMIN_UI_BASE_SETTING_KEY } from '../api/rbac-service';
import { registerTenantSiteAdminUiBaseSettingListener } from '../tenant-site-admin-ui-base-setting';

describe('tenant-site-admin-ui-base-setting', () => {
  beforeEach(() => {
    mocks.updatePreferences.mockClear();
    mocks.store.userInfo = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides preferences entry for non-super admin when server setting is preferred', () => {
    mocks.store.userInfo = { superAdmin: false };

    const unsubscribe = registerTenantSiteAdminUiBaseSettingListener();

    emitApiRequestEvent({
      config: {
        url: '/api/rbac/tenantSiteInfo',
      },
      data: {
        uiExInfo: {
          [ADMIN_UI_BASE_SETTING_KEY]: {
            preferServerSetting: true,
            setting: {
              app: {
                enablePreferences: true,
                name: 'Server App',
              },
            },
          },
        },
      },
    });

    unsubscribe();

    expect(mocks.updatePreferences).toHaveBeenNthCalledWith(1, {
      app: {
        enablePreferences: true,
        name: 'Server App',
      },
    });
    expect(mocks.updatePreferences).toHaveBeenNthCalledWith(2, {
      app: {
        enablePreferences: false,
      },
    });
  });

  it('keeps preferences entry for super admin when server setting is preferred', () => {
    mocks.store.userInfo = { superAdmin: true };

    const unsubscribe = registerTenantSiteAdminUiBaseSettingListener();

    emitApiRequestEvent({
      config: {
        url: '/api/rbac/tenantSiteInfo',
      },
      data: {
        uiExInfo: {
          [ADMIN_UI_BASE_SETTING_KEY]: {
            preferServerSetting: true,
            setting: {
              app: {
                enablePreferences: true,
              },
            },
          },
        },
      },
    });

    unsubscribe();

    expect(mocks.updatePreferences).toHaveBeenNthCalledWith(1, {
      app: {
        enablePreferences: true,
      },
    });
    expect(mocks.updatePreferences).toHaveBeenNthCalledWith(2, {
      app: {
        enablePreferences: true,
      },
    });
  });

  it('uses the simple visibility rule while user role is not loaded', () => {
    mocks.store.userInfo = {};

    const unsubscribe = registerTenantSiteAdminUiBaseSettingListener();

    emitApiRequestEvent({
      config: {
        url: '/api/rbac/tenantSiteInfo',
      },
      data: {
        uiExInfo: {
          [ADMIN_UI_BASE_SETTING_KEY]: {
            preferServerSetting: true,
            setting: {
              app: {
                enablePreferences: true,
              },
            },
          },
        },
      },
    });

    unsubscribe();

    expect(mocks.updatePreferences).toHaveBeenNthCalledWith(1, {
      app: {
        enablePreferences: true,
      },
    });
    expect(mocks.updatePreferences).toHaveBeenNthCalledWith(2, {
      app: {
        enablePreferences: false,
      },
    });
  });

  it('shows preferences entry when server setting is not preferred', () => {
    mocks.store.userInfo = { superAdmin: false };

    const unsubscribe = registerTenantSiteAdminUiBaseSettingListener();

    emitApiRequestEvent({
      config: {
        url: '/api/rbac/tenantSiteInfo',
      },
      data: {
        uiExInfo: {
          [ADMIN_UI_BASE_SETTING_KEY]: {
            preferServerSetting: false,
            setting: {
              app: {
                enablePreferences: true,
              },
            },
          },
        },
      },
    });

    unsubscribe();

    expect(mocks.updatePreferences).toHaveBeenCalledWith({
      app: {
        enablePreferences: true,
      },
    });
  });
});
