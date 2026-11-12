import { describe, expect, it, vi } from 'vitest';

import { loadSettingListWithRetry } from '../load-setting-list';

describe('设置列表加载恢复', () => {
  it.each([
    { code: 'ERR_NETWORK', isAxiosError: true },
    { code: 'ECONNABORTED', isAxiosError: true },
    { response: { status: 503 } },
    { httpStatusCode: 502 },
  ])('暂时性失败后重试一次', async (error) => {
    const read = vi.fn().mockRejectedValueOnce(error).mockResolvedValue([]);

    await expect(loadSettingListWithRetry(read)).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([
    { response: { status: 403 } },
    { httpStatusCode: 400, msg: '无权访问' },
    { code: 'ERR_CANCELED', isAxiosError: true },
    { __CANCEL__: true },
    { msg: '业务校验失败' },
  ])('业务或取消错误不重试', async (error) => {
    const read = vi.fn().mockRejectedValue(error);

    await expect(loadSettingListWithRetry(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('重试失败时保留最后一次错误', async () => {
    const lastError = { code: 'ERR_NETWORK', isAxiosError: true };
    const read = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockRejectedValueOnce(lastError);

    await expect(loadSettingListWithRetry(read)).rejects.toBe(lastError);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
