import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  authorizeInAppContext,
  buildInAppReturnUrl,
  claimInAppAttempt,
  detectEnterpriseContainer,
  loadDingTalkBridge,
  requestDingTalkCode,
} from '../enterprise-inapp';

// 测试只使用短期授权码，不保存访问令牌或供应商个人资料。
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as Window & { dd?: unknown }).dd;
  document
    .querySelectorAll('script[src*="dingtalk-jsapi"]')
    .forEach((node) => node.remove());
  sessionStorage.clear();
});

describe('企业 App 授权流程选择与重试保护', () => {
  it.each([
    ['wxwork MicroMessenger', 'WECHAT_ENTERPRISE_V2'],
    ['MicroMessenger', null],
    ['DingTalk', 'DINGTALK_V2'],
    ['Feishu', 'FEISHU'],
    ['Lark', 'FEISHU'],
    ['Chrome', null],
  ])('容器 %s 只用于选择流程', (ua, platform) => {
    expect(detectEnterpriseContainer(ua)).toBe(platform);
  });

  it('回跳清除结果参数并完整保留业务深链', () => {
    const url = new URL(
      buildInAppReturnUrl(
        'https://admin.test/auth/login?redirect=%2Forders%2F42%3Ftab%3Ddetails%26a%3D1&oauthError=failed&oauthTransaction=old&state=old&code=old',
      ),
    );
    expect(url.searchParams.get('redirect')).toBe('/orders/42?tab=details&a=1');
    expect(url.searchParams.has('code')).toBe(false);
    expect(url.searchParams.has('state')).toBe(false);
    expect(url.searchParams.has('oauthError')).toBe(false);
    expect(url.searchParams.has('oauthTransaction')).toBe(false);
  });

  it('同平台站点目标短期内禁止重试，目标与超时独立', () => {
    expect(
      claimInAppAttempt(sessionStorage, 'FEISHU', 'site', '/a', 1000),
    ).toBe(true);
    expect(
      claimInAppAttempt(sessionStorage, 'FEISHU', 'site', '/a', 1001),
    ).toBe(false);
    expect(
      claimInAppAttempt(sessionStorage, 'FEISHU', 'site', '/b', 1001),
    ).toBe(true);
    expect(
      claimInAppAttempt(sessionStorage, 'FEISHU', 'site', '/a', 181_001),
    ).toBe(true);
    expect(
      Array.from({ length: sessionStorage.length }, (_, index) =>
        sessionStorage.getItem(sessionStorage.key(index) || ''),
      ),
    ).toEqual(['181001', '1001']);
  });

  it('浏览器不允许保存尝试状态时关闭自动授权', () => {
    const storage = {
      getItem: () => {
        throw new Error('禁止存储');
      },
    } as unknown as Storage;
    expect(claimInAppAttempt(storage, 'FEISHU', 'site', '/')).toBe(false);
  });

  it('飞书和企微使用同页可信地址授权，拒绝非平台地址', async () => {
    const navigate = vi.fn();
    const authorize = vi.fn();
    expect(
      await authorizeInAppContext(
        'FEISHU',
        {
          id: 'tx',
          state: 'state',
          authorizeUrl:
            'https://accounts.feishu.cn/open-apis/authen/v1/authorize',
        },
        authorize,
        navigate,
      ),
    ).toBe(true);
    expect(
      await authorizeInAppContext(
        'WECHAT_ENTERPRISE_V2',
        {
          id: 'tx',
          state: 'state',
          authorizeUrl: 'https://open.weixin.qq.com/connect/oauth2/authorize',
        },
        authorize,
        navigate,
      ),
    ).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(2);
    await expect(
      authorizeInAppContext(
        'FEISHU',
        { id: 'tx', state: 'state', authorizeUrl: 'https://evil.test/' },
        authorize,
        navigate,
      ),
    ).rejects.toThrow('企业授权地址无效');
    expect(authorize).not.toHaveBeenCalled();
  });

  it('钉钉 code 立即提交后端，不能直接成为登录身份', async () => {
    (window as Window & { dd?: unknown }).dd = {
      ready: (callback: () => void) => callback(),
      runtime: {
        permission: {
          requestAuthCode: ({
            onSuccess,
          }: {
            onSuccess: (result: { code: string }) => void;
          }) => onSuccess({ code: 'short-lived-code' }),
        },
      },
    };
    const authorize = vi.fn().mockResolvedValue({ status: 'COMPLETED' });
    expect(
      await authorizeInAppContext(
        'DINGTALK_V2',
        { id: 'tx', state: 'bound-state', corpId: 'corp' },
        authorize,
      ),
    ).toBe(false);
    expect(authorize).toHaveBeenCalledWith('tx', {
      code: 'short-lived-code',
      state: 'bound-state',
    });
    expect(sessionStorage.length).toBe(0);
  });

  it('钉钉拒绝授权和空 code 安全失败', async () => {
    (window as Window & { dd?: unknown }).dd = {
      ready: (callback: () => void) => callback(),
      runtime: {
        permission: {
          requestAuthCode: ({ onFail }: { onFail: () => void }) => onFail(),
        },
      },
    };
    await expect(requestDingTalkCode('corp')).rejects.toThrow('钉钉授权失败');
    (window as Window & { dd?: unknown }).dd = {
      ready: (callback: () => void) => callback(),
      runtime: {
        permission: {
          requestAuthCode: ({
            onSuccess,
          }: {
            onSuccess: (result: object) => void;
          }) => onSuccess({}),
        },
      },
    };
    await expect(requestDingTalkCode('corp')).rejects.toThrow(
      '钉钉未返回授权码',
    );
    await expect(requestDingTalkCode('')).rejects.toThrow('企业标识未配置');
  });

  it('钉钉真实 ready 延迟完成前不调用取码，重复 ready 只取一次', async () => {
    let signalReady: () => void = () => {};
    const requestAuthCode = vi.fn(
      ({ onSuccess }: { onSuccess: (result: { code: string }) => void }) =>
        onSuccess({ code: 'ready-code' }),
    );
    (window as Window & { dd?: unknown }).dd = {
      ready: (callback: () => void) => {
        signalReady = callback;
      },
      runtime: { permission: { requestAuthCode } },
    };
    const result = requestDingTalkCode('corp');
    await Promise.resolve();
    expect(requestAuthCode).not.toHaveBeenCalled();
    signalReady();
    signalReady();
    await expect(result).resolves.toBe('ready-code');
    expect(requestAuthCode).toHaveBeenCalledTimes(1);
  });

  it('缺少 ready 的钉钉对象不能取码', async () => {
    const requestAuthCode = vi.fn(
      ({ onSuccess }: { onSuccess: (result: { code: string }) => void }) =>
        onSuccess({ code: 'must-not-return' }),
    );
    (window as Window & { dd?: unknown }).dd = {
      runtime: { permission: { requestAuthCode } },
    };
    await expect(requestDingTalkCode('corp')).rejects.toThrow(
      '无法调用钉钉授权',
    );
    expect(requestAuthCode).not.toHaveBeenCalled();
  });

  it('钉钉 SDK error 在 ready 前拒绝且不泄露供应商内容', async () => {
    let signalError: (failure: unknown) => void = () => {};
    const requestAuthCode = vi.fn();
    (window as Window & { dd?: unknown }).dd = {
      ready: vi.fn(),
      error: (callback: (failure: unknown) => void) => {
        signalError = callback;
      },
      runtime: { permission: { requestAuthCode } },
    };
    const result = requestDingTalkCode('corp');
    const rejected = expect(result).rejects.toThrow(
      '钉钉授权组件初始化失败，请使用普通登录',
    );
    await Promise.resolve();
    signalError({
      message: 'synthetic-sensitive-sdk-data',
      accessToken: 'must-not-leak',
    });
    await rejected;
    expect(requestAuthCode).not.toHaveBeenCalled();
  });

  it('ready 后发生 SDK error 也不能用迟到 code 完成授权', async () => {
    let signalError: (failure: unknown) => void = () => {};
    let returnCode: (result: { code: string }) => void = () => {};
    (window as Window & { dd?: unknown }).dd = {
      ready: (callback: () => void) => callback(),
      error: (callback: (failure: unknown) => void) => {
        signalError = callback;
      },
      runtime: {
        permission: {
          requestAuthCode: ({
            onSuccess,
          }: {
            onSuccess: (result: { code: string }) => void;
          }) => {
            returnCode = onSuccess;
          },
        },
      },
    };
    const result = requestDingTalkCode('corp');
    const rejected = expect(result).rejects.toThrow(
      '钉钉授权组件初始化失败，请使用普通登录',
    );
    await Promise.resolve();
    signalError({ message: 'synthetic-sensitive-sdk-data' });
    returnCode({ code: 'late-code-must-not-return' });
    await rejected;
  });

  it('钉钉 ready 超时后即使迟到 ready 也不取码', async () => {
    vi.useFakeTimers();
    let signalReady: () => void = () => {};
    const requestAuthCode = vi.fn();
    (window as Window & { dd?: unknown }).dd = {
      ready: (callback: () => void) => {
        signalReady = callback;
      },
      runtime: { permission: { requestAuthCode } },
    };
    const result = requestDingTalkCode('corp');
    const rejected = expect(result).rejects.toThrow(
      '钉钉授权组件初始化超时，请使用普通登录',
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    signalReady();
    expect(requestAuthCode).not.toHaveBeenCalled();
  });

  it('伪造钉钉 UA 且无实际 SDK 能力时去重加载并超时停止', async () => {
    vi.useFakeTimers();
    const append = document.head.append.bind(document.head);
    vi.spyOn(document.head, 'append').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement)
        node.type = 'application/blocked-test-script';
      append(node);
    });
    const first = loadDingTalkBridge();
    const second = loadDingTalkBridge();
    expect(first).toBe(second);
    const assertion = expect(first).rejects.toThrow('加载超时');
    expect(
      document.querySelectorAll(
        'script[src="https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.3/dingtalk.open.js"]',
      ),
    ).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(
      document.querySelectorAll('script[src*="dingtalk-jsapi"]'),
    ).toHaveLength(0);
  });
});
