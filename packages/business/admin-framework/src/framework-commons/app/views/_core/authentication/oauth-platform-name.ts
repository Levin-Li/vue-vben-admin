// 平台编码只用于协议请求，所有用户入口复用同一中文名称。
const PLATFORM_NAMES: Readonly<Record<string, string>> = {
  DINGTALK_V2: '钉钉',
  FEISHU: '飞书',
  WECHAT_ENTERPRISE_V2: '企业微信',
};

export function resolveOAuthPlatformName(
  platform: Record<string, any>,
): string {
  // 绑定接口的sourcePlatform是来源字段，成员name/nickname不能用作平台名称。
  const code = String(
    platform.sourcePlatform || platform.code || platform.platform || '',
  ).trim();
  const translated =
    PLATFORM_NAMES[(code || String(platform.name || '')).toUpperCase()];
  if (translated) return translated;

  // 未知平台保留明确名称或来源编码；Vue调用处以文本插值显示。
  return String(
    platform.title ||
      platform.platformName ||
      (platform.sourcePlatform ? code : platform.name || code) ||
      '第三方平台',
  ).trim();
}
