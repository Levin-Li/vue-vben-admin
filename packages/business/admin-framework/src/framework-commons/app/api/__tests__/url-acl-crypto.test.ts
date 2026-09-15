import { describe, expect, it } from 'vitest';

import {
  hex,
  importCryptoKey,
  isClientCryptoPath,
  resolveMinuteByNonce,
  sha256,
} from '../url-acl-crypto';

describe('uRL ACL 前端加密协议', () => {
  const domain = 'api.example.test';
  const source = 'browser-user-agent';
  const minute = 2_982_350;
  const encoder = new TextEncoder();

  it('完整路径和 RequestService 短路径都进入强制加密分支', () => {
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
    expect(isClientCryptoPath('login')).toBe(true);
    expect(isClientCryptoPath('getVerifyCode')).toBe(true);
    expect(isClientCryptoPath('loginVerifyChallenge')).toBe(true);
    expect(isClientCryptoPath('loginVerifyChallenge/complete')).toBe(true);
    expect(isClientCryptoPath('/Rbac/getLoginOptions')).toBe(false);
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
    cipher[0] ^= 1;
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
