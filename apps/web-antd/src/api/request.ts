/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

import { refreshTokenApi } from './core';
import { createDynamicVerifyCodeInterceptor } from './dynamic-verify-code';
import {
  getServiceRespMessage,
  isServiceResp,
  unwrapServiceResp,
} from './service-resp';

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
  return Number.isFinite(code) && code >= 10_000 && code < 20_000;
}

function getUnifiedErrorMessage(msg: string, error: any) {
  const responseData = error?.response?.data ?? {};
  if (isServiceResp(responseData)) {
    return getServiceRespMessage(responseData);
  }

  const backendMessage =
    responseData?.error ??
    responseData?.msg ??
    responseData?.message ??
    responseData?.detailMsg ??
    msg;

  if (isBusinessError(responseData)) {
    return backendMessage || '业务处理失败';
  }

  return responseData?.errorType || backendMessage || '网络或服务器异常';
}

function applyCommonInterceptors(client: RequestClient) {
  client.addResponseInterceptor(createDynamicVerifyCodeInterceptor(client));

  client.addResponseInterceptor({
    fulfilled: (response: any) => {
      const { config, data: responseData, status } = response;

      if (config.__dynamicVerifyKeepRaw) {
        return response;
      }

      if (config.responseReturn === 'raw') {
        return response;
      }

      if (status >= 200 && status < 400) {
        return unwrapServiceResp(responseData);
      }

      throw Object.assign({}, response, { response });
    },
  });

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
    const newToken =
      typeof resp === 'string' ? resp : resp?.data || resp?.accessToken || '';
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

  applyCommonInterceptors(client);

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  paramsSerializer: 'repeat',
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({
  baseURL: apiURL,
  paramsSerializer: 'repeat',
  responseReturn: 'data',
});

applyCommonInterceptors(baseRequestClient);
