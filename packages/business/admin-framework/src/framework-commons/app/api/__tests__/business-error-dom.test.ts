import { message } from 'ant-design-vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { notifyApiErrorOnce } from '../api-error-message';
import { requestClient } from '../request';

vi.mock('@vben/runtime/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/api' }),
}));
vi.mock('@vben-core/foundation/preferences', () => ({
  preferences: { app: { locale: 'zh-CN', enableRefreshToken: false } },
}));
vi.mock('@vben/runtime/stores', () => ({
  useAccessStore: () => ({ accessToken: 'test' }),
  useUserStore: () => ({ userInfo: {} }),
}));
vi.mock('@levin/admin-framework/framework-commons/app/store', () => ({
  useAuthStore: vi.fn(),
}));
vi.mock('../../../data-attr-policy', () => ({
  assertDataAttrSessionReady: vi.fn(),
  dataAttrRequestPath: (path: string) => path,
  isDataAttrPolicyReady: () => true,
}));
vi.mock('../dynamic-verify-code', () => ({
  createDynamicVerifyCodeInterceptor: () => ({
    fulfilled: (response: unknown) => response,
  }),
}));
vi.mock('../url-acl-crypto', () => ({
  importCryptoKey: vi.fn(),
  isAnonymousRbacCryptoPath: () => false,
  rememberNegotiatedCryptoPath: vi.fn(),
  rememberNegotiatedSignaturePath: vi.fn(),
  resolveMinuteByNonce: vi.fn(),
  shouldEncryptClientRequest: () => false,
  shouldRetryCryptoNegotiation: () => false,
  shouldRetrySignatureNegotiation: () => false,
  shouldSignClientRequest: () => false,
}));

describe('真实通知组件的业务错误提示', () => {
  afterEach(() => message.destroy());
  it('hTTP 200 业务失败在表单 catch 后仍只提示一次', async () => {
    const notification = vi.spyOn(message, 'error');
    requestClient.instance.defaults.adapter = async (config) => ({
      config,
      data: { code: 10_000, msg: '目标通配权限不被签发人单个角色覆盖' },
      headers: {},
      status: 200,
      statusText: 'OK',
    });
    let caught: unknown;
    try {
      await requestClient.post(
        '/InvitationLink/createSupplierPartner',
        {},
        { responseReturn: 'data' },
      );
    } catch (error) {
      caught = error;
      notifyApiErrorOnce(error);
    }
    expect(caught).toBeTruthy();
    expect(notification).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        '目标通配权限不被签发人单个角色覆盖',
      ),
    );
    notification.mockRestore();
  });

  it('错误响应为 JSON 文本时，页面能看到公开业务原因', async () => {
    requestClient.instance.defaults.adapter = async (config) => {
      throw Object.assign(new Error('HTTP failure'), {
        config,
        response: {
          config,
          data: JSON.stringify({
            code: 10_000,
            msg: '目标通配权限不被签发人单个角色覆盖',
          }),
          status: 400,
        },
      });
    };
    try {
      await requestClient.post(
        '/InvitationLink/createSupplierPartner',
        {},
        {
          responseReturn: 'data',
          responseType: 'text',
        },
      );
    } catch (error) {
      notifyApiErrorOnce(error);
    }
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        '目标通配权限不被签发人单个角色覆盖',
      ),
    );
  });
});
