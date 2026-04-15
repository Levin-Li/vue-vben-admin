/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function isBusinessError(responseData: Record<string, any>) {
  if (!responseData || typeof responseData !== 'object') {
    return false;
  }

  if (responseData.bizError === true) {
    return true;
  }

  const errorType = String(responseData.errorType || '');
  if (errorType.includes('Biz')) {
    return true;
  }

  const code = Number(responseData.code);
  return Number.isFinite(code) && code >= 10000 && code < 20000;
}

function getUnifiedErrorMessage(msg: string, error: any) {
  const responseData = error?.response?.data ?? {};
  const businessMessage =
    responseData?.error ??
    responseData?.msg ??
    responseData?.message ??
    responseData?.detailMsg ??
    msg;

  if (isBusinessError(responseData)) {
    return businessMessage || '业务处理失败';
  }

  return '网络或服务器异常';
}

function applyCommonInterceptors(
  client: RequestClient,
  enableAuth: boolean,
) {
  if (enableAuth) {
    client.addResponseInterceptor(
      defaultResponseInterceptor({
        codeField: 'code',
        dataField: 'data',
        successCode: 0,
      }),
    );
  }

  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      message.error(getUnifiedErrorMessage(msg, error));
    }),
  );
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi();
    const newToken = resp.data;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function formatToken(token: null | string) {
    return token || null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  applyCommonInterceptors(client, true);

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({
  baseURL: apiURL,
  responseReturn: 'data',
});

applyCommonInterceptors(baseRequestClient, false);
