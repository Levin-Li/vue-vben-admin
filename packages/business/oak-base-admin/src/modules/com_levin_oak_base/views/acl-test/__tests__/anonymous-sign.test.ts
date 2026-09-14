import { setAdminFrameworkRuntime } from '@levin/admin-framework';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { aclTestService } from '../../../api/acl-test-service';

const signatureHeaders = {
  'X-UrlAcl-App-Id': 'test-app',
  'X-UrlAcl-Timestamp': '1788912000000',
  'X-UrlAcl-Nonce': 'one-use-nonce',
  'X-UrlAcl-Body-Sha256': 'digest',
  'X-UrlAcl-Signature': 'signature',
};

afterEach(() => vi.unstubAllGlobals());

describe('签名测试独立匿名请求', () => {
  it('响应体为空时解码签名拒绝头并显示中文原因', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('', {
        status: 401,
        headers: { 'X-UrlAcl-Error': encodeURIComponent('签名验证失败') },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(aclTestService.sign('{}', signatureHeaders)).rejects.toThrow(
      '签名验证失败',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([200, 401])(
    'hTTP %s 只发送一次且不触发登录客户端',
    async (status) => {
      const authRequest = vi.fn();
      setAdminFrameworkRuntime({
        requestClient: {
          request: authRequest,
          get: authRequest,
          post: authRequest,
          put: authRequest,
          delete: authRequest,
        },
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          Response.json(
            status === 200 ? { message: '回显成功' } : { msg: '签名错误' },
            { status },
          ),
        );
      vi.stubGlobal('fetch', fetchMock);
      const body = '{"message":"签名测试"}';
      const result = aclTestService.sign(body, {
        ...signatureHeaders,
        Authorization: 'must-not-send',
        Cookie: 'must-not-send',
      });
      await (status === 200
        ? expect(result).resolves.toEqual({ message: '回显成功' })
        : expect(result).rejects.toThrow(
            '签名请求被拒绝（HTTP 401）：签名错误',
          ));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/com.levin.oak.base/V1/api/aclTest/sign',
        expect.objectContaining({
          body,
          method: 'POST',
          credentials: 'omit',
          redirect: 'error',
          headers: { ...signatureHeaders, 'Content-Type': 'application/json' },
        }),
      );
      expect(authRequest).not.toHaveBeenCalled();
    },
  );
});
