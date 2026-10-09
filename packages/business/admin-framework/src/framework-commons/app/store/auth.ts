import type { Recordable, UserInfo } from '@vben/runtime/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/runtime/constants';
import {
  resetAllStores,
  useAccessStore,
  useTabbarStore,
  useUserStore,
} from '@vben/runtime/stores';

import { preferences } from '@vben-core/foundation/preferences';

import {
  completePasswordLoginApi,
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
} from '@levin/admin-framework/framework-commons/app/api';
import { $t } from '@levin/admin-framework/framework-commons/app/locales';
import { shouldRefreshAuthorizedPermissions } from '@levin/admin-framework/framework-commons/rbac-access';
import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import {
  INITIAL_PASSWORD_CHANGE_PATH,
  mustChangeInitialPassword,
} from '../initial-password';
import { resolveLoginRedirect } from '../router/login-redirect';
import { clearPreviousUserAccessState } from './user-access-session';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const tabbarStore = useTabbarStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  let logoutInFlight: Promise<void> | undefined;

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    return loginWith(params, loginApi, onSuccess);
  }

  async function authLoginWithAccessToken(
    accessToken: string,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;

    try {
      loginLoading.value = true;
      userInfo = await finishLoginWithAccessToken(accessToken, onSuccess);
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function authLoginWithPasswordChallenge(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    return loginWith(params, completePasswordLoginApi, onSuccess);
  }

  async function loginWith(
    params: Recordable<any>,
    login: typeof loginApi,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const { accessToken } = await login(params);

      // 如果成功获取到 accessToken
      if (accessToken) {
        userInfo = await finishLoginWithAccessToken(accessToken, onSuccess);
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(
    redirect: boolean = true,
    remoteLogout: boolean = true,
  ) {
    // A logout endpoint's own 401 must not await the operation that is awaiting it.
    if (logoutInFlight) return remoteLogout ? logoutInFlight : undefined;
    const route = router.currentRoute.value;
    const target = redirect
      ? resolveLoginRedirect(
          route.path === LOGIN_PATH ? route.query.redirect : route.fullPath,
        )
      : '';
    const hadAccessToken = remoteLogout && Boolean(accessStore.accessToken);
    // Assign before invoking the endpoint: another expired response shares this transition.
    logoutInFlight = Promise.resolve()
      .then(async () => {
        if (hadAccessToken) {
          try {
            await logoutApi();
          } catch {
            // Local session teardown must also complete when the token has expired.
          }
        }
        const { resetRoutes } = await import('../router');
        clearPreviousUserAccessState(accessStore, resetRoutes, () =>
          tabbarStore.$reset(),
        );
        userStore.setUserInfo(null);
        resetAllStores();
        accessStore.setLoginExpired(false);
        await router.replace({
          path: LOGIN_PATH,
          query: target ? { redirect: target } : {},
        });
      })
      .finally(() => {
        logoutInFlight = undefined;
      });
    return logoutInFlight;
  }

  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  async function ensureAccessCodesLoaded(force = false) {
    if (
      !force &&
      !shouldRefreshAuthorizedPermissions(accessStore.accessCodes)
    ) {
      return accessStore.accessCodes;
    }

    const accessCodes = await getAccessCodesApi();
    accessStore.setAccessCodes(accessCodes || []);
    return accessCodes || [];
  }

  async function finishLoginWithAccessToken(
    accessToken: string,
    onSuccess?: () => Promise<void> | void,
  ) {
    const { resetRoutes } = await import('../router');
    clearPreviousUserAccessState(accessStore, resetRoutes, () =>
      tabbarStore.$reset(),
    );
    userStore.setUserInfo(null);
    accessStore.setAccessToken(accessToken);

    // 先读取服务端首次改密状态；待改密会话不得请求权限和菜单。
    const userInfo = await fetchUserInfo();
    if (!userInfo) {
      throw new Error('无法读取当前登录用户信息');
    }
    userStore.setUserInfo(userInfo);
    if (mustChangeInitialPassword(userInfo)) {
      accessStore.setAccessCodes([]);
      accessStore.setIsAccessChecked(false);
      accessStore.setLoginExpired(false);
      await router.replace({
        path: INITIAL_PASSWORD_CHANGE_PATH,
        query: { tab: 'password' },
      });
      return userInfo;
    }

    const accessCodes = await ensureAccessCodesLoaded(true);
    accessStore.setAccessCodes(accessCodes);

    // 用户信息和权限码到位后再次撤销路由检查状态，避免旧账号未完成的异步路由生成回写其结果。
    accessStore.setIsAccessChecked(false);

    if (accessStore.loginExpired) {
      accessStore.setLoginExpired(false);
    } else {
      onSuccess
        ? await onSuccess?.()
        : await router.push(
            userInfo.homePath || preferences.app.defaultHomePath,
          );
    }

    if (userInfo?.realName) {
      notification.success({
        description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
        duration: 2,
        message: $t('authentication.loginSuccess'),
      });
    }

    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    authLoginWithAccessToken,
    authLoginWithPasswordChallenge,
    ensureAccessCodesLoaded,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
