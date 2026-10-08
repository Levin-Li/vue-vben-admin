import type { InAppOAuthTransaction } from '../../../api/oauth-service';

export type EnterpriseContainer =
  | 'DINGTALK_V2'
  | 'FEISHU'
  | 'WECHAT_ENTERPRISE_V2';
const ATTEMPT_TTL_MS = 3 * 60 * 1000;
const SDK_TIMEOUT_MS = 10_000;
const DINGTALK_SCRIPT =
  'https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.3/dingtalk.open.js';

interface DingTalkBridge {
  error?: (callback: (failure: unknown) => void) => void;
  ready?: (callback: () => void) => void;
  runtime?: {
    permission?: {
      requestAuthCode?: (options: {
        corpId: string;
        onFail: () => void;
        onSuccess: (result: { code?: string }) => void;
      }) => void;
    };
  };
}
let sdkLoading: Promise<DingTalkBridge> | undefined;

// UA 仅选择授权流程，最终身份与权限完全由服务端验证。
export function detectEnterpriseContainer(
  userAgent: string,
): EnterpriseContainer | null {
  if (/wxwork/i.test(userAgent)) return 'WECHAT_ENTERPRISE_V2';
  if (/dingtalk/i.test(userAgent)) return 'DINGTALK_V2';
  if (/feishu|lark/i.test(userAgent)) return 'FEISHU';
  return null;
}

// 保留目标业务路径及查询参数，移除上次 OAuth 结果参数。
export function buildInAppReturnUrl(href: string): string {
  const url = new URL(href);
  for (const key of [
    'oauthError',
    'oauthTransaction',
    'oauthTransactionId',
    'transactionId',
    'oauthState',
    'code',
    'state',
  ])
    url.searchParams.delete(key);
  return url.toString();
}

// 存储仅记录尝试时间，不保存授权码、平台资料或令牌。
export function claimInAppAttempt(
  storage: Storage,
  platform: string,
  site: string,
  target: string,
  now = Date.now(),
): boolean {
  const key = `ENTERPRISE_INAPP_ATTEMPT:${platform}:${site}:${target}`;
  try {
    const previous = Number(storage.getItem(key));
    if (previous > 0 && now >= previous && now - previous < ATTEMPT_TTL_MS)
      return false;
    storage.setItem(key, String(now));
    return true;
  } catch {
    // 无法记录尝试时关闭自动跳转，保留手动登录入口。
    return false;
  }
}

function currentBridge(): DingTalkBridge | undefined {
  const bridge = (window as Window & { dd?: DingTalkBridge }).dd;
  return typeof bridge?.runtime?.permission?.requestAuthCode === 'function'
    ? bridge
    : undefined;
}

// 固定官方脚本、单次加载与超时；伪造 UA 不会产生可信授权码。
export function loadDingTalkBridge(): Promise<DingTalkBridge> {
  const ready = currentBridge();
  if (ready) return Promise.resolve(ready);
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(
      () => finish(new Error('钉钉授权组件加载超时，请使用普通登录')),
      SDK_TIMEOUT_MS,
    );
    const finish = (error?: Error) => {
      clearTimeout(timer);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      const bridge = currentBridge();
      if (error || !bridge) {
        script.remove();
        reject(error || new Error('当前页面无法调用钉钉授权，请使用普通登录'));
      } else resolve(bridge);
    };
    script.src = DINGTALK_SCRIPT;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    const onLoad = () => finish();
    script.addEventListener('load', onLoad);
    const onError = () =>
      finish(new Error('钉钉授权组件加载失败，请使用普通登录'));
    script.addEventListener('error', onError);
    document.head.append(script);
  });
  return sdkLoading;
}

export async function requestDingTalkCode(corpId: string): Promise<string> {
  if (!corpId) throw new Error('钉钉企业标识未配置，请联系管理员');
  const bridge = await loadDingTalkBridge();
  if (typeof bridge.ready !== 'function')
    throw new Error('当前页面无法调用钉钉授权，请使用普通登录');

  // 脚本下载不等于容器就绪；同一状态机拒绝 SDK 错误、迟到及重复回调。
  return new Promise((resolve, reject) => {
    let settled = false;
    let authStarted = false;
    let timer = setTimeout(
      () => fail('钉钉授权组件初始化超时，请使用普通登录'),
      SDK_TIMEOUT_MS,
    );
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(message));
    };
    try {
      bridge.error?.(() => fail('钉钉授权组件初始化失败，请使用普通登录'));
      if (settled) return;
      bridge.ready?.(() => {
        if (settled || authStarted) return;
        authStarted = true;
        clearTimeout(timer);
        timer = setTimeout(
          () => fail('钉钉授权超时，请使用普通登录'),
          SDK_TIMEOUT_MS,
        );
        try {
          const permission = bridge.runtime?.permission;
          if (!permission?.requestAuthCode) throw new Error('钉钉授权不可用');
          permission.requestAuthCode({
            corpId,
            onFail: () => fail('钉钉授权失败，请使用普通登录'),
            onSuccess: (result) => {
              if (settled) return;
              if (typeof result?.code !== 'string' || !result.code.trim()) {
                fail('钉钉未返回授权码，请使用普通登录');
                return;
              }
              settled = true;
              clearTimeout(timer);
              resolve(result.code);
            },
          });
        } catch {
          fail('当前页面无法调用钉钉授权，请使用普通登录');
        }
      });
    } catch {
      // 供应商初始化异常不作为错误正文或 cause 传出。
      fail('当前页面无法调用钉钉授权，请使用普通登录');
    }
  });
}

// 两种授权入口共享同一事务，钉钉授权码立即交给后端而不持久化。
export async function authorizeInAppContext(
  platform: EnterpriseContainer,
  transaction: InAppOAuthTransaction,
  authorize: (
    id: string,
    data: { code: string; state: string },
  ) => Promise<unknown>,
  navigate: (url: string) => void = (url) => location.assign(url),
): Promise<boolean> {
  const id = transaction.transactionId || transaction.id;
  if (!id || !transaction.state)
    throw new Error('创建企业授权事务失败，请使用普通登录');
  if (platform === 'DINGTALK_V2') {
    const code = await requestDingTalkCode(transaction.corpId || '');
    await authorize(id, { code, state: transaction.state });
    return false;
  }
  const url = new URL(transaction.authorizeUrl || '');
  const allowedHost =
    platform === 'FEISHU' ? 'accounts.feishu.cn' : 'open.weixin.qq.com';
  if (
    url.protocol !== 'https:' ||
    url.hostname !== allowedHost ||
    url.username ||
    url.password
  )
    throw new Error('企业授权地址无效，请联系管理员');
  navigate(url.toString());
  return true;
}
