import { beforeEach, describe, expect, it, vi } from 'vitest';

import { baseRequestClient, requestClient } from '../request';

const state = vi.hoisted(() => ({
  token: 'old' as null | string,
  refreshEnabled: false,
  refresh: vi.fn(),
  cleared: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('ant-design-vue', () => ({ message: { error: vi.fn() } }));
vi.mock('@vben/runtime/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/api' }),
}));
vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: {
    app: {
      locale: 'zh-CN',
      get enableRefreshToken() {
        return state.refreshEnabled;
      },
    },
  },
}));
vi.mock('../core/auth', () => ({ refreshTokenApi: state.refresh }));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({
    get accessToken() {
      return state.token;
    },
    setAccessToken: (v: null | string) => {
      state.cleared(v);
      state.token = v;
    },
  }),
  useUserStore: () => ({ userInfo: {} }),
}));
vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: () => ({ logout: state.logout }),
}));
vi.mock('../../../data-attr-policy', () => ({
  assertDataAttrSessionReady: vi.fn(),
  dataAttrRequestPath: (p: string) => p,
  isDataAttrPolicyReady: () => true,
}));
vi.mock('../dynamic-verify-code', () => ({
  createDynamicVerifyCodeInterceptor: () => ({ fulfilled: (r: unknown) => r }),
}));
vi.mock('../url-acl-crypto', () => ({
  importCryptoKey: vi.fn(),
  isAnonymousRbacCryptoPath: (p: string) => /\/rbac\/login$/.test(p),
  rememberNegotiatedCryptoPath: vi.fn(),
  rememberNegotiatedSignaturePath: vi.fn(),
  resolveMinuteByNonce: vi.fn(),
  shouldEncryptClientRequest: () => false,
  shouldRetryCryptoNegotiation: () => false,
  shouldRetrySignatureNegotiation: () => false,
  shouldSignClientRequest: () => false,
}));

const reject = (config: any, status: number, msg: string) =>
  Promise.reject(
    Object.assign(new Error('HTTP error'), {
      config,
      response: { config, status, data: { code: 20_000, msg }, headers: {} },
    }),
  );
describe('真实 Axios 401 会话复核', () => {
  beforeEach(() => {
    state.token = 'old';
    state.refreshEnabled = false;
    state.refresh.mockReset();
    state.cleared.mockClear();
    state.logout.mockReset().mockResolvedValue(undefined);
    requestClient.instance.defaults.adapter = (config) =>
      reject(config, 401, '业务异常');
  });
  it('业务401、本人正常：带正确令牌复核且保留会话', async () => {
    const probe = vi.fn(async (config: any) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { code: 0, data: { id: 'u' } },
    }));
    baseRequestClient.instance.defaults.adapter = probe;
    await expect(requestClient.get('/workflow/test')).rejects.toBeTruthy();
    expect(probe).toHaveBeenCalledOnce();
    expect(probe.mock.calls[0]?.[0].url).toBe('/rbac/userInfo');
    expect(probe.mock.calls[0]?.[0].baseURL).toBe('/api');
    expect(probe.mock.calls[0]?.[0].headers.get('Authorization')).toBe('old');
    expect(state.cleared).not.toHaveBeenCalled();
  });
  it('本人401明确过期只清理一次', async () => {
    const probe = vi.fn((config: any) =>
      reject(config, 401, '认证异常：登录已失效'),
    );
    baseRequestClient.instance.defaults.adapter = probe;
    await Promise.allSettled([
      requestClient.get('/workflow/a'),
      requestClient.get('/workflow/b'),
    ]);
    expect(probe).toHaveBeenCalledOnce();
    expect(state.cleared).toHaveBeenCalledOnce();
    expect(state.logout).toHaveBeenCalledOnce();
  });
  it.each([403, 500])('复核 HTTP %i 保留登录态', async (status) => {
    baseRequestClient.instance.defaults.adapter = (config) =>
      reject(config, status, '失败');
    await expect(requestClient.get('/workflow/test')).rejects.toBeTruthy();
    expect(state.cleared).not.toHaveBeenCalled();
  });
  it('复核期间切换账号不清理新令牌', async () => {
    let finish!: () => void;
    baseRequestClient.instance.defaults.adapter = (config) =>
      new Promise((_resolve, rejectPromise) => {
        finish = () =>
          rejectPromise(
            Object.assign(new Error('HTTP error'), {
              config,
              response: {
                config,
                status: 401,
                data: { msg: '未登录：已过期' },
                headers: {},
              },
            }),
          );
      });
    const flight = requestClient.get('/workflow/test').catch(() => undefined);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    state.token = 'new';
    finish();
    await flight;
    expect(state.cleared).not.toHaveBeenCalled();
  });
  it('匿名登录入口的 401 不探测也不清理会话', async () => {
    const probe = vi.fn();
    baseRequestClient.instance.defaults.adapter = probe;
    await expect(requestClient.get('/rbac/login')).rejects.toBeTruthy();
    expect(probe).not.toHaveBeenCalled();
    expect(state.cleared).not.toHaveBeenCalled();
  });
  it('没有令牌的受保护请求只触发一次登录流程', async () => {
    state.token = null;
    await Promise.allSettled([
      requestClient.get('/workflow/a'),
      requestClient.get('/workflow/b'),
    ]);
    expect(state.logout).toHaveBeenCalledOnce();
  });
  it('本人信息的明确 401 不递归发起探测', async () => {
    const probe = vi.fn();
    baseRequestClient.instance.defaults.adapter = probe;
    requestClient.instance.defaults.adapter = (config) =>
      reject(config, 401, '未登录：令牌已过期');
    await expect(requestClient.get('/rbac/userInfo')).rejects.toBeTruthy();
    expect(probe).not.toHaveBeenCalled();
    expect(state.logout).toHaveBeenCalledOnce();
  });
  it('重试后再次401只复核不再次刷新业务请求', async () => {
    const probe = vi.fn(async (config: any) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { code: 0, data: { id: 'u' } },
    }));
    baseRequestClient.instance.defaults.adapter = probe;
    const adapter = vi.fn((config: any) => reject(config, 401, '业务异常'));
    requestClient.instance.defaults.adapter = adapter;
    await expect(
      requestClient.get('/workflow/test', { __isRetryRequest: true } as any),
    ).rejects.toBeTruthy();
    expect(probe).toHaveBeenCalledOnce();
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it('显式刷新成功重试前恢复签名加密明文及移除旧 nonce', async () => {
    state.refreshEnabled = true;
    state.refresh.mockResolvedValue('renewed');
    baseRequestClient.instance.defaults.adapter = (config) =>
      reject(config, 401, '未登录：已过期');
    const seen: any[] = [];
    requestClient.instance.defaults.adapter = async (config) => {
      seen.push(config);
      if (seen.length === 1) return reject(config, 401, '业务401');
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { code: 0, data: 'ok' },
      };
    };
    await requestClient.post('/workflow/test', { ciphertext: 'old' }, {
      __urlAclCrypto: true,
      __urlAclSignature: true,
      __urlAclPlainData: { title: 'original' },
      headers: {
        'X-UrlAcl-Nonce': 'old-nonce',
        'X-UrlAcl-Crypto-Nonce': 'old-crypto',
      },
    } as any);
    expect(state.refresh).toHaveBeenCalledOnce();
    expect(seen).toHaveLength(2);
    expect(seen[1].headers.get('Authorization')).toBe('renewed');
    expect(seen[1].headers.get('X-UrlAcl-Nonce')).toBeUndefined();
    expect(seen[1].headers.get('X-UrlAcl-Crypto-Nonce')).toBeUndefined();
    expect(JSON.parse(seen[1].data)).toEqual({ title: 'original' });
  });
  it('本人信息 401 响应签名不完整时保留会话', async () => {
    baseRequestClient.instance.defaults.adapter = (config) =>
      Promise.reject(
        Object.assign(new Error('HTTP error'), {
          config,
          response: {
            config,
            status: 401,
            data: { msg: '未登录：过期' },
            headers: { 'X-UrlAcl-Signature': 'tampered' },
          },
        }),
      );
    await expect(requestClient.get('/workflow/test')).rejects.toBeTruthy();
    expect(state.cleared).not.toHaveBeenCalled();
  });
});
