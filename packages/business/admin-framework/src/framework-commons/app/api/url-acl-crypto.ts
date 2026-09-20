const RBAC_API_PATH_PATTERN = /(?:^|\/)rbac(?:\/|$)/;

const ENUM_API_PATH_PATTERN = /(?:^|\/)enums(?:\/|$)/;

const RBAC_BINARY_RESOURCE_PATH_PATTERN = /(?:^|\/)rbac\/captcha$/;

// 这些入口在未登录前建立租户界面和登录会话，必须始终用浏览器 User-Agent 作为加密来源。
const ANONYMOUS_RBAC_CRYPTO_PATH_PATTERN =
  /(?:^|\/)rbac\/(?:login|loginoptions|loginverifychallenge(?:\/complete)?|tenantinfo|tenantsiteinfo|getverifycode|register)$/;

const negotiatedCryptoPathKeys = new Set<string>();

const negotiatedSignaturePathKeys = new Set<string>();

function normalizeCryptoPath(url: unknown) {
  return (
    String(url || '')
      .trim()
      .toLowerCase()
      .split(/[?#]/, 1)[0] ?? ''
  );
}

function negotiatedCryptoPathKey(url: unknown, domain: string) {
  return `${domain.trim().toLowerCase()}\n${normalizeCryptoPath(url)}`;
}

export function isClientCryptoPath(url: unknown) {
  // 只依据路径判断，避免 query 或 hash 中的文本意外扩大主动加密范围。
  const path = normalizeCryptoPath(url);

  // RBAC JSON API 统一主动加密，避免新增接口时遗漏租户、用户等敏感返回。
  if (ENUM_API_PATH_PATTERN.test(path)) return true;

  if (!RBAC_API_PATH_PATTERN.test(path)) return false;

  // 图片验证码由浏览器 img 直连加载，不能携带自定义加密头或接收 JSON 加密信封。
  return !RBAC_BINARY_RESOURCE_PATH_PATTERN.test(path);
}

/**
 * 判断请求是否属于未登录阶段的 RBAC JSON API。
 *
 * 不能只根据当前页面路由判断：应用根路由也可能直接渲染登录页，
 * 此时历史 accessToken 不得参与登录、租户信息与验证码链路的密钥派生。
 */
export function isAnonymousRbacCryptoPath(url: unknown) {
  return ANONYMOUS_RBAC_CRYPTO_PATH_PATTERN.test(normalizeCryptoPath(url));
}

/** 仅保存当前页面运行时内协商成功的接口，不写入任何浏览器持久化存储。 */
export function rememberNegotiatedCryptoPath(url: unknown, domain: string) {
  negotiatedCryptoPathKeys.add(negotiatedCryptoPathKey(url, domain));
}

export function hasNegotiatedCryptoPath(url: unknown, domain: string) {
  return negotiatedCryptoPathKeys.has(negotiatedCryptoPathKey(url, domain));
}

/** 主动路径与协商记忆只在此处汇合；后续始终复用同一 AES-GCM 请求与响应处理。 */
export function shouldEncryptClientRequest(url: unknown, domain: string) {
  return isClientCryptoPath(url) || hasNegotiatedCryptoPath(url, domain);
}

export function shouldRetryCryptoNegotiation(
  requiredAlgorithm: unknown,
  url: unknown,
  hasRetried: boolean,
) {
  return requiredAlgorithm === 'AES_GCM' && Boolean(url) && !hasRetried;
}

/** 仅保存当前页面运行时内协商成功的签名接口，不写入任何浏览器持久化存储。 */
export function rememberNegotiatedSignaturePath(url: unknown, domain: string) {
  negotiatedSignaturePathKeys.add(negotiatedCryptoPathKey(url, domain));
}

export function hasNegotiatedSignaturePath(url: unknown, domain: string) {
  return negotiatedSignaturePathKeys.has(negotiatedCryptoPathKey(url, domain));
}

/** 签名协商命中的请求与后续重试共用同一签名构造流程。 */
export function shouldSignClientRequest(url: unknown, domain: string) {
  return hasNegotiatedSignaturePath(url, domain);
}

/** 仅 HMAC-SHA256 协商且尚未重试的有效请求允许自动签名重发一次。 */
export function shouldRetrySignatureNegotiation(
  requiredAlgorithm: unknown,
  url: unknown,
  hasRetried: boolean,
) {
  return requiredAlgorithm === 'HMAC_SHA256' && Boolean(url) && !hasRetried;
}

export function hex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

export async function sha256(bytes: Uint8Array) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function resolveMinuteByNonce(
  nonce: string,
  domain: string,
  nowMillis = Date.now(),
) {
  const encoder = new TextEncoder();
  const nowMinute = Math.floor(nowMillis / 60_000);
  for (let minute = nowMinute - 1; minute <= nowMinute + 1; minute++) {
    if (hex(await sha256(encoder.encode(`${minute}\n${domain}`))) === nonce) {
      return minute;
    }
  }
  throw new Error('加密响应已过期');
}

export async function importCryptoKey(
  domain: string,
  source: string,
  minute: number,
) {
  const material = await sha256(
    new TextEncoder().encode(`${domain}\n${source}\n${minute}`),
  );
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
