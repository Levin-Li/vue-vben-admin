import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isApiErrorNotified, showApiErrorMessage } from '../api-error-message';

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
});
