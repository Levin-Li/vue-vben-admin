import { describe, expect, it } from 'vitest';

import { electronicInvoicePageCrudConfig } from '../config';

describe('electronicInvoicePageCrudConfig', () => {
  it('lets platform users select the tenant that owns the issuer connection', () => {
    expect(electronicInvoicePageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'tenantId',
          type: 'select',
          visibleForPlatformUser: true,
        }),
      ]),
    );
  });

  it('rejects invoice amounts that cannot form a tax-inclusive total', async () => {
    await expect(
      electronicInvoicePageCrudConfig.transformSubmit?.({
        amountWithoutTax: 100,
        amountWithTax: 107,
        taxAmount: 6,
      }),
    ).rejects.toThrow('不含税金额与税额之和必须等于价税合计');
  });

  it('keeps a valid invoice request unchanged', async () => {
    const values = {
      amountWithoutTax: 100,
      amountWithTax: 106,
      partnerId: 'partner-1',
      taxAmount: 6,
    };

    await expect(
      electronicInvoicePageCrudConfig.transformSubmit?.(values),
    ).resolves.toEqual(values);
  });
});
