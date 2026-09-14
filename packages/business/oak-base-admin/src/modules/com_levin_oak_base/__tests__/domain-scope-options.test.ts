import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDomainScopeOptions } from '../domain-scope-options';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
}));

vi.mock('../api/_module', () => ({ oakBaseGet: mocks.get }));
vi.mock('../api/platform-domain-service', () => ({
  platformDomainService: { list: mocks.list },
}));

describe('loadDomainScopeOptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('没有远程 type 配置时不查询也不显示候选', async () => {
    mocks.get.mockResolvedValue({ valueContent: {} });

    await expect(loadDomainScopeOptions()).resolves.toEqual([]);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('远程配置不存在时降级为空候选', async () => {
    mocks.get.mockRejectedValue(new Error('setting not found'));

    await expect(loadDomainScopeOptions()).resolves.toEqual([]);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('按配置前缀和已发布状态使用原列表接口', async () => {
    mocks.get.mockResolvedValue({ valueContent: { type: 'payment.' } });
    mocks.list.mockResolvedValue({
      items: [{ id: 'domain-1', name: '支付领域' }],
    });

    await expect(loadDomainScopeOptions()).resolves.toEqual([
      { label: '支付领域', value: 'domain-1' },
    ]);
    expect(mocks.list).toHaveBeenCalledWith({
      pageIndex: 1,
      pageSize: 10,
      startsWithType: 'payment.',
      state: 'Published',
    });
  });

  it('输入名称时查询前五十条匹配领域', async () => {
    mocks.get.mockResolvedValue({ valueContent: { type: 'payment.' } });
    mocks.list.mockResolvedValue({ items: [] });

    await loadDomainScopeOptions('支付');

    expect(mocks.list).toHaveBeenCalledWith({
      containsName: '支付',
      pageIndex: 1,
      pageSize: 50,
      startsWithType: 'payment.',
      state: 'Published',
    });
  });
});
