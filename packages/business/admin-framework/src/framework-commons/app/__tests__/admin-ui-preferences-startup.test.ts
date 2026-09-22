import { describe, expect, it, vi } from 'vitest';

import { createAdminUiPreferencesStartupLoader } from '../admin-ui-preferences-startup';

describe('界面偏好启动加载', () => {
  it('应用挂载后请求并应用服务端偏好', async () => {
    const loadPreferences = vi.fn().mockResolvedValue(undefined);
    const lifecycle = createAdminUiPreferencesStartupLoader(loadPreferences);

    lifecycle.onApplicationMounted();
    await vi.waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(1));
  });

  it('登录成功后再次请求，令牌未变化时不重复请求', async () => {
    const loadPreferences = vi.fn().mockResolvedValue(undefined);
    const lifecycle = createAdminUiPreferencesStartupLoader(loadPreferences);

    lifecycle.onApplicationMounted();
    lifecycle.onAccessTokenChanged('login-token', '');
    lifecycle.onAccessTokenChanged('login-token', 'login-token');
    await vi.waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(2));
  });

  it('偏好接口失败不会抛出或阻断登录后的加载流程', async () => {
    const loadPreferences = vi
      .fn()
      .mockRejectedValue(new Error('network error'));
    const lifecycle = createAdminUiPreferencesStartupLoader(loadPreferences);

    lifecycle.onApplicationMounted();
    lifecycle.onAccessTokenChanged('login-token', '');
    await vi.waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(2));
  });
});
