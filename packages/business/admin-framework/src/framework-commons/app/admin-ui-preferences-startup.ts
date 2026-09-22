import { loadAdminUiPreferencesSetting } from './admin-ui-preferences-setting';

type PreferencesLoader = () => Promise<unknown>;

/**
 * 管理界面偏好必须在应用挂载和登录成功两个时点分别向服务端加载。
 */
export function createAdminUiPreferencesStartupLoader(
  loadPreferences: PreferencesLoader = loadAdminUiPreferencesSetting,
) {
  let applicationMounted = false;

  /**
   * 偏好设置属于增强能力，接口失败不能阻断应用或登录流程。
   */
  function loadSafely() {
    void loadPreferences().catch(() => undefined);
  }

  return {
    /**
     * 应用挂载完成后立即获取当前服务端界面偏好。
     */
    onApplicationMounted() {
      applicationMounted = true;
      loadSafely();
    },

    /**
     * 应用已挂载时，令牌变更代表登录成功或账号切换，重新获取偏好。
     */
    onAccessTokenChanged(accessToken?: string, previousAccessToken?: string) {
      if (
        applicationMounted &&
        accessToken &&
        accessToken !== previousAccessToken
      ) {
        loadSafely();
      }
    },
  };
}
