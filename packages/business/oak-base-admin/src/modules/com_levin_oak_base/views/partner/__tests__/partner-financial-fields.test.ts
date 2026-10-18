import { describe, expect, it } from 'vitest';

import { channelPartnerPageCrudConfig } from '../../channel-partner/config';
import { supplierPartnerPageCrudConfig } from '../../supplier-partner/config';
import { partnerCommonComplexGroups, partnerCommonFields } from '../config';

// 主档不预设收付款角色，结算单继续使用自己的快照契约。
describe('合作伙伴财务资料', () => {
  it('两类合作关系共享无角色前缀的嵌套资料分组', () => {
    expect(
      partnerCommonComplexGroups?.map(({ submitKey, title }) => ({
        submitKey,
        title,
      })),
    ).toEqual([
      { submitKey: 'bankAccount', title: '结算账户信息' },
      { submitKey: 'invoiceInfo', title: '开票信息' },
    ]);
    expect(supplierPartnerPageCrudConfig.complexGroups).toEqual(
      partnerCommonComplexGroups,
    );
    expect(channelPartnerPageCrudConfig.complexGroups).toEqual(
      partnerCommonComplexGroups,
    );
  });

  it('财务子字段不展示在列表和导出中', () => {
    const fields = partnerCommonFields.filter(
      ({ complexGroupKey }) => !!complexGroupKey,
    );

    expect(fields).toHaveLength(12);
    expect(
      fields.every(
        ({ table, export: exported }) => table === false && exported === false,
      ),
    ).toBe(true);
    expect(partnerCommonFields.map(({ key }) => key)).not.toEqual(
      expect.arrayContaining(['payeeBankAccount', 'payerInvoiceInfo']),
    );
  });
});
