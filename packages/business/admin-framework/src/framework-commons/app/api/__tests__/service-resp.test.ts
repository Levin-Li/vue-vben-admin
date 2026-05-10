import { beforeAll, describe, expect, it } from 'vitest';

import { i18n } from '@vben/locales';

import {
  getServiceRespMessage,
  getServiceRespType,
  isServiceResp,
  unwrapServiceResp,
} from '../service-resp';

describe('service-resp', () => {
  beforeAll(() => {
    i18n.global.locale.value = 'zh-CN';
    i18n.global.setLocaleMessage('zh-CN', {
      ui: {
        serviceResp: {
          errorType: {
            authentication: '登录认证过期，请重新登录后继续。',
            authorization: '没有权限执行该操作。',
            bizError: '业务处理失败，请检查后重试。',
            bizWarning: '业务提醒，请检查后重试。',
            resource: '请求的资源不存在或不可用。',
            systemInner: '系统内部错误，请稍后再试。',
            unknown: '未知错误，请稍后再试。',
          },
        },
      },
    });
  });

  it('detects ServiceResp shape by code/status/successful fields', () => {
    expect(isServiceResp({ code: 0, data: {} })).toBe(true);
    expect(isServiceResp({ status: 0, data: {} })).toBe(true);
    expect(isServiceResp({ successful: true, data: {} })).toBe(true);
    expect(isServiceResp({ data: {} })).toBe(false);
  });

  it('unwraps successful ServiceResp data', () => {
    expect(unwrapServiceResp({ code: 0, data: { id: '1' } })).toEqual({
      id: '1',
    });
  });

  it('throws failed ServiceResp with backend message for non-business errors', () => {
    const serverErrorType = `server-dynamic-error-type-${Math.random()}`;

    expect(() =>
      unwrapServiceResp({
        code: 20_000,
        detailMsg: 'Not logged in',
        errorType: serverErrorType,
        msg: '认证异常',
      }),
    ).toThrow('认证异常');
  });

  it('prefers msg then detailMsg for display message', () => {
    expect(getServiceRespMessage({ detailMsg: '详情', msg: '摘要' })).toBe(
      '摘要',
    );
    expect(getServiceRespMessage({ detailMsg: '详情' })).toBe('详情');
  });

  it('shows backend message for business errors', () => {
    expect(
      getServiceRespMessage({
        bizError: true,
        code: 10_000,
        errorType: `server-dynamic-biz-error-${Math.random()}`,
        msg: '业务错误',
      }),
    ).toBe('业务错误');
  });

  it('prefers backend message for non-business errors', () => {
    const serverErrorType = `server-dynamic-error-type-${Math.random()}`;

    expect(
      getServiceRespMessage({
        code: 20_000,
        detailMsg: 'Not logged in',
        errorType: serverErrorType,
        msg: '认证异常',
      }),
    ).toBe('认证异常');
  });

  it('uses localized messages for fixed non-business error types', () => {
    expect(
      getServiceRespMessage({
        code: 20_000,
        detailMsg: 'Not logged in',
      }),
    ).toBe('登录认证过期，请重新登录后继续。');
    expect(getServiceRespMessage({ code: 25_000 })).toBe(
      '没有权限执行该操作。',
    );
    expect(getServiceRespMessage({ code: 30_000 })).toBe(
      '请求的资源不存在或不可用。',
    );
    expect(getServiceRespMessage({ code: 40_000 })).toBe(
      '系统内部错误，请稍后再试。',
    );
    expect(getServiceRespMessage({ code: 50_000 })).toBe(
      '未知错误，请稍后再试。',
    );
  });

  it('keeps backend messages for fixed business error types', () => {
    expect(
      getServiceRespMessage({
        code: 10_000,
        msg: '业务错误',
      }),
    ).toBe('业务错误');
  });

  it('derives error type from code when errorType is absent', () => {
    expect(getServiceRespType({ code: 25_000 })).toBe('AuthorizationError');
  });
});
