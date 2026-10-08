import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureBindCallbackBeforeStartup,
  clearPendingBindCallback,
  consumeBindCallback,
  hasPendingBindCallback,
  recoverBindCallbackForPage,
  stripBindCallbackQuery,
  takePendingBindCallback,
} from '../oauth-bind-callback';

afterEach(() => {
  clearPendingBindCallback();
  vi.useRealTimers();
});

// 清理 URL 必须先于任何后续网络调用，白名单以真实 OAuth 协议字段为边界。
describe('绑定回调的短期授权码桥接', () => {
  it('取出端内 code/state 并保留业务查询和片段', () => {
    const replace = vi.fn();
    const callback = consumeBindCallback(
      'https://admin.test/profile?tab=social&oauthTransaction=tx&oauthInAppCode=code&oauthInAppState=state#account',
      replace,
    );
    expect(replace).toHaveBeenCalledWith(
      'https://admin.test/profile?tab=social#account',
    );
    expect(callback).toEqual({
      inApp: true,
      transactionId: 'tx',
      params: { code: 'code', state: 'state' },
    });
  });

  it('普通回调仅转发协议字段，不转发令牌、身份或未知字段', () => {
    const query = new URLSearchParams({
      oauthTransaction: 'tx',
      oauthBindCallback: JSON.stringify({
        state: 'state',
        authorization_code: 'code',
        oauth_token: 'request-token',
        oauth_verifier: 'verifier',
        accessToken: 'local-session-must-not-submit',
        userId: 'other-user',
        __proto__: { forged: true },
      }),
    });
    const replace = vi.fn();
    expect(
      consumeBindCallback(`https://admin.test/profile?${query}`, replace)
        ?.params,
    ).toEqual({
      state: 'state',
      authorization_code: 'code',
      oauth_token: 'request-token',
      oauth_verifier: 'verifier',
    });
    expect(replace).toHaveBeenCalledWith('https://admin.test/profile');
  });

  it.each([
    '[]',
    'null',
    '{invalid',
    '{"code":"code"}',
    '{"state":"state"}',
    '{"state":5,"code":"code"}',
  ])('无效普通回调 %s 清 URL 后失败', (raw) => {
    const query = new URLSearchParams({
      oauthTransaction: 'tx',
      oauthBindCallback: raw,
    });
    const replace = vi.fn();
    expect(
      consumeBindCallback(`https://admin.test/profile?${query}`, replace)
        ?.error,
    ).toBe(true);
    expect(replace).toHaveBeenCalledWith('https://admin.test/profile');
  });

  it.each([
    'oauthTransaction=tx&oauthInAppState=state',
    'oauthTransaction=tx&oauthInAppCode=code',
    'oauthInAppState=state&oauthInAppCode=code',
    'oauthTransaction=tx&oauthError=failed',
  ])('缺少字段或授权失败 %s 先清 URL', (query) => {
    const replace = vi.fn();
    expect(
      consumeBindCallback(`https://admin.test/profile?${query}`, replace)
        ?.error,
    ).toBe(true);
    expect(replace).toHaveBeenCalledWith('https://admin.test/profile');
  });

  it('全局启动先清业务页参数，回调只在内存消费一次', () => {
    const replace = vi.fn();
    expect(
      captureBindCallbackBeforeStartup(
        'https://admin.test/index?from=group&oauthTransaction=tx&oauthInAppCode=code&oauthInAppState=state',
        replace,
      ),
    ).toBe(true);
    expect(replace).toHaveBeenCalledWith('https://admin.test/index?from=group');
    expect(hasPendingBindCallback()).toBe(true);
    expect(takePendingBindCallback()?.params).toEqual({
      code: 'code',
      state: 'state',
    });
    expect(takePendingBindCallback()).toBeNull();
  });

  it('内存授权码超时和用户取消后不能用于绑定', async () => {
    vi.useFakeTimers();
    captureBindCallbackBeforeStartup(
      'https://admin.test/profile?oauthTransaction=tx&oauthInAppCode=code&oauthInAppState=state',
      vi.fn(),
    );
    await vi.advanceTimersByTimeAsync(180_000);
    const expired = takePendingBindCallback();
    expect(expired?.error).toBe(true);
    expect(expired?.params.code).toBeUndefined();
    captureBindCallbackBeforeStartup(
      'https://admin.test/profile?oauthTransaction=tx&oauthInAppCode=code&oauthInAppState=state',
      vi.fn(),
    );
    clearPendingBindCallback();
    expect(hasPendingBindCallback()).toBe(false);
  });

  it('路由重新填入同一授权码时仍清当前 URL，再恢复内存回调', () => {
    const href =
      'https://admin.test/index?from=group&oauthTransaction=tx&oauthInAppCode=code&oauthInAppState=state#details';
    captureBindCallbackBeforeStartup(href, vi.fn());
    const replace = vi.fn();
    expect(recoverBindCallbackForPage(href, replace)?.params).toEqual({
      code: 'code',
      state: 'state',
    });
    expect(replace).toHaveBeenCalledWith(
      'https://admin.test/index?from=group#details',
    );
    expect(hasPendingBindCallback()).toBe(false);
    expect(
      stripBindCallbackQuery({
        from: 'group',
        tab: ['a', 'b'],
        oauthTransaction: 'tx',
        oauthInAppCode: 'code',
        oauthInAppState: 'state',
      }),
    ).toEqual({ from: 'group', tab: ['a', 'b'] });
  });

  it.each([
    'oauthTransaction=other&oauthInAppCode=code&oauthInAppState=state',
    'oauthTransaction=tx&oauthInAppCode=code&oauthInAppState=other',
    'oauthTransaction=tx&oauthInAppCode=other&oauthInAppState=state',
  ])('内存与 URL 回调不同 %s 必须拒绝且抹掉 code', (query) => {
    captureBindCallbackBeforeStartup(
      'https://admin.test/index?oauthTransaction=tx&oauthInAppCode=code&oauthInAppState=state',
      vi.fn(),
    );
    const callback = recoverBindCallbackForPage(
      `https://admin.test/index?${query}`,
      vi.fn(),
    );
    expect(callback?.error).toBe(true);
    expect(callback?.params.code).toBeUndefined();
  });

  it('全局桥接不消费普通 LOGIN 的错误参数', () => {
    const replace = vi.fn();
    expect(
      captureBindCallbackBeforeStartup(
        'https://admin.test/auth/login?oauthError=failed',
        replace,
      ),
    ).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it('普通个人页面没有桥接参数时不改写 URL', () => {
    const replace = vi.fn();
    expect(
      consumeBindCallback('https://admin.test/profile?tab=social', replace),
    ).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});
