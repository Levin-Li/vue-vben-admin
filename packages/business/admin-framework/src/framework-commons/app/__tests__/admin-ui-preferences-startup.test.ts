import { describe, expect, it, vi } from 'vitest';

import { createAdminUiPreferencesStartupLoader } from '../admin-ui-preferences-startup';

describe('界面偏好启动加载', () => {
  it('启动期在挂载前请求并应用服务端偏好', async () => {
    const resolution = { scope: {}, setting: null };
    const loadPreferences = vi.fn().mockResolvedValue(resolution);
    const applyPreferences = vi.fn();
    const lifecycle = createAdminUiPreferencesStartupLoader(
      loadPreferences,
      applyPreferences,
    );

    await lifecycle.prepareForMount();
    await vi.waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(1));
    expect(applyPreferences).toHaveBeenCalledWith(resolution);
  });

  it('登录成功后再次请求，令牌未变化时不重复请求', async () => {
    const loadPreferences = vi
      .fn()
      .mockResolvedValue({ scope: {}, setting: null });
    const lifecycle = createAdminUiPreferencesStartupLoader(loadPreferences);

    await lifecycle.prepareForMount();
    lifecycle.onApplicationMounted();
    lifecycle.onAccessTokenChanged('login-token', '');
    lifecycle.onAccessTokenChanged('login-token', 'login-token');
    await vi.waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(2));
  });

  it('超时后继续启动，并在迟到请求返回时应用偏好', async () => {
    let resolvePreferences:
      | ((value: { scope: {}; setting: null }) => void)
      | undefined;
    const loadPreferences = vi.fn(
      () =>
        new Promise<{ scope: {}; setting: null }>((resolve) => {
          resolvePreferences = resolve;
        }),
    );
    const applyPreferences = vi.fn();
    const lifecycle = createAdminUiPreferencesStartupLoader(
      loadPreferences,
      applyPreferences,
      1,
    );

    await lifecycle.prepareForMount();
    expect(applyPreferences).not.toHaveBeenCalled();

    resolvePreferences?.({ scope: {}, setting: null });
    await vi.waitFor(() => expect(applyPreferences).toHaveBeenCalledTimes(1));
  });

  it('登录请求先返回时，迟到的启动请求不能覆盖它', async () => {
    const pending: Array<
      (value: { scope: {}; setting: { code: string } }) => void
    > = [];
    const loadPreferences = vi.fn(
      () =>
        new Promise<{ scope: {}; setting: { code: string } }>((resolve) => {
          pending.push(resolve);
        }),
    );
    const applyPreferences = vi.fn();
    const lifecycle = createAdminUiPreferencesStartupLoader(
      loadPreferences,
      applyPreferences,
      1,
    );

    await lifecycle.prepareForMount();
    lifecycle.onApplicationMounted();
    lifecycle.onAccessTokenChanged('login-token', '');
    await vi.waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(2));

    pending[1]?.({ scope: {}, setting: { code: 'login' } });
    await vi.waitFor(() => expect(applyPreferences).toHaveBeenCalledTimes(1));
    pending[0]?.({ scope: {}, setting: { code: 'startup' } });
    await Promise.resolve();

    expect(applyPreferences).toHaveBeenCalledTimes(1);
    expect(applyPreferences).toHaveBeenLastCalledWith({
      scope: {},
      setting: { code: 'login' },
    });
  });

  it('偏好接口失败不会抛出或阻断登录后的加载流程', async () => {
    const loadPreferences = vi
      .fn()
      .mockRejectedValue(new Error('network error'));
    const lifecycle = createAdminUiPreferencesStartupLoader(loadPreferences);

    await expect(lifecycle.prepareForMount()).resolves.toBeUndefined();
    lifecycle.onApplicationMounted();
    lifecycle.onAccessTokenChanged('login-token', '');
    await vi.waitFor(() => expect(loadPreferences).toHaveBeenCalledTimes(2));
  });
});
