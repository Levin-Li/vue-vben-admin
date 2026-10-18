import { afterEach, describe, expect, it, vi } from 'vitest';

import { settlementStatementService } from '../../../api/settlement-statement-service';

afterEach(() => vi.restoreAllMocks());
describe('结算动作请求契约', () => {
  it('登记打款只提交请求 DTO，保留同一幂等键且不夹带状态或财务单据', async () => {
    const post = vi
      .spyOn(settlementStatementService as any, 'post')
      .mockResolvedValue({ id: 's1' });
    const request = {
      id: 's1',
      tenantId: 't1',
      orgId: 'o1',
      optimisticLock: 3,
      amount: '12.0001',
      paidTime: '2026-10-18T00:00:00',
      proofFileResId: 'file-1',
      requestKey: 'key-1',
      status: 'Completed',
      paymentDocuments: ['forged'],
    };
    await settlementStatementService.registerPayment(request);
    await settlementStatementService.registerPayment(request);
    expect(post).toHaveBeenNthCalledWith(1, 'registerPayment', {
      data: {
        id: 's1',
        optimisticLock: 3,
        remark: undefined,
        amount: '12.0001',
        paidTime: '2026-10-18T00:00:00',
        proofFileResId: 'file-1',
        requestKey: 'key-1',
      },
    });
    expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
  });
  it('退回发票仅提交当前版本与原因，不提交整个发票数组', async () => {
    const post = vi
      .spyOn(settlementStatementService as any, 'post')
      .mockResolvedValue({ id: 's1' });
    await settlementStatementService.returnInvoice({
      id: 's1',
      optimisticLock: 4,
      reason: '抬头有误',
    });
    expect(post).toHaveBeenCalledWith('returnInvoice', {
      data: {
        id: 's1',
        optimisticLock: 4,
        remark: undefined,
        reason: '抬头有误',
      },
    });
  });
  it('财务详情和动作预读仅提交记录ID，范围来自当前会话', async () => {
    const get = vi
      .spyOn(settlementStatementService as any, 'get')
      .mockResolvedValue({ id: 's1' });
    await settlementStatementService.readFinancialDetails({ id: 's1' });
    await settlementStatementService.retrieve({ id: 's1' });
    expect(get).toHaveBeenNthCalledWith(1, 'readFinancialDetails', {
      params: { id: 's1' },
    });
    expect(get).toHaveBeenNthCalledWith(2, 'retrieve', {
      params: { id: 's1' },
    });
  });
});
