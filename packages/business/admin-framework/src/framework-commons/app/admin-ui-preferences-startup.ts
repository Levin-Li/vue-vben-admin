import {
  applyAdminUiPreferencesSetting,
  resolveAdminUiPreferencesSetting,
} from './admin-ui-preferences-setting';
import type { UiSettingRuntimeResolution } from './api/ui-setting-runtime';

type PreferencesLoader = () => Promise<UiSettingRuntimeResolution>;
type PreferencesApplier = (resolution: UiSettingRuntimeResolution) => void;

export const ADMIN_UI_PREFERENCES_STARTUP_TIMEOUT = 3_000;

/**
 * 管理界面偏好在启动预加载和登录成功两个时点分别向服务端加载。
 */
export function createAdminUiPreferencesStartupLoader(
  loadPreferences: PreferencesLoader = resolveAdminUiPreferencesSetting,
  applyPreferences: PreferencesApplier = applyAdminUiPreferencesSetting,
  timeoutMs = ADMIN_UI_PREFERENCES_STARTUP_TIMEOUT,
) {
  let applicationMounted = false;
  let latestRequestId = 0;
  let startupRequest: Promise<void> | undefined;

  /**
   * 偏好设置属于增强能力，接口失败不能阻断应用或登录流程；旧请求不能覆盖新上下文结果。
   */
  function loadSafely() {
    const requestId = ++latestRequestId;
    return loadPreferences()
      .then((resolution) => {
        if (requestId === latestRequestId) applyPreferences(resolution);
      })
      .catch(() => undefined);
  }

  /**
   * 启动期请求只发起一次；挂载前最多等待指定时间，超时后请求仍在后台补应用。
   */
  async function prepareForMount() {
    startupRequest ||= loadSafely();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timeoutId = setTimeout(resolve, timeoutMs);
    });

    await Promise.race([startupRequest, timeout]);

    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  return {
    /**
     * 应用挂载完成后允许令牌变化发起更精确的用户范围请求。
     */
    onApplicationMounted() {
      applicationMounted = true;
    },

    prepareForMount,

    /**
     * 应用已挂载时，令牌变更代表登录成功或账号切换，重新获取偏好。
     */
    onAccessTokenChanged(accessToken?: string, previousAccessToken?: string) {
      if (
        applicationMounted &&
        accessToken &&
        accessToken !== previousAccessToken
      ) {
        void loadSafely();
      }
    },
  };
}
