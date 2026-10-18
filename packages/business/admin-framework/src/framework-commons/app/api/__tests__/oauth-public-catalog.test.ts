import { beforeEach, describe, expect, it, vi } from 'vitest';

import { oauthService } from '../oauth-service';

const mocks = vi.hoisted(() => ({ get: vi.fn(), protectedRequest: vi.fn() }));
vi.mock('../request', () => ({ baseRequestClient: { get: mocks.get } }));
vi.mock('../../../runtime', () => ({
  requestClient: { request: mocks.protectedRequest },
}));

beforeEach(() => vi.clearAllMocks());

describe('第三方公开登录目录', () => {
  it('使用公开基础客户端与精确根路径', async () => {
    mocks.get.mockResolvedValue([{ code: 'qa-provider' }]);
    await expect(
      oauthService.getSupportedPlatforms({ tenantId: 'qa' }),
    ).resolves.toEqual([{ code: 'qa-provider' }]);
    expect(mocks.get).toHaveBeenCalledWith('/oauth/getSupportedPlatforms', {
      baseURL: '',
      params: { tenantId: 'qa' },
    });
    expect(mocks.protectedRequest).not.toHaveBeenCalled();
  });

  it('真实HTTP失败继续向登录页报错', async () => {
    const denied = new Error('目录读取失败');
    mocks.get.mockRejectedValue(denied);
    await expect(oauthService.getSupportedPlatforms()).rejects.toBe(denied);
  });
});
