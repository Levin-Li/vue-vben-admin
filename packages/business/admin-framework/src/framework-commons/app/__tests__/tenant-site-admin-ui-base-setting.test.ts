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
import {
  buildAdminUiBaseSettingPayload,
  DEFAULT_ADMIN_UI_BASE_SETTING_UPLOAD_TARGET,
  registerTenantSiteAdminUiBaseSettingListener,
} from '../tenant-site-admin-ui-base-setting';

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

  it('builds an unwrapped upload payload for the server setting endpoint', () => {
    const setting = {
      app: {
        name: 'Current App',
      },
    };

    expect(buildAdminUiBaseSettingPayload(setting, true)).toEqual({
      preferServerSetting: true,
      setting,
      uploadTarget: DEFAULT_ADMIN_UI_BASE_SETTING_UPLOAD_TARGET,
    });
  });

  it('builds an upload payload for the tenant target', () => {
    const setting = {
      app: {
        name: 'Current App',
      },
    };

    expect(buildAdminUiBaseSettingPayload(setting, true, 'Tenant')).toEqual({
      preferServerSetting: true,
      setting,
      uploadTarget: 'Tenant',
    });
  });

  it('strips leaked setting wrappers before uploading preferences', () => {
    const setting = {
      [ADMIN_UI_BASE_SETTING_KEY]: {
        preferServerSetting: true,
        setting: {
          app: {
            name: 'Nested App',
          },
        },
      },
      app: {
        name: 'Current App',
        preferServerSetting: true,
      },
      preferServerSetting: true,
      uploadTarget: 'Tenant',
      shortcutKeys: {
        enable: true,
      },
    };

    expect(buildAdminUiBaseSettingPayload(setting, true)).toEqual({
      preferServerSetting: true,
      setting: {
        app: {
          name: 'Current App',
        },
        shortcutKeys: {
          enable: true,
        },
      },
      uploadTarget: DEFAULT_ADMIN_UI_BASE_SETTING_UPLOAD_TARGET,
    });
  });

  it('does not apply malformed nested server setting as preferences', () => {
    mocks.store.userInfo = { superAdmin: false };

    const unsubscribe = registerTenantSiteAdminUiBaseSettingListener();

    emitApiRequestEvent({
      config: {
        url: '/api/rbac/tenantSiteInfo',
      },
      data: {
        uiExInfo: {
          [ADMIN_UI_BASE_SETTING_KEY]: {
            [ADMIN_UI_BASE_SETTING_KEY]: {
              preferServerSetting: true,
              setting: {
                app: {
                  name: 'Nested App',
                },
              },
            },
            preferServerSetting: true,
          },
        },
      },
    });

    unsubscribe();

    expect(mocks.updatePreferences).toHaveBeenCalledTimes(1);
    expect(mocks.updatePreferences).toHaveBeenCalledWith({
      app: {
        enablePreferences: false,
      },
    });
  });

  it('strips leaked setting wrappers before applying valid server setting', () => {
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
              [ADMIN_UI_BASE_SETTING_KEY]: {
                preferServerSetting: true,
              },
              app: {
                name: 'Server App',
                preferServerSetting: true,
              },
            },
          },
        },
      },
    });

    unsubscribe();

    expect(mocks.updatePreferences).toHaveBeenNthCalledWith(1, {
      app: {
        name: 'Server App',
      },
    });
    expect(mocks.updatePreferences).toHaveBeenNthCalledWith(2, {
      app: {
        enablePreferences: true,
      },
    });
  });
});
