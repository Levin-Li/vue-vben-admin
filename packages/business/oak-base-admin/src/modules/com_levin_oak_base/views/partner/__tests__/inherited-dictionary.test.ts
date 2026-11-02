import { describe, expect, it, vi } from 'vitest';

import { channelPartnerPageCrudConfig } from '../../channel-partner/config';
import { supplierPartnerPageCrudConfig } from '../../supplier-partner/config';
import { partnerCommonFields } from '../config';

const mocks = vi.hoisted(() => ({
  fetchDictOptions: vi.fn(async (_code: string, _base?: string) => [
    { label: '零售', value: 'retail' },
  ]),
}));

vi.mock('@levin/admin-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@levin/admin-framework')>()),
  fetchDictOptions: mocks.fetchDictOptions,
}));

describe('合作伙伴继承字典字段', () => {
  it('父配置和两个子页面均用 Partner 声明的字典加载多选行业', async () => {
    // 三个页面各自的最终字段配置均应调用父类字段的真实编码。
    for (const fields of [
      partnerCommonFields,
      supplierPartnerPageCrudConfig.fields,
      channelPartnerPageCrudConfig.fields,
    ]) {
      const field = fields.find((item) => item.key === 'industries');
      expect(field).toMatchObject({
        type: 'select',
        multiple: true,
        search: true,
        table: true,
      });
      expect(await field?.loadOptions?.('')).toEqual([
        { label: '零售', value: 'retail' },
      ]);
    }
    expect(mocks.fetchDictOptions).toHaveBeenCalledTimes(3);
    expect(mocks.fetchDictOptions).toHaveBeenNthCalledWith(
      1,
      'com.levin.oak.base.entities.Partner.industries',
      '/com.levin.oak.base/V1/api',
    );
    for (const call of mocks.fetchDictOptions.mock.calls) {
      expect(call[0]).toBe('com.levin.oak.base.entities.Partner.industries');
    }
  });
});
