import type { SettlementRecord } from '../../api/settlement-order-service';

export const settlementActions = [
  {
    method: 'confirm',
    label: '确认',
    events: ['确认'],
    statuses: ['PendingConfirmation'],
  },
  {
    method: 'invoice',
    label: '开票',
    events: ['开票'],
    statuses: ['Confirmed'],
  },
  {
    method: 'returnInvoice',
    label: '退回发票',
    events: ['退回发票'],
    statuses: ['PendingPayment'],
  },
  {
    method: 'preparePayment',
    label: '进入待打款',
    events: ['进入待打款'],
    statuses: ['Confirmed'],
  },
  {
    method: 'registerPayment',
    label: '登记打款',
    events: ['登记打款'],
    statuses: ['PendingPayment', 'Paying'],
  },
  {
    method: 'adjustAmount',
    label: '协商调整金额',
    events: [],
    statuses: ['PendingConfirmation', 'Confirmed', 'PendingPayment', 'Paying'],
  },
  {
    method: 'confirmReceipt',
    label: '确认收款',
    events: ['确认收款'],
    statuses: ['Paying'],
  },
  {
    method: 'abandon',
    label: '废弃',
    events: ['废弃'],
    statuses: ['PendingConfirmation', 'Confirmed', 'PendingPayment'],
  },
] as const;
export type SettlementActionMethod =
  (typeof settlementActions)[number]['method'];
export function canRunSettlementAction(
  method: SettlementActionMethod,
  record: SettlementRecord,
): boolean {
  const action = settlementActions.find((item) => item.method === method);
  if (
    !action ||
    !(action.statuses as readonly string[]).includes(record.status || '')
  )
    return false;
  if (
    method !== 'adjustAmount' &&
    !action.events.some((event) =>
      record.supportEventsByCurrentStatus?.includes(event),
    )
  )
    return false;
  if (
    method === 'confirmReceipt' &&
    (decimalUnits(record.paidAmount) === undefined ||
      decimalUnits(record.settlementAmount) === undefined ||
      decimalUnits(record.paidAmount) !== decimalUnits(record.settlementAmount))
  )
    return false;
  if (
    (method === 'returnInvoice' || method === 'abandon') &&
    decimalUnits(record.paidAmount) !== 0n
  )
    return false;
  return true;
}
// 使用四位小数整数比较，避免浮点误差与大金额精度损失。
export function decimalUnits(value: unknown): bigint | undefined {
  const text = String(value ?? '');
  if (!/^\d{1,20}(?:\.\d{1,4})?$/.test(text)) return undefined;
  const [integer = '0', fraction = ''] = text.split('.');
  return BigInt(integer) * 10_000n + BigInt(fraction.padEnd(4, '0'));
}
export function positiveMoney(value: unknown): string | undefined {
  const units = decimalUnits(value);
  return units === undefined || units <= 0n
    ? '请输入大于零且最多四位小数的金额'
    : undefined;
}
export const settlementStatusLabels: Record<string, string> = {
  PendingConfirmation: '待确认',
  Confirmed: '已确认',
  PendingPayment: '待打款',
  Paying: '打款中',
  Completed: '已完成',
  Abandoned: '已废弃',
};
