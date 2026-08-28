import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import {
  completePasswordLoginApi,
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
} from '@levin/admin-framework/framework-commons/app/api';
import { $t } from '@levin/admin-framework/framework-commons/app/locales';
import { shouldRefreshAuthorizedPermissions } from '@levin/admin-framework/framework-commons/rbac-access';
import { clearPreviousUserAccessState } from './user-access-session';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

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

  async function logout(redirect: boolean = true) {
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    }
    resetAllStores();
    accessStore.setLoginExpired(false);

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
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
    clearPreviousUserAccessState(accessStore, resetRoutes);
    accessStore.setAccessToken(accessToken);

    const [userInfo, accessCodes] = await Promise.all([
      fetchUserInfo(),
      ensureAccessCodesLoaded(true),
    ]);

    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);

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
        duration: 3,
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
