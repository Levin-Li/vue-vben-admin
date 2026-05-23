import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configureAdminApplication } from '../../options';
import { setAdminFrameworkRuntime } from '../../../runtime';
import { loadRuntimeI18nLabels } from '../runtime-i18n-labels';

const requestClient = {
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  request: vi.fn(),
};

describe('runtime i18n labels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    configureAdminApplication({
      modules: [],
    });
    setAdminFrameworkRuntime({
      requestClient,
    });
  });

  it('loads server labels for all application modules and expands flat keys', async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        code: 0,
        data: {
          modules: [
            {
              labels: {
                'common.login': '服务端登录',
              },
              moduleId: '@vben/locales',
            },
            {
              labels: {
                'order.title': '订单',
              },
              moduleId: 'com.levin.order',
            },
          ],
        },
        successful: true,
      }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetch);
    const runtimeLabels = vi.fn().mockResolvedValue({
      modules: [
        {
          labels: {
            'common.login': '不应使用备用服务',
          },
          moduleId: '@vben/locales',
        },
      ],
    });
    configureAdminApplication({
      modules: [
        {
          locales: {
            'zh-CN': {
              order: {
                title: '本地订单',
              },
            },
          },
          name: 'com.levin.order',
          title: '订单模块',
        },
      ],
    });
    setAdminFrameworkRuntime({
      i18nLabelSyncService: {
        runtimeLabels,
        syncLabels: vi.fn(),
      },
      requestClient,
    });

    const messages = await loadRuntimeI18nLabels({
      adminFrameworkLocales: {
        'zh-CN': {
          page: {
            auth: {
              login: '登录',
            },
          },
        },
      },
      appCode: 'levin-main-app',
      appVersion: '0.1.0',
      domain: 'localhost',
      language: 'zh-CN',
      terminalType: 'Admin',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/I18nRes/runtimeLabels',
      expect.objectContaining({
        body: JSON.stringify({
          appCode: 'levin-main-app',
          appVersion: '0.1.0',
          domain: 'localhost',
          language: 'zh-CN',
          moduleIds: [
            '@vben/locales',
            '@levin/admin-framework',
            'com.levin.order',
          ],
          terminalType: 'Admin',
          valueType: 'Label',
        }),
        credentials: 'include',
        method: 'POST',
      }),
    );
    expect(runtimeLabels).not.toHaveBeenCalled();
    expect(messages).toEqual({
      common: {
        login: '服务端登录',
      },
      order: {
        title: '订单',
      },
    });
  });

  it('logs a warning and keeps local flow usable when server labels fail', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    setAdminFrameworkRuntime({
      i18nLabelSyncService: {
        runtimeLabels: vi.fn(),
        syncLabels: vi.fn(),
      },
      requestClient,
    });

    const messages = await loadRuntimeI18nLabels({
      adminFrameworkLocales: {},
      appCode: 'levin-main-app',
      appVersion: '0.1.0',
      domain: 'localhost',
      language: 'zh-CN',
    });

    expect(messages).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      '[i18n] 获取服务端语言包失败，已继续使用本地语言包。',
      expect.objectContaining({
        language: 'zh-CN',
      }),
    );
  });
});
