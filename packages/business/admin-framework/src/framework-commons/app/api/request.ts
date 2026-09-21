/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/runtime/request';

import { useAppConfig } from '@vben/runtime/hooks';
import { preferences } from '@vben-core/foundation/preferences';
import {
  authenticateResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/runtime/request';
import { useAccessStore } from '@vben/runtime/stores';

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
  isAnonymousRbacCryptoPath,
  rememberNegotiatedCryptoPath,
  rememberNegotiatedSignaturePath,
  resolveMinuteByNonce,
  shouldEncryptClientRequest,
  shouldRetryCryptoNegotiation,
  shouldRetrySignatureNegotiation,
  shouldSignClientRequest,
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
  return shouldEncryptClientRequest(config?.url, window.location.hostname);
}

function isClientSignatureRequest(config: any) {
  return shouldSignClientRequest(config?.url, window.location.hostname);
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
    (window.location.pathname.startsWith('/auth/') ||
      isAnonymousRbacCryptoPath(config?.url))
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
  // 保存原始业务载荷，协商响应触发重发时不能复用 Axios 已转换的字符串请求体。
  if (!Reflect.has(config, '__urlAclPlainData')) {
    config.__urlAclPlainData = config.data;
  }

  if (!isClientCryptoRequest(config) || config.__urlAclCrypto) return config;
  const domain = window.location.hostname.toLowerCase();
  const minute = Math.floor(Date.now() / 60_000);
  const anonymousCryptoContext = isAnonymousCryptoContext(config);
  const source = resolveClientCryptoSource(anonymousCryptoContext);
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
  // 登录、注册和匿名租户上下文不能携带历史登录态；否则服务端会按 token、
  // 客户端却按匿名 User-Agent 派生密钥，造成 AES-GCM 校验失败。
  if (anonymousCryptoContext) {
    Reflect.deleteProperty(config.headers, 'Authorization');
    Reflect.deleteProperty(config.headers, 'authorization');
  }
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

/** 对协商命中的请求生成与服务端原始明文体一致的 URL ACL 签名。 */
async function signClientRequest(config: any) {
  if (!isClientSignatureRequest(config) || config.__urlAclSignature) {
    return config;
  }

  // 加密与签名同时要求时，签名绑定解密后会交给 URL ACL 的原始 JSON 正文。
  const bodyData = config.__urlAclCrypto
    ? config.__urlAclPlainData
    : config.data;
  const body =
    typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData ?? {});
  const domain = window.location.hostname.toLowerCase();
  const source = resolveClientCryptoSource(isAnonymousCryptoContext(config));
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const bodyHash = hex(await sha256(new TextEncoder().encode(body)));
  const minute = Math.floor(Number(timestamp) / 60_000);
  const signingKey = await sha256(
    new TextEncoder().encode(`${domain}\n${source}\n${minute}`),
  );

  config.headers ||= {};
  const appId = configuredAppId();
  if (appId) config.headers['X-UrlAcl-App-Id'] = appId;
  config.headers['X-UrlAcl-Timestamp'] = timestamp;
  config.headers['X-UrlAcl-Nonce'] = nonce;
  config.headers['X-UrlAcl-Body-Sha256'] = bodyHash;
  config.headers['X-UrlAcl-Signature'] = hex(
    await hmacSha256(signingKey, `${timestamp}\n${nonce}\n${bodyHash}`),
  );
  config.__urlAclSignature = true;
  config.__urlAclSignatureSource = source;
  return config;
}

/** 加密完成后再按原始明文体签名，两个协商路径始终复用这一个公共入口。 */
async function secureClientRequest(config: any) {
  return signClientRequest(await encryptClientRequest(config));
}

/** 重发时清除上次请求的协议状态，确保公共安全入口重新生成随机材料。 */
function resetSecurityRequestForRetry(config: any) {
  const headers = { ...config.headers };
  [
    'X-UrlAcl-Crypto-Algorithm',
    'X-UrlAcl-Crypto-Iv',
    'X-UrlAcl-Crypto-Nonce',
    'X-UrlAcl-Timestamp',
    'X-UrlAcl-Nonce',
    'X-UrlAcl-Body-Sha256',
    'X-UrlAcl-Signature',
  ].forEach((header) => Reflect.deleteProperty(headers, header));

  return {
    ...config,
    data: config.__urlAclPlainData,
    headers,
    __urlAclCrypto: false,
    __urlAclSignature: false,
  };
}

/** 协商只允许重发一次，避免服务端配置异常或中间代理篡改响应时形成请求循环。 */
function addCryptoNegotiationInterceptor(client: RequestClient) {
  client.addResponseInterceptor({
    rejected: async (error: any) => {
      const response = error?.response;
      const config = error?.config || response?.config;
      const required = responseHeader(
        response?.headers,
        'X-UrlAcl-Crypto-Required',
      );

      if (
        !shouldRetryCryptoNegotiation(
          required,
          config?.url,
          Boolean(config?.__urlAclCryptoNegotiationRetry),
        )
      ) {
        throw error;
      }

      // 仅以服务端协商头建立页面内记忆；密钥仍按每次请求的当前上下文重新派生。
      rememberNegotiatedCryptoPath(config.url, window.location.hostname);

      return client.instance.request({
        ...resetSecurityRequestForRetry(config),
        __urlAclCryptoNegotiationRetry: true,
      });
    },
  });
}

/** 签名协商与加密协商都优先于登录态处理，避免 428 被误判为会话过期。 */
function addSignatureNegotiationInterceptor(client: RequestClient) {
  client.addResponseInterceptor({
    rejected: async (error: any) => {
      const response = error?.response;
      const config = error?.config || response?.config;
      const required = responseHeader(
        response?.headers,
        'X-UrlAcl-Signature-Required',
      );

      if (
        !shouldRetrySignatureNegotiation(
          required,
          config?.url,
          Boolean(config?.__urlAclSignatureNegotiationRetry),
        )
      ) {
        throw error;
      }

      // 只记忆服务端明确协商的路径；每次重试都会重新生成时间戳和随机串。
      rememberNegotiatedSignaturePath(config.url, window.location.hostname);
      return client.instance.request({
        ...resetSecurityRequestForRetry(config),
        __urlAclSignatureNegotiationRetry: true,
      });
    },
  });
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
  client.addRequestInterceptor({ fulfilled: secureClientRequest });
  client.addRequestInterceptor(createMultipartRequestInterceptor());
  client.addResponseInterceptor(createDynamicVerifyCodeInterceptor(client));

  client.addResponseInterceptor({
    fulfilled: (response: any) => {
      // 协商重试会在内部重新经过本响应链；外层收到的已解包结果无需重复解密。
      if (!response?.config) return response;

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

      // 匿名认证入口必须保持无 token：它们按 User-Agent 派生 URL ACL 密钥，
      // 不能在加密后又由公共认证拦截器补回历史 Authorization。
      if (isAnonymousCryptoContext(config)) {
        Reflect.deleteProperty(config.headers, 'Authorization');
        Reflect.deleteProperty(config.headers, 'authorization');
      } else {
        config.headers.Authorization = formatToken(accessStore.accessToken);
      }
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

  // 必须早于 401 登录态处理，协商加密不表示 token 失效。
  addCryptoNegotiationInterceptor(client);
  addSignatureNegotiationInterceptor(client);

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

addCryptoNegotiationInterceptor(baseRequestClient);
addSignatureNegotiationInterceptor(baseRequestClient);
applyCommonInterceptors(baseRequestClient);
