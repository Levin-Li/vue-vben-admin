import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getApiErrorMessage,
  isApiErrorNotified,
  notifyApiErrorOnce,
  showApiErrorMessage,
} from '../api-error-message';

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('ant-design-vue', () => ({
  message: { error: mocks.error },
}));

describe('统一请求错误提示', () => {
  beforeEach(() => mocks.error.mockClear());

  it('为相同消息使用稳定键并沿用应用默认展示时长', () => {
    showApiErrorMessage('租户ID不能为空');
    showApiErrorMessage('租户ID不能为空');

    expect(mocks.error).toHaveBeenCalledTimes(2);
    expect(mocks.error).toHaveBeenLastCalledWith({
      content: '租户ID不能为空',
      key: 'api-error:租户ID不能为空',
    });
  });

  it('标记已提示的原始失败，公共表单不再追加泛化错误', () => {
    const failure = new Error('当前账号未归属租户组织');
    expect(isApiErrorNotified(failure)).toBe(false);
    showApiErrorMessage(failure.message, failure);
    expect(isApiErrorNotified(failure)).toBe(true);
    expect(isApiErrorNotified(new Error(failure.message))).toBe(false);
    expect(isApiErrorNotified(null)).toBe(false);
  });

  it('请求客户端改抛响应数据时仍识别为已提示', () => {
    const responseData = { msg: '推荐人必须属于租户组织' };
    const failure = { response: { data: responseData } };
    showApiErrorMessage(responseData.msg, failure);
    expect(isApiErrorNotified(responseData)).toBe(true);
    expect(isApiErrorNotified({ msg: responseData.msg })).toBe(false);
  });

  it('登录失败只展示一次后端提示，即使调用方捕获响应数据', () => {
    const responseData = { msg: '用户名或密码错误' };
    const failure = { response: { data: responseData, status: 400 } };
    showApiErrorMessage(getApiErrorMessage(failure), failure);
    notifyApiErrorOnce(responseData);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith({
      content: '用户名或密码错误',
      key: expect.stringMatching(/^api-error:\d+$/),
    });
  });

  it('服务端没有可展示提示时使用统一兜底，不暴露本地异常或堆栈', () => {
    for (const failure of [
      new Error('Network Error'),
      Object.assign(new Error('Request failed with status code 500'), {
        response: { data: undefined, status: 500 },
      }),
      {
        response: {
          data: { detailMsg: 'SQL stack trace', errorType: 'SystemInnerError' },
        },
      },
      { response: { data: { msg: '  ' } } },
    ]) {
      expect(getApiErrorMessage(failure)).toBe('发生服务器异常');
    }
    notifyApiErrorOnce(new Error('timeout'));
    expect(mocks.error).toHaveBeenCalledWith({
      content: '发生服务器异常',
      key: expect.stringMatching(/^api-error:\d+$/),
    });
  });

  it('优先使用服务端 msg，兼容 message 与 error', () => {
    expect(
      getApiErrorMessage({
        response: { data: { msg: ' 后端提示 ', message: '其他' } },
      }),
    ).toBe('后端提示');
    expect(getApiErrorMessage({ message: '后端消息' })).toBe('后端消息');
    expect(
      getApiErrorMessage({ response: { data: { error: '后端错误' } } }),
    ).toBe('后端错误');
  });

  it('json 文本响应只提取公开提示，非法文本和内部堆栈使用安全兜底', () => {
    const failure = new Error('HTTP error');
    Object.assign(failure, {
      response: {
        data: JSON.stringify({
          code: 10_000,
          msg: '目标通配权限不被签发人单个角色覆盖',
        }),
      },
    });
    expect(getApiErrorMessage(failure)).toBe(
      '目标通配权限不被签发人单个角色覆盖',
    );
    expect(getApiErrorMessage({ response: { data: '{invalid' } })).toBe(
      '发生服务器异常',
    );
    expect(
      getApiErrorMessage({
        response: { data: JSON.stringify({ detailMsg: 'SQL stack' }) },
      }),
    ).toBe('发生服务器异常');
    expect(getApiErrorMessage({ response: { data: '"stack trace"' } })).toBe(
      '发生服务器异常',
    );
  });

  it('主动取消请求时不显示错误', () => {
    notifyApiErrorOnce({ __CANCEL__: true });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('仅在请求明确声明非空覆盖文案时替换后端提示', () => {
    const data = { msg: '后端提示' };
    expect(
      getApiErrorMessage({
        config: { errorMessageOverride: ' 请联系管理员 ' },
        response: { data },
      }),
    ).toBe('请联系管理员');
    expect(
      getApiErrorMessage({
        config: { errorMessageOverride: '  ' },
        response: { data },
      }),
    ).toBe('后端提示');
    expect(getApiErrorMessage({ response: { data } })).toBe('后端提示');
    expect(
      getApiErrorMessage({
        response: { data: {}, config: { errorMessageOverride: '自定义提示' } },
      }),
    ).toBe('自定义提示');
  });

  it('同一异常在多层拦截中只提示一次，不同异常即使文案相同也独立提示', () => {
    const first = { response: { data: { msg: '失败' } } };
    const second = { response: { data: { msg: '失败' } } };
    showApiErrorMessage(getApiErrorMessage(first), first);
    showApiErrorMessage(getApiErrorMessage(first), first);
    showApiErrorMessage(getApiErrorMessage(first), {
      response: first.response,
    });
    showApiErrorMessage(getApiErrorMessage(second), second);
    expect(mocks.error).toHaveBeenCalledTimes(2);
    expect(mocks.error.mock.calls[0]?.[0].key).not.toBe(
      mocks.error.mock.calls[1]?.[0].key,
    );
  });
});
