import { createHash, createHmac, webcrypto } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configureDataAttrPolicyLoader,
  suspendDataAttrPolicies,
} from '../../../data-attr-policy';
import { setAdminFrameworkRuntime } from '../../../runtime';
import { oauthService } from '../oauth-service';
import { baseRequestClient, requestClient } from '../request';
import { rememberNegotiatedSignaturePath } from '../url-acl-crypto';

vi.mock('@vben/runtime/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/com.levin.oak.base/V1/api' }),
}));
vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: { app: { locale: 'zh-CN', enableRefreshToken: false } },
}));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({ accessToken: 'stale-token' }),
  useUserStore: () => ({ userInfo: {} }),
}));
vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: vi.fn(),
}));
vi.mock('ant-design-vue', () => ({ message: { error: vi.fn() } }));
vi.mock('../dynamic-verify-code', () => ({
  createDynamicVerifyCodeInterceptor: () => ({
    fulfilled: (response: unknown) => response,
  }),
}));

describe('邀请匿名请求的真实客户端边界', () => {
  beforeEach(() => {
    setAdminFrameworkRuntime({ requestClient });
    configureDataAttrPolicyLoader(vi.fn());
    suspendDataAttrPolicies();
  });
  afterEach(() => vi.unstubAllGlobals());
  it('仅公开 POST 预览和兑换可在未就绪会话中访问，不传历史令牌', async () => {
    const seen: any[] = [];
    const adapter = async (config: any) => {
      seen.push(config);
      return {
        config,
        data: { code: 0, data: { ok: true } },
        headers: {},
        status: 200,
        statusText: 'OK',
      };
    };
    baseRequestClient.instance.defaults.adapter = adapter;
    requestClient.instance.defaults.adapter = adapter;
    await baseRequestClient.post('/InvitationRegister/preview', {
      token: 'test',
    });
    await requestClient.post('/InvitationRegister/redeem', { token: 'test' });
    expect(seen).toHaveLength(2);
    expect(seen.every((config) => !config.headers?.Authorization)).toBe(true);
    for (const [method, url] of [
      ['GET', '/InvitationRegister/preview'],
      ['POST', '/InvitationRegister/preview/other'],
      ['POST', '/InvitationRegister/other'],
      ['POST', '/InvitationLink/list'],
      ['POST', '/other?next=/InvitationRegister/preview'],
    ]) {
      await expect(
        requestClient.request(url, { method, data: {} }),
      ).rejects.toThrow('登录会话尚未就绪');
    }
    await expect(
      requestClient.post(
        '/InvitationRegister/preview',
        {},
        {
          baseURL: 'https://evil.example/com.levin.oak.base/V1/api',
        },
      ),
    ).rejects.toThrow('登录会话尚未就绪');
    expect(seen).toHaveLength(2);
  });

  it('仅邀请用途 OAuth 创建与邀请兑换可匿名，绑定和其他用途仍被门禁拒绝', async () => {
    const seen: any[] = [];
    requestClient.instance.defaults.adapter = async (config: any) => {
      seen.push(config);
      return {
        config,
        data: { code: 0, data: { ok: true } },
        headers: {},
        status: 200,
        statusText: 'OK',
      };
    };
    await oauthService.createTransaction({
      purpose: 'INVITE',
      invitationToken: 'test',
      platform: 'test',
    });
    await oauthService.redeemInvitation({ token: 'test', transactionId: 'tx' });
    expect(seen).toHaveLength(2);
    expect(seen.every((config) => !config.headers?.Authorization)).toBe(true);
    for (const data of [
      { purpose: 'BIND', invitationToken: 'test' },
      { purpose: 'LOGIN' },
      { purpose: 'INVITE' },
    ]) {
      await expect(
        requestClient.post('/oauth/transactions', data, { baseURL: '' }),
      ).rejects.toThrow('登录会话尚未就绪');
    }
    await expect(
      requestClient.post(
        '/oauth/invitationRedeemOAuth',
        { token: 'test' },
        { baseURL: '' },
      ),
    ).rejects.toThrow('登录会话尚未就绪');
    expect(seen).toHaveLength(2);
  });

  it.each([
    ['X-UrlAcl-Crypto-Required', 'AES_GCM', '__urlAclCryptoSource'],
    ['X-UrlAcl-Signature-Required', 'HMAC_SHA256', '__urlAclSignatureSource'],
  ])(
    'oAuth 邀请协商重试保留原始用途并使用匿名材料 %s',
    async (header, algorithm, sourceKey) => {
      vi.stubGlobal('crypto', webcrypto);
      let count = 0;
      requestClient.instance.defaults.adapter = async (config: any) => {
        count++;
        if (count === 1) {
          throw Object.assign(new Error('negotiate'), {
            config,
            response: { config, status: 428, headers: { [header]: algorithm } },
          });
        }
        expect(config[sourceKey]).toBe(navigator.userAgent);
        expect(config.headers?.Authorization).toBeUndefined();
        return {
          config,
          data: { code: 0, data: { ok: true } },
          headers: {},
          status: 200,
          statusText: 'OK',
        };
      };
      await expect(
        requestClient.post(
          '/oauth/transactions',
          { purpose: 'INVITE', invitationToken: 'test' },
          { baseURL: '' },
        ),
      ).resolves.toEqual({ ok: true });
      expect(count).toBe(2);
    },
  );

  it('已登录 BIND 仍保留身份而不走匿名路径', async () => {
    configureDataAttrPolicyLoader(vi.fn());
    let observed: any;
    requestClient.instance.defaults.adapter = async (config: any) => {
      observed = config;
      return {
        config,
        data: { code: 0, data: { ok: true } },
        headers: {},
        status: 200,
        statusText: 'OK',
      };
    };
    await requestClient.post(
      '/oauth/transactions',
      { purpose: 'BIND' },
      { baseURL: '' },
    );
    expect(observed.headers.Authorization).toBe('stale-token');
  });

  it('匿名签名请求和响应使用同一 User-Agent，不能回退到旧令牌', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const path = '/InvitationRegister/preview';
    rememberNegotiatedSignaturePath(path, window.location.hostname);
    baseRequestClient.instance.defaults.adapter = async (config: any) => {
      expect(config.__urlAclSignatureSource).toBe(navigator.userAgent);
      const data = { code: 0, data: { ok: true } };
      const body = JSON.stringify(data);
      const timestamp = String(Date.now());
      const nonce = 'test-response-nonce';
      const hash = createHash('sha256').update(body).digest('hex');
      const key = createHash('sha256')
        .update(
          `${window.location.hostname.toLowerCase()}\n${navigator.userAgent}\n${Math.floor(Number(timestamp) / 60_000)}`,
        )
        .digest();
      const signature = createHmac('sha256', key)
        .update(`${timestamp}\n${nonce}\n${hash}`)
        .digest('hex');
      return {
        config,
        data,
        status: 200,
        statusText: 'OK',
        headers: {
          'X-UrlAcl-Timestamp': timestamp,
          'X-UrlAcl-Nonce': nonce,
          'X-UrlAcl-Body-Sha256': hash,
          'X-UrlAcl-Signature': signature,
        },
      };
    };
    await expect(
      baseRequestClient.post(path, { token: 'test' }),
    ).resolves.toEqual({ ok: true });
  });
});
