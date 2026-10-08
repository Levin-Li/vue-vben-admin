// 供应商配置说明沿用后端指导元数据，平台和租户配置共用同一契约。
export interface ProviderOnboardingGuidance {
  applicationUrl?: string;
  documentationUrl?: string;
  prerequisites?: string[];
  steps?: string[];
}

// 外部文档只允许不含凭据的 HTTPS 链接。
export function isSafeGuidanceUrl(value?: string) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

// 回调来源固定为当前站点和实际 OAuth API 路径，不接受配置中的任意域名。
export function buildProviderCallbackUrl(origin: string, callbackPath: string) {
  try {
    const site = new URL(origin);
    if (!['http:', 'https:'].includes(site.protocol)) return '';
    if (!callbackPath.startsWith('/') || callbackPath.startsWith('//'))
      return '';
    const callback = new URL(callbackPath, site.origin);
    if (callback.origin !== site.origin || callback.search || callback.hash)
      return '';
    return callback.href;
  } catch {
    return '';
  }
}

// 配置检查仅核对回调一致性，不把本地检查表示成平台权限验证。
export function checkProviderRedirectUri(
  value: unknown,
  expected: string,
  field = 'redirectUri',
) {
  if (!expected)
    return '无法生成回调地址，请在正常 HTTP/HTTPS 站点中打开配置。';
  if (typeof value !== 'string' || !value.trim())
    return `请将下方地址填写到 ${field}，并在平台侧配置同一回调地址。`;
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return `${field} 格式不合法：需使用不含凭据、查询参数或片段的 HTTP/HTTPS 地址。`;
    }
    return value === expected
      ? `${field} 与当前站点回调地址一致。`
      : `${field} 与当前站点回调地址不一致，请核对公开访问域名和代理配置。`;
  } catch {
    return `${field} 格式不合法：请填写完整的 HTTP/HTTPS 回调地址。`;
  }
}
