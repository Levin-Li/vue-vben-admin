import { describe, expect, it, vi } from 'vitest';

import { payChannelPageCrudConfig } from '../config';

vi.mock('../../../api/pay-channel-service', () => ({
  payChannelService: {},
}));

vi.mock('../../api-module', () => ({
  buildDictOptionsLoader: () => async () => [],
  buildEnumOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  payChannelAgentCodeOptionsLoader: async () => [],
  payChannelCategoryOptionsLoader: async () => [],
  tenantOptionsLoader: async () => [],
}));

describe('pay channel page config', () => {
  it('uses category instead of the legacy type field and exposes providerCode', () => {
    const fields = payChannelPageCrudConfig.fields;

    expect(fields.find((field) => field.key === 'inCategory')).toMatchObject({
      label: '类别',
      multiple: true,
      search: true,
      type: 'select',
    });
    expect(fields.find((field) => field.key === 'category')).toMatchObject({
      label: '类别',
      table: true,
      type: 'select',
    });
    expect(fields.find((field) => field.key === 'providerCode')).toMatchObject({
      label: '支付提供商',
      table: true,
      width: 180,
    });
    expect(fields.some((field) => field.key === 'type')).toBe(false);
    expect(fields.some((field) => field.key === 'inType')).toBe(false);
  });
});
