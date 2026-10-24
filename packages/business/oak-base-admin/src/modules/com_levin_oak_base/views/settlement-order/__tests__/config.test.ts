import { getResAuthorizeMeta } from '@levin/admin-framework';
import { buildCrudQueryItems } from '@levin/admin-framework/framework-commons/shared/crud-query-items';
import { describe, expect, it } from 'vitest';

import { settlementOrderService } from '../../../api/settlement-order-service';
import {
  buildSettlementFinancialEntries,
  settlementFinancialPermission,
  settlementOrderPageCrudConfig,
  validateSettlementSave,
} from '../config';

describe('结算单标准 CRUD', () => {
  it('按实体未指定 Schema 的注解使用通用 JSON 编辑，不预设业务属性', () => {
    expect(
      settlementOrderPageCrudConfig.fields.find(
        (field) => field.key === 'settlementContent',
      ),
    ).toMatchObject({ jsonSchemaEditor: true });
    expect(
      settlementOrderPageCrudConfig.fields.find(
        (field) => field.key === 'settlementContent',
      ),
    ).not.toHaveProperty('jsonSchema');
  });

  it('财务详情只向公共查看器交付专用接口实际返回的字段组', () => {
    const entries = buildSettlementFinancialEntries({
      id: 's1',
      optimisticLock: 1,
      payeeBankAccount: { bankName: '测试银行' },
      settlementContent: { custom: { amount: 1 } },
      actionLog: [{ action: '确认' }],
    });
    expect(entries.map((entry) => entry.key)).toEqual([
      'payeeBankAccount',
      'settlementContent',
    ]);
    expect(entries.every((entry) => entry.kind === 'json')).toBe(true);
    expect(entries[1]?.value).toEqual({ custom: { amount: 1 } });
  });

  it('按查询 DTO 将两段结算时间配置为范围控件', () => {
    const items = buildCrudQueryItems(
      settlementOrderPageCrudConfig.fields.filter((field) => field.search),
    );
    expect(
      items
        .filter((item) => item.kind === 'range')
        .map((item) => [item.startKey, item.endKey]),
    ).toEqual([
      ['gteStartTime', 'lteStartTime'],
      ['gteEndTime', 'lteEndTime'],
    ]);
    expect(
      settlementOrderPageCrudConfig.fields.some((field) =>
        ['betweenEndTime', 'betweenStartTime'].includes(field.key),
      ),
    ).toBe(false);
  });
  it('按当前实体仅展示合作关系，不重加已删除的主体身份字段', () => {
    const fields = settlementOrderPageCrudConfig.fields;
    expect(fields.find((field) => field.key === 'partnerId')).toMatchObject({
      required: true,
      disabledOnEdit: true,
      omitOnEdit: true,
    });
    for (const key of [
      'ownerId',
      'ownLegalSubjectId',
      'counterpartyLegalSubjectId',
      'payerLegalSubjectId',
      'payeeLegalSubjectId',
    ]) {
      expect(fields.some((field) => field.key === key)).toBe(false);
    }
  });
  it('关闭默认删除，待确认才编辑；状态与累计金额只读，敏感财务资料不进入列表导出', () => {
    expect(settlementOrderPageCrudConfig.allowDelete).toBe(false);
    expect(settlementOrderPageCrudConfig.editVisibleOn).toBe(
      "status == 'PendingConfirmation'",
    );
    for (const key of ['status', 'paidAmount', 'initialSettlementAmount'])
      expect(
        settlementOrderPageCrudConfig.fields.find((field) => field.key === key)
          ?.form,
      ).toBe(false);
    for (const key of [
      'payeeBankAccount',
      'payerInvoiceInfo',
      'invoiceDocuments',
      'paymentDocuments',
      'actionLog',
    ])
      expect(
        settlementOrderPageCrudConfig.fields.some((field) => field.key === key),
      ).toBe(false);
    expect(
      settlementOrderPageCrudConfig.fields.find(
        (field) => field.key === 'settlementContent',
      ),
    ).toMatchObject({
      complexValue: true,
      fullRow: true,
      jsonSchemaEditor: true,
      jsonSchemaMode: 'popup',
      table: false,
      export: false,
      detail: false,
    });
  });
  it('财务权限来自实际 API 注解，保留显式资源段', () => {
    expect(
      getResAuthorizeMeta(
        settlementOrderService.readFinancialDetails as Parameters<
          typeof getResAuthorizeMeta
        >[0],
      ),
    ).toMatchObject({
      type: '业务数据',
      res: '结算单',
      action: '查看结算资料',
    });
    expect(settlementFinancialPermission).toEqual([
      'com.levin.oak.base:业务数据:结算单:查看结算资料',
    ]);
  });
  it('拒绝非法结算时间、空 JSON 和普通编辑金额调整，不恢复排除字段', () => {
    expect(() =>
      validateSettlementSave(
        { startTime: '2026-10-18T02:00:00', endTime: '2026-10-18T01:00:00' },
        null,
      ),
    ).toThrow();
    expect(() =>
      validateSettlementSave({ settlementContent: '{}' }, null),
    ).toThrow();
    expect(() =>
      validateSettlementSave(
        { settlementAmount: '20' },
        { settlementAmount: '10' },
      ),
    ).toThrow();
    expect(
      validateSettlementSave({ startTime: '2026-10-18T01:00:00' }, null),
    ).not.toHaveProperty('settlementContent');
    expect(
      validateSettlementSave({ settlementContent: '{"orders":[1]}' }, null)
        .settlementContent,
    ).toEqual({ orders: [1] });
    expect(
      validateSettlementSave(
        { settlementContent: { custom: { amount: 1 } } },
        null,
      ).settlementContent,
    ).toEqual({ custom: { amount: 1 } });
  });
});
