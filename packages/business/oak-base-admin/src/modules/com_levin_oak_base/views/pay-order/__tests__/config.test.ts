import { describe, expect, it, vi } from 'vitest';

const { payChannelCategoryOptionsLoader } = vi.hoisted(() => ({
  payChannelCategoryOptionsLoader: vi.fn(async () => []),
}));

vi.mock('../../../api/pay-order-service', () => ({
  payOrderService: {},
}));

vi.mock('../../api-module', () => ({
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  payChannelCategoryOptionsLoader,
  payChannelOptionsLoader: async () => [],
  tenantOptionsLoader: async () => [],
}));

import { payOrderPageCrudConfig } from '../config';

describe('pay order page config', () => {
  it('uses dedicated pay channel category fields and exposes provider code search/table fields', () => {
    const fields = payOrderPageCrudConfig.fields;
    const searchField = fields.find((field) => field.key === 'inPayChannelCategory');
    const tableField = fields.find((field) => field.key === 'payChannelCategory');
    const providerField = fields.find(
      (field) => field.key === 'payChannelProviderCode',
    );

    expect(searchField).toMatchObject({
      label: '支付通道类别',
      multiple: true,
      search: true,
      type: 'select',
    });
    expect(tableField).toMatchObject({
      label: '支付通道类别',
      table: true,
      type: 'select',
      width: 140,
    });
    expect(searchField?.loadOptions).toBe(payChannelCategoryOptionsLoader);
    expect(tableField?.loadOptions).toBe(payChannelCategoryOptionsLoader);
    expect(providerField).toMatchObject({
      label: '支付提供商编码',
      search: true,
      table: true,
      width: 180,
    });
    expect(fields.some((field) => field.key === 'inPayChannelType')).toBe(false);
    expect(fields.some((field) => field.key === 'payChannelType')).toBe(false);
  });
});
