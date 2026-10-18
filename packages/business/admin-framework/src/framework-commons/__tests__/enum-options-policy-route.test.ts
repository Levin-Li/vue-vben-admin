import { describe, expect, it, vi } from 'vitest';

import { fetchEnumOptions } from '../api';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../runtime', () => ({ requestClient: { get } }));

describe('枚举选项字段策略路由', () => {
  it('读取唯一的枚举详情路径并缓存候选', async () => {
    const enumName = 'com.levin.oak.base.entities.SupplierPartner$SupplierType';
    get.mockResolvedValueOnce({
      fullName: enumName,
      options: [{ label: '商品供应商', value: 'Goods' }],
    });

    const first = await fetchEnumOptions(
      enumName,
      '/com.levin.oak.base/V1/api',
    );
    const second = await fetchEnumOptions(
      enumName,
      '/com.levin.oak.base/V1/api',
    );

    expect(first).toEqual([{ label: '商品供应商', value: 'Goods' }]);
    expect(second).toEqual(first);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/com.levin.oak.base/V1/api/enums/com.levin.oak.base.entities.SupplierPartner%24SupplierType',
      { baseURL: '' },
    );
  });
});
