import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('ant-design-vue', () => ({
  message: { error: mocks.error },
}));

import { showApiErrorMessage } from '../api-error-message';

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
});
