import { getResAuthorizeMeta } from '@levin/admin-framework';
import { describe, expect, it } from 'vitest';

import { settlementStatementService } from '../../../api/settlement-statement-service';
import {
  settlementFinancialPermission,
  settlementStatementPageCrudConfig,
  validateSettlementSave,
} from '../config';

describe('结算单标准 CRUD', () => {
  it('关闭默认删除，待确认才编辑；状态与累计金额只读，敏感财务资料不进入列表导出', () => {
    expect(settlementStatementPageCrudConfig.allowDelete).toBe(false);
    expect(settlementStatementPageCrudConfig.editVisibleOn).toBe(
      "status == 'PendingConfirmation'",
    );
    for (const key of ['status', 'paidAmount', 'initialSettlementAmount'])
      expect(
        settlementStatementPageCrudConfig.fields.find(
          (field) => field.key === key,
        )?.form,
      ).toBe(false);
    for (const key of [
      'payeeBankAccount',
      'payerInvoiceInfo',
      'invoiceDocuments',
      'paymentDocuments',
      'actionLog',
    ])
      expect(
        settlementStatementPageCrudConfig.fields.some(
          (field) => field.key === key,
        ),
      ).toBe(false);
    expect(
      settlementStatementPageCrudConfig.fields.find(
        (field) => field.key === 'settlementContent',
      ),
    ).toMatchObject({
      complexValue: true,
      fullRow: true,
      table: false,
      export: false,
      detail: false,
    });
  });
  it('财务权限来自实际 API 注解，保留显式资源段', () => {
    expect(
      getResAuthorizeMeta(
        settlementStatementService.readFinancialDetails as Parameters<
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
  });
});
