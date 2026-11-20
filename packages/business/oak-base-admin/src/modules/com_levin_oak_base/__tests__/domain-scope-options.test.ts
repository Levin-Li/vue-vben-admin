import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDomainScopeOptions } from '../domain-scope-options';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  authorizedList: vi.fn(),
}));

vi.mock('../api/_module', () => ({ oakBaseGet: mocks.get }));
vi.mock('../api/rbac-service', () => ({
  loadAuthorizedPlatformDomainList: mocks.authorizedList,
}));

describe('loadDomainScopeOptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('没有远程 type 配置时不查询也不显示候选', async () => {
    mocks.get.mockResolvedValue({ valueContent: {} });

    await expect(loadDomainScopeOptions()).resolves.toEqual([]);
    expect(mocks.authorizedList).not.toHaveBeenCalled();
  });

  it('远程配置不存在时降级为空候选', async () => {
    mocks.get.mockRejectedValue(new Error('setting not found'));

    await expect(loadDomainScopeOptions()).resolves.toEqual([]);
    expect(mocks.authorizedList).not.toHaveBeenCalled();
  });

  it('按配置前缀使用当前用户已授权领域接口', async () => {
    mocks.get.mockResolvedValue({ valueContent: { type: 'payment.' } });
    mocks.authorizedList.mockResolvedValue([
      { id: 'domain-1', name: '支付领域' },
    ]);

    await expect(loadDomainScopeOptions()).resolves.toEqual([
      { label: '支付领域', value: 'domain-1' },
    ]);
    expect(mocks.authorizedList).toHaveBeenCalledWith({
      typePrefix: 'payment.',
    });
  });

  it('输入名称时查询前五十条匹配领域', async () => {
    mocks.get.mockResolvedValue({ valueContent: { type: 'payment.' } });
    mocks.authorizedList.mockResolvedValue([]);

    await loadDomainScopeOptions('支付');

    expect(mocks.authorizedList).toHaveBeenCalledWith({
      keyword: '支付',
      typePrefix: 'payment.',
    });
  });
});
