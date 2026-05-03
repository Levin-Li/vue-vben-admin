import { describe, expect, it } from 'vitest';

import {
  getServiceRespMessage,
  getServiceRespType,
  isServiceResp,
  unwrapServiceResp,
} from '../service-resp';

describe('service-resp', () => {
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

  it('derives error type from code when errorType is absent', () => {
    expect(getServiceRespType({ code: 25_000 })).toBe('AuthorizationError');
  });
});
