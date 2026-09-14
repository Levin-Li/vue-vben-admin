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

import { useAuthStore } from '@levin/admin-framework/framework-commons/app/store';
import {
  currentGlobalDomainIds,
  globalDomainContextMultiple,
} from '../global-domain-context-state';
import {
  currentGlobalOrgIds,
  currentGlobalOwnerIds,
  currentGlobalTenantId,
  globalOrgContextMultiple,
  isGlobalUserOrgContextEnabled,
} from '../global-org-context-state';
import { createDynamicVerifyCodeInterceptor } from './dynamic-verify-code';
import { showApiErrorMessage } from './api-error-message';
import { createMultipartRequestInterceptor } from './multipart-request';
import { emitApiRequestEvent } from './request-events';
import {
  getHttpAuthorizationMessage,
  getServiceRespMessage,
  isBusinessErrorResponse,
  isServiceResp,
  unwrapServiceResp,
} from './service-resp';

const GLOBAL_CONTEXT_HEADERS = [
  'X-Oak-Tenant-Id',
  'X-Oak-Domain-Id',
  'X-Oak-Domain-Id-List',
  'X-Oak-Org-Id',
  'X-Oak-Org-Id-List',
  'X-Oak-Owner-Id',
  'X-Oak-Owner-Id-List',
] as const;

function setContextHeader(
  headers: Record<string, any>,
  single: string,
  list: string,
  values: string[],
  multiple: boolean,
  formatListValue: (values: string[]) => string = JSON.stringify,
) {
  Reflect.deleteProperty(headers, single);
  Reflect.deleteProperty(headers, list);
  if (values.length === 0) return;
  headers[multiple ? list : single] = multiple
    ? formatListValue(values)
    : values[0];
}

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const REQUEST_TIMEOUT_MS = 180_000;

function getUnifiedErrorMessage(msg: string, error: any) {
  const responseData = error?.response?.data ?? {};
  const httpAuthorizationMessage = getHttpAuthorizationMessage(
    error?.response?.status,
    responseData,
  );
  if (httpAuthorizationMessage) {
    return httpAuthorizationMessage;
  }

  if (isServiceResp(responseData)) {
    return getServiceRespMessage(responseData);
  }

  const backendMessage =
    responseData?.error ??
    responseData?.msg ??
    responseData?.message ??
    responseData?.detailMsg ??
    msg;

  if (isBusinessErrorResponse(responseData)) {
    return backendMessage || '业务处理失败';
  }

  return responseData?.errorType || backendMessage || '网络或服务器异常';
}

function applyCommonInterceptors(client: RequestClient) {
  client.addRequestInterceptor(createMultipartRequestInterceptor());
  client.addResponseInterceptor(createDynamicVerifyCodeInterceptor(client));

  client.addResponseInterceptor({
    fulfilled: (response: any) => {
      const { config, data: responseData, status } = response;

      if (config.__dynamicVerifyKeepRaw) {
        emitApiRequestEvent({
          config,
          data: response,
          rawData: responseData,
          response,
        });
        return response;
      }

      if (config.responseReturn === 'raw') {
        emitApiRequestEvent({
          config,
          data: response,
          rawData: responseData,
          response,
        });
        return response;
      }

      try {
        if (status >= 200 && status < 400) {
          const data = unwrapServiceResp(responseData);
          emitApiRequestEvent({
            config,
            data,
            rawData: responseData,
            response,
          });
          return data;
        }

        throw Object.assign({}, response, { response });
      } catch (error) {
        emitApiRequestEvent({
          config,
          error,
          rawData: responseData,
          response,
        });
        throw error;
      }
    },
    rejected: (error: any) => {
      emitApiRequestEvent({
        config: error?.config ?? error?.response?.config,
        error,
        rawData: error?.response?.data,
        response: error?.response,
      });
      return Promise.reject(error);
    },
  });

  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      if (error?.config?.__silentError) {
        return;
      }

      showApiErrorMessage(getUnifiedErrorMessage(msg, error));
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
    const { refreshTokenApi } = await import('./core/auth');
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
      GLOBAL_CONTEXT_HEADERS.forEach((header) =>
        Reflect.deleteProperty(config.headers, header),
      );
      if (isGlobalUserOrgContextEnabled() && currentGlobalTenantId.value) {
        config.headers['X-Oak-Tenant-Id'] = currentGlobalTenantId.value;
      }
      setContextHeader(
        config.headers,
        'X-Oak-Domain-Id',
        'X-Oak-Domain-Id-List',
        currentGlobalDomainIds.value,
        globalDomainContextMultiple.value,
      );
      if (isGlobalUserOrgContextEnabled()) {
        setContextHeader(
          config.headers,
          'X-Oak-Org-Id',
          'X-Oak-Org-Id-List',
          currentGlobalOrgIds.value,
          globalOrgContextMultiple.value,
          (values) => values.join(','),
        );
        setContextHeader(
          config.headers,
          'X-Oak-Owner-Id',
          'X-Oak-Owner-Id-List',
          currentGlobalOwnerIds.value,
          globalOrgContextMultiple.value,
          (values) => values.join(','),
        );
      }
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
  timeout: REQUEST_TIMEOUT_MS,
});

export const baseRequestClient = new RequestClient({
  baseURL: apiURL,
  paramsSerializer: 'repeat',
  responseReturn: 'data',
  timeout: REQUEST_TIMEOUT_MS,
});

applyCommonInterceptors(baseRequestClient);
