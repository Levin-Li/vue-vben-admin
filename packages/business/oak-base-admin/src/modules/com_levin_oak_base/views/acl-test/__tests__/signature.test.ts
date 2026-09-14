import { createHash, createHmac, webcrypto } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAclSignatureHeaders } from '../signature';

afterEach(() => vi.unstubAllGlobals());

describe('访问控制测试签名', () => {
  it('按应用标识和 UTF-8 正文的四行规范生成签名', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const body = JSON.stringify({ message: '中文测试', amount: 10 });
    const timestamp = '1788912000000';
    const nonce = 'test-nonce';
    const headers = await createAclSignatureHeaders({
      appId: 'test-app',
      secret: 'test-only-secret',
      body,
      timestamp,
      nonce,
    });
    const digest = createHash('sha256').update(body, 'utf8').digest('hex');
    const expected = createHmac('sha256', 'test-only-secret')
      .update(`test-app\n${timestamp}\n${nonce}\n${digest}`, 'utf8')
      .digest('hex');
    expect(headers).toEqual({
      'X-UrlAcl-App-Id': 'test-app',
      'X-UrlAcl-Timestamp': timestamp,
      'X-UrlAcl-Nonce': nonce,
      'X-UrlAcl-Body-Sha256': digest,
      'X-UrlAcl-Signature': expected,
    });
    const changed = await createAclSignatureHeaders({
      appId: 'test-app',
      secret: 'test-only-secret',
      body: `${body} `,
      timestamp,
      nonce,
    });
    expect(changed['X-UrlAcl-Signature']).not.toBe(expected);
  });

  it('安全加密能力不可用时明确拒绝签名', async () => {
    vi.stubGlobal('crypto', undefined);
    await expect(
      createAclSignatureHeaders({
        appId: 'test',
        secret: 'secret',
        body: '{}',
      }),
    ).rejects.toThrow('HTTPS');
  });
});
