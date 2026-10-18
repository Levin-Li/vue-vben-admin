import { describe, expect, it } from 'vitest';

import {
  canRunSettlementAction,
  decimalUnits,
  positiveMoney,
} from '../actions';

const record = {
  id: 's1',
  optimisticLock: 2,
  status: 'PendingPayment',
  paidAmount: '0',
  settlementAmount: '100.0001',
  supportEventsByCurrentStatus: ['登记打款', '退回发票', '废弃'],
};
describe('结算动作资格', () => {
  it('同时要求服务端事件与合法状态，未知事件失败关闭', () => {
    expect(canRunSettlementAction('registerPayment', record)).toBe(true);
    expect(
      canRunSettlementAction('registerPayment', {
        ...record,
        supportEventsByCurrentStatus: undefined,
      }),
    ).toBe(false);
    expect(
      canRunSettlementAction('registerPayment', {
        ...record,
        status: 'Completed',
      }),
    ).toBe(false);
  });
  it('部分打款禁止退回、废弃和整单确认，足额后才确认收款', () => {
    const partial = {
      ...record,
      status: 'Paying',
      paidAmount: '30',
      supportEventsByCurrentStatus: [
        '登记打款',
        '确认收款',
        '退回发票',
        '废弃',
      ],
    };
    expect(canRunSettlementAction('registerPayment', partial)).toBe(true);
    for (const method of [
      'returnInvoice',
      'abandon',
      'confirmReceipt',
    ] as const)
      expect(canRunSettlementAction(method, partial)).toBe(false);
    expect(
      canRunSettlementAction('confirmReceipt', {
        ...partial,
        paidAmount: '100.0001',
      }),
    ).toBe(true);
    expect(
      canRunSettlementAction('confirmReceipt', {
        ...partial,
        paidAmount: undefined,
        settlementAmount: undefined,
      }),
    ).toBe(false);
  });
  it('金额协商不伪造 FSM 事件且终态不可操作', () => {
    expect(
      canRunSettlementAction('adjustAmount', {
        ...record,
        supportEventsByCurrentStatus: [],
      }),
    ).toBe(true);
    expect(
      canRunSettlementAction('adjustAmount', {
        ...record,
        status: 'Abandoned',
      }),
    ).toBe(false);
  });
  it('四位小数与大金额使用整数精确比较，不接受零、负数或科学记数法', () => {
    expect(decimalUnits('99999999999999999999.9999')).toBe(
      999_999_999_999_999_999_999_999n,
    );
    expect(decimalUnits('1.00001')).toBeUndefined();
    for (const amount of ['0', '-1', '1e3', 'abc'])
      expect(positiveMoney(amount)).toBeTruthy();
    expect(positiveMoney('0.0001')).toBeUndefined();
  });
});
