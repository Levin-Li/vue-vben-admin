// 平台编码只用于协议请求，所有用户入口复用同一中文名称。
const PLATFORM_NAMES: Readonly<Record<string, string>> = {
  AFDIAN: '爱发电',
  ALIPAY: '支付宝',
  ALIYUN: '阿里云',
  BAIDU: '百度',
  DINGTALK: '钉钉（旧版）',
  DINGTALK_ACCOUNT: '钉钉账号',
  DINGTALK_V2: '钉钉',
  DOUYIN: '抖音',
  ELEME: '饿了么',
  FEISHU: '飞书',
  HUAWEI: '华为',
  HUAWEI_V3: '华为（新版）',
  JD: '京东',
  KUJIALE: '酷家乐',
  MEITUAN: '美团',
  MI: '小米',
  OSCHINA: '开源中国',
  PROGINN: '程序员客栈',
  QQ_MINI_PROGRAM: 'QQ 小程序',
  RENREN: '人人网',
  TAOBAO: '淘宝',
  TOUTIAO: '今日头条',
  WECHAT_ENTERPRISE: '企业微信（旧版）',
  WECHAT_ENTERPRISE_QRCODE_THIRD: '企业微信扫码',
  WECHAT_ENTERPRISE_V2: '企业微信',
  WECHAT_ENTERPRISE_WEB: '企业微信网页授权',
  WECHAT_MINI_PROGRAM: '微信小程序',
  WECHAT_MP: '微信公众号',
  WECHAT_OPEN: '微信开放平台',
  WEIBO: '微博',
  XMLY: '喜马拉雅',
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
