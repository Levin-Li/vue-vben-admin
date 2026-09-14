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
import { showApiErrorMessage } from './api-error-message';
import { createDynamicVerifyCodeInterceptor } from './dynamic-verify-code';
import { createMultipartRequestInterceptor } from './multipart-request';
import { emitApiRequestEvent } from './request-events';
import {
  getHttpAuthorizationMessage,
  getServiceRespMessage,
  isBusinessErrorResponse,
  isServiceResp,
  unwrapServiceResp,
} from './service-resp';
import {
  importCryptoKey,
  isClientCryptoPath,
  resolveMinuteByNonce,
} from './url-acl-crypto';

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

function isClientCryptoRequest(config: any) {
  return isClientCryptoPath(config?.url);
}

function base64(bytes: Uint8Array) {
  return btoa(String.fromCodePoint(...bytes));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

function responseHeader(headers: any, name: string) {
  if (typeof headers?.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase());
  }
  return headers?.[name] || headers?.[name.toLowerCase()];
}

async function sha256(bytes: Uint8Array) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

async function cryptoKey(domain: string, minute: number, source: string) {
  return importCryptoKey(domain, source, minute);
}

function configuredAppId() {
  return import.meta.env.VITE_URL_ACL_APP_ID?.trim() || '';
}

function resolveClientCryptoSource(forceAnonymous = false) {
  const appSecret = import.meta.env.VITE_URL_ACL_APP_SECRET?.trim();
  if (appSecret) return appSecret;
  if (forceAnonymous) return navigator.userAgent;
  return useAccessStore().accessToken || navigator.userAgent;
}

/** 公共策略：认证页的加密请求必须按未登录材料派生；其它请求优先使用当前 token。 */
function isAnonymousCryptoContext(config: any) {
  return (
    isClientCryptoRequest(config) &&
    window.location.pathname.startsWith('/auth/')
  );
}

async function hmacSha256(keyBytes: Uint8Array, content: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(content)),
  );
}

async function verifyClientResponseSignature(response: any) {
  const headers = response?.headers || {};
  const timestamp = responseHeader(headers, 'X-UrlAcl-Timestamp');
  const nonce = responseHeader(headers, 'X-UrlAcl-Nonce');
  const bodyHash = responseHeader(headers, 'X-UrlAcl-Body-Sha256');
  const signature = responseHeader(headers, 'X-UrlAcl-Signature');
  if (!timestamp && !nonce && !bodyHash && !signature) return response;
  if (!timestamp || !nonce || !bodyHash || !signature) {
    throw new Error('响应签名字段不完整');
  }
  const domain = window.location.hostname.toLowerCase();
  const rawBody =
    typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);
  const actualHash = hex(await sha256(new TextEncoder().encode(rawBody)));
  if (actualHash !== bodyHash) throw new Error('响应签名摘要不匹配');
  const minute = Math.floor(Number(timestamp) / 60_000);
  const source =
    response?.config?.__urlAclCryptoSource ||
    resolveClientCryptoSource(isAnonymousCryptoContext(response?.config));
  const signingKey = await sha256(
    new TextEncoder().encode(`${domain}\n${source}\n${minute}`),
  );
  const expected = hex(
    await hmacSha256(signingKey, `${timestamp}\n${nonce}\n${bodyHash}`),
  );
  if (expected !== signature) throw new Error('响应签名校验失败');
  return response;
}

async function encryptClientRequest(config: any) {
  if (!isClientCryptoRequest(config) || config.__urlAclCrypto) return config;
  const domain = window.location.hostname.toLowerCase();
  const minute = Math.floor(Date.now() / 60_000);
  const source = resolveClientCryptoSource(isAnonymousCryptoContext(config));
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = encoder.encode(JSON.stringify(config.data ?? {}));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await cryptoKey(domain, minute, source),
    body,
  );
  config.data = base64(new Uint8Array(cipher));
  config.headers ||= {};
  config.headers['Content-Type'] = 'text/plain';
  config.headers['X-UrlAcl-Crypto-Algorithm'] = 'AES_GCM';
  config.headers['X-UrlAcl-Crypto-Iv'] = base64(iv);
  config.headers['X-UrlAcl-Crypto-Nonce'] = hex(
    await sha256(encoder.encode(`${minute}\n${domain}`)),
  );
  const appId = configuredAppId();
  if (appId) config.headers['X-UrlAcl-App-Id'] = appId;
  config.__urlAclCrypto = true;
  config.__urlAclCryptoSource = source;
  return config;
}

async function decryptClientResponse(response: any) {
  await verifyClientResponseSignature(response);
  const headers = response?.headers || {};
  const algorithm = responseHeader(headers, 'X-UrlAcl-Crypto-Algorithm');
  const nonce = responseHeader(headers, 'X-UrlAcl-Crypto-Nonce');
  const ivText = responseHeader(headers, 'X-UrlAcl-Crypto-Iv');
  if (
    !algorithm ||
    !nonce ||
    !ivText ||
    !response?.data ||
    typeof response.data.data !== 'string'
  )
    return response;
  const domain = window.location.hostname.toLowerCase();
  const minute = await resolveMinuteByNonce(nonce, domain);
  const source =
    response?.config?.__urlAclCryptoSource ||
    resolveClientCryptoSource(isAnonymousCryptoContext(response?.config));
  const decode = (text: string) =>
    Uint8Array.from(atob(text), (char) => char.codePointAt(0) ?? 0);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(ivText) },
    await cryptoKey(domain, minute, source),
    decode(response.data.data),
  );
  response.data.data = JSON.parse(new TextDecoder().decode(plain));
  return response;
}

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
  client.addRequestInterceptor({ fulfilled: encryptClientRequest });
  client.addRequestInterceptor(createMultipartRequestInterceptor());
  client.addResponseInterceptor(createDynamicVerifyCodeInterceptor(client));

  client.addResponseInterceptor({
    fulfilled: (response: any) => {
      return decryptClientResponse(response).then((decryptedResponse) => {
        response = decryptedResponse;
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
      });
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
