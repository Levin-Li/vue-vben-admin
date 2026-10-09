// 供应商配置说明沿用后端指导元数据，平台和租户配置共用同一契约。
export interface ProviderOnboardingGuidance {
  applicationUrl?: string;
  documentationUrl?: string;
  markdown?: string;
  prerequisites?: string[];
  steps?: string[];
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
