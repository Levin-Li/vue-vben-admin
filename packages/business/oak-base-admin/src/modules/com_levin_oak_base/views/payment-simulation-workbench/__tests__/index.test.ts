import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  'packages/business/oak-base-admin/src/modules/com_levin_oak_base/views/payment-simulation-workbench/index.vue',
  'utf8',
);

describe('payment simulation workbench page', () => {
  it('probes backend availability and keeps a clear simulation safety warning', () => {
    expect(source).toContain('paymentSimulationWorkbenchService.status()');
    expect(source).toContain('当前环境未启用支付模拟器');
    expect(source).toContain('不会调用真实供应商、真实钱包或真实资金');
  });

  it('wires the minimal create confirm query workflow through the API service', () => {
    expect(source).toContain('paymentSimulationWorkbenchService.createOrder');
    expect(source).toContain('paymentSimulationWorkbenchService.advanceConfirmation');
    expect(source).toContain('paymentSimulationWorkbenchService.query');
    expect(source).toContain('providerPaymentId');
    expect(source).toContain('推进 1 次确认');
    expect(source).toContain('查询当前状态');
  });

  it('shows durable notification evidence and callback state comparison', () => {
    expect(source).toContain('通知审计');
    expect(source).toContain('前后状态对比');
    expect(source).toContain('latestMutationLabel');
    expect(source).toContain('notificationRecords');
  });

  it('keeps simulator network and confirmation settings read only in the UI', () => {
    expect(source).toContain('固定结算网络');
    expect(source).toContain('固定确认数');
    expect(source).not.toContain("v-model:value=\"formState.settlementNetwork\"");
    expect(source).not.toContain("v-model:value=\"formState.requiredConfirmationCount\"");
  });
});
