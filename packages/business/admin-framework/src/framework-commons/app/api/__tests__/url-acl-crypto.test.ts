import { describe, expect, it } from 'vitest';

import {
  hasNegotiatedCryptoPath,
  hasNegotiatedSignaturePath,
  hex,
  importCryptoKey,
  isAnonymousRbacCryptoPath,
  isClientCryptoPath,
  rememberNegotiatedCryptoPath,
  rememberNegotiatedSignaturePath,
  resolveMinuteByNonce,
  sha256,
  shouldEncryptClientRequest,
  shouldRetryCryptoNegotiation,
  shouldRetrySignatureNegotiation,
  shouldSignClientRequest,
} from '../url-acl-crypto';

describe('uRL ACL 前端加密协议', () => {
  const domain = 'api.example.test';
  const source = 'browser-user-agent';
  const minute = 2_982_350;
  const encoder = new TextEncoder();

  it('rbac JSON API 都进入主动加密分支，非 RBAC API 不受影响', () => {
    expect(isClientCryptoPath('/com.levin.oak.base/V1/api/Rbac/login')).toBe(
      true,
    );
    expect(
      isClientCryptoPath('/com.levin.oak.base/V1/api/Rbac/getVerifyCode'),
    ).toBe(true);
    expect(
      isClientCryptoPath(
        '/com.levin.oak.base/V1/api/Rbac/loginVerifyChallenge',
      ),
    ).toBe(true);
    expect(
      isClientCryptoPath(
        '/com.levin.oak.base/V1/api/Rbac/loginVerifyChallenge/complete',
      ),
    ).toBe(true);
    expect(isClientCryptoPath('/Rbac/tenantInfo')).toBe(true);
    expect(isClientCryptoPath('/Rbac/tenantSiteInfo?refresh=true')).toBe(true);
    expect(isClientCryptoPath('/Rbac/userInfo#current')).toBe(true);
    expect(isClientCryptoPath('/Rbac/authorizedMenuList')).toBe(true);
    expect(isClientCryptoPath('/enums/UserCategory')).toBe(true);
    expect(isClientCryptoPath('/Rbac/captcha')).toBe(false);
    expect(isClientCryptoPath('/Tenant/list')).toBe(false);
  });

  it('匿名登录和租户上下文 API 不依赖当前页面路由判断', () => {
    expect(isAnonymousRbacCryptoPath('/Rbac/login')).toBe(true);
    expect(isAnonymousRbacCryptoPath('/Rbac/loginVerifyChallenge')).toBe(true);
    expect(
      isAnonymousRbacCryptoPath('/Rbac/loginVerifyChallenge/complete'),
    ).toBe(true);
    expect(isAnonymousRbacCryptoPath('/Rbac/tenantSiteInfo')).toBe(true);
    expect(isAnonymousRbacCryptoPath('/Rbac/userInfo')).toBe(false);
  });

  it('协商加密仅按当前域名与路径记忆，query 和 hash 不参与匹配', () => {
    const domain = 'negotiated.example.test';
    rememberNegotiatedCryptoPath('/Order/list?first=true', domain);

    expect(hasNegotiatedCryptoPath('/Order/list#second', domain)).toBe(true);
    expect(hasNegotiatedCryptoPath('/Order/list', 'other.example.test')).toBe(
      false,
    );
    expect(hasNegotiatedCryptoPath('/Order/detail', domain)).toBe(false);
  });

  it('协商仅对 AES_GCM 且尚未重试的有效请求重发一次', () => {
    expect(shouldRetryCryptoNegotiation('AES_GCM', '/Order/list', false)).toBe(
      true,
    );
    expect(shouldRetryCryptoNegotiation('AES_GCM', '/Order/list', true)).toBe(
      false,
    );
    expect(shouldRetryCryptoNegotiation('OTHER', '/Order/list', false)).toBe(
      false,
    );
    expect(shouldRetryCryptoNegotiation('AES_GCM', '', false)).toBe(false);
  });

  it('签名协商只按当前域名与路径记忆，并且只重发一次', () => {
    const domain = 'signed.example.test';
    rememberNegotiatedSignaturePath('/Order/list?first=true', domain);

    expect(hasNegotiatedSignaturePath('/Order/list#second', domain)).toBe(true);
    expect(
      hasNegotiatedSignaturePath('/Order/list', 'other.example.test'),
    ).toBe(false);
    expect(shouldSignClientRequest('/Order/list', domain)).toBe(true);
    expect(shouldSignClientRequest('/Order/detail', domain)).toBe(false);
    expect(
      shouldRetrySignatureNegotiation('HMAC_SHA256', '/Order/list', false),
    ).toBe(true);
    expect(
      shouldRetrySignatureNegotiation('HMAC_SHA256', '/Order/list', true),
    ).toBe(false);
  });

  it('主动路径和协商记忆经同一加密启用判定汇合', () => {
    const domain = 'unified.example.test';
    const negotiatedPath = '/Order/list';

    expect(shouldEncryptClientRequest('/Rbac/userInfo', domain)).toBe(true);
    expect(shouldEncryptClientRequest(negotiatedPath, domain)).toBe(false);

    rememberNegotiatedCryptoPath(negotiatedPath, domain);

    expect(shouldEncryptClientRequest(negotiatedPath, domain)).toBe(true);
    expect(
      shouldEncryptClientRequest('/Order/list', 'other.example.test'),
    ).toBe(false);
  });

  it('使用域名、来源和分钟派生相同 AES 密钥并可往返加解密', async () => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = encoder.encode('{"account":"demo","password":"secret"}');
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await importCryptoKey(domain, source, minute),
      plain,
    );
    const result = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      await importCryptoKey(domain, source, minute),
      cipher,
    );
    expect(new TextDecoder().decode(result)).toBe(
      '{"account":"demo","password":"secret"}',
    );
  });

  it('接受上一、当前和下一分钟的 Nonce，拒绝超时 Nonce', async () => {
    const nonce = async (value: number) =>
      hex(await sha256(encoder.encode(`${value}\n${domain}`)));
    const now = minute * 60_000;
    await expect(
      resolveMinuteByNonce(await nonce(minute - 1), domain, now),
    ).resolves.toBe(minute - 1);
    await expect(
      resolveMinuteByNonce(await nonce(minute), domain, now),
    ).resolves.toBe(minute);
    await expect(
      resolveMinuteByNonce(await nonce(minute + 1), domain, now),
    ).resolves.toBe(minute + 1);
    await expect(
      resolveMinuteByNonce(await nonce(minute - 2), domain, now),
    ).rejects.toThrow('已过期');
  });

  it('篡改密文或使用错误来源时不能解密', async () => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = encoder.encode('{"verifyCode":"1234"}');
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        await importCryptoKey(domain, source, minute),
        plain,
      ),
    );
    expect(cipher).not.toHaveLength(0);
    cipher[0] = (cipher[0] ?? 0) ^ 1;
    await expect(
      crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        await importCryptoKey(domain, source, minute),
        cipher,
      ),
    ).rejects.toThrow();
    await expect(
      crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        await importCryptoKey(domain, 'other-user-agent', minute),
        plain,
      ),
    ).rejects.toThrow();
  });
});
