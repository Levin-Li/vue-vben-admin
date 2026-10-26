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

  it('requires buyer details and invoice lines', async () => {
    await expect(
      electronicInvoicePageCrudConfig.transformSubmit?.(
        { buyerInfo: { name: '购买方', taxNo: '9133' } },
        null,
      ),
    ).rejects.toThrow('请填写至少一项完整的票面明细');
  });

  it('calculates totals and omits user-entered request identity', async () => {
    const values = {
      buyerInfo: { name: '购买方', taxNo: '9133' },
      itemList: [
        {
          itemName: '服务',
          quantity: 1,
          unitPrice: 100,
          amountWithoutTax: 100,
          taxAmount: 6,
        },
      ],
      partnerId: 'partner-1',
      issuerChannelAuthorizationId: 'authorization-1',
    };

    await expect(
      electronicInvoicePageCrudConfig.transformSubmit?.(values, null),
    ).resolves.toMatchObject({
      ...values,
      amountWithoutTax: 100,
      taxAmount: 6,
      amountWithTax: 106,
    });
    expect(electronicInvoicePageCrudConfig.createSubmitKeys).toEqual([
      'amountWithoutTax',
      'taxAmount',
      'amountWithTax',
    ]);
  });

  it('uses structured buyer fields and requires an explicit authorization', () => {
    const fields = electronicInvoicePageCrudConfig.fields;
    expect(fields.find((field) => field.key === 'buyerInfo')).toMatchObject({
      type: 'json',
    });
    expect(
      fields.find((field) => field.key === 'buyerInfo')?.jsonSchemaEditor,
    ).toBeUndefined();
    expect(
      fields.find((field) => field.key === 'itemList')?.jsonSchemaEditor,
    ).toBeUndefined();
    expect(
      fields.find((field) => field.key === 'buyerInfo')?.jsonSchema,
    ).toBeUndefined();
    expect(
      fields.find((field) => field.key === 'itemList')?.jsonSchema,
    ).toBeUndefined();
    expect(
      fields.find((field) => field.key === 'issuerChannelAuthorizationId'),
    ).toMatchObject({
      required: true,
    });
    expect(fields.find((field) => field.key === 'partnerId')).toMatchObject({
      form: false,
    });
    expect(fields.find((field) => field.key === 'requestNo')).toMatchObject({
      form: false,
    });
  });

  it('uses the new invoice model instead of removed compatibility fields', () => {
    const keys = electronicInvoicePageCrudConfig.fields.map(
      (field) => field.key,
    );

    expect(keys).toEqual(
      expect.arrayContaining(['requestNo', 'buyerInfo', 'itemList']),
    );
    expect(keys).not.toEqual(
      expect.arrayContaining([
        'bizObjId',
        'bizOrderNo',
        'buyerEmail',
        'buyerMobile',
        'buyerName',
        'buyerTaxpayerId',
        'detailInfo',
        'invoiceCode',
      ]),
    );
  });

  it('defaults to core invoice columns while retaining technical fields in details', () => {
    const fields = electronicInvoicePageCrudConfig.fields;
    expect(
      fields.filter((field) => field.table).map((field) => field.key),
    ).toEqual([
      'id',
      'partnerId',
      'amountWithTax',
      'direction',
      'status',
      'invoiceNo',
      'createTime',
    ]);
    for (const key of [
      'originalInvoiceId',
      'redReason',
      'invoiceFileUrl',
      'lastStatusDesc',
      'errorMessage',
    ]) {
      expect(fields.find((field) => field.key === key)).toMatchObject({
        detail: true,
        form: false,
      });
    }
  });
});
