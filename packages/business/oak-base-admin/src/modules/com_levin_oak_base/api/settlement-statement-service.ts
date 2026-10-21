import {
  CRUD,
  RequestService,
  ResAuthorize,
  Service,
} from '@levin/admin-framework';

import { OAK_BASE_API_MODULE } from './_module';

export interface SettlementRecord {
  actionLog?: {
    action?: string;
    afterStatus?: string;
    beforeStatus?: string;
    occurTime?: string;
    operator?: string;
    remark?: string;
  }[];
  counterpartyLegalSubjectId?: string;
  currencyCode?: string;
  endTime?: string;
  id: string;
  initialSettlementAmount?: number | string;
  invoiceDocuments?: Record<string, unknown>[];
  optimisticLock: number;
  orgId?: string;
  ownLegalSubjectId?: string;
  paidAmount?: number | string;
  partnerId?: string;
  payeeBankAccount?: Record<string, unknown>;
  payeeLegalSubjectId?: string;
  payerInvoiceInfo?: Record<string, unknown>;
  payerLegalSubjectId?: string;
  paymentDocuments?: Record<string, unknown>[];
  settlementAmount?: number | string;
  settlementContent?: Record<string, unknown>;
  startTime?: string;
  status?: string;
  supportEventsByCurrentStatus?: string[];
  tenantId?: string;
}
export interface SettlementCommand {
  id: string;
  optimisticLock: number;
  remark?: string;
}
export interface SettlementPaymentCommand extends SettlementCommand {
  amount: string;
  paidTime: string;
  proofFileResId: string;
  requestKey: string;
}
export interface SettlementSaveRequest {
  counterpartyLegalSubjectId?: string;
  currencyCode?: string;
  endTime: string;
  id?: string;
  optimisticLock?: number;
  orgId?: string;
  ownerId?: string;
  ownLegalSubjectId?: string;
  partnerId?: string;
  payeeLegalSubjectId?: string;
  payerLegalSubjectId?: string;
  settlementAmount: number | string;
  settlementContent: Record<string, unknown>;
  startTime: string;
  tenantId?: string;
}

// 流程命令仅保留定位、版本和本动作字段，避免透传列表记录或目标状态。
export function settlementCommand(data: SettlementCommand): SettlementCommand {
  const { id, optimisticLock, remark } = data;
  return { id, optimisticLock, remark };
}
@Service({
  basePath: '/SettlementStatement',
  controllerClass:
    'com.levin.oak.base.controller.BizSettlementStatementController',
  title: '结算单',
  type: '业务数据-结算单',
})
export class SettlementStatementService extends RequestService {
  constructor() {
    super(OAK_BASE_API_MODULE);
  }
  @CRUD.Op({
    label: '废弃',
    visibleOn:
      "status == 'PendingConfirmation' || status == 'Confirmed' || status == 'PendingPayment'",
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '废弃',
  })
  async abandon(data: SettlementCommand): Promise<SettlementRecord> {
    return this.post('abandon', { data: { ...settlementCommand(data) } });
  }
  @CRUD.Op({
    label: '协商调整金额',
    visibleOn: "status != 'Completed' && status != 'Abandoned'",
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '协商调整金额',
  })
  async adjustAmount(
    data: SettlementCommand & { newAmount: string; reason: string },
  ): Promise<SettlementRecord> {
    return this.post('adjustAmount', {
      data: {
        ...settlementCommand(data),
        newAmount: data.newAmount,
        reason: data.reason,
      },
    });
  }
  @CRUD.Op({
    label: '确认',
    visibleOn: "status == 'PendingConfirmation'",
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '确认',
  })
  async confirm(data: SettlementCommand): Promise<SettlementRecord> {
    return this.post('confirm', { data: { ...settlementCommand(data) } });
  }
  @CRUD.Op({
    label: '确认收款',
    visibleOn: "status == 'Paying' && paidAmount == settlementAmount",
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '确认收款',
  })
  async confirmReceipt(data: SettlementCommand): Promise<SettlementRecord> {
    return this.post('confirmReceipt', {
      data: { ...settlementCommand(data) },
    });
  }
  @CRUD.Op({
    label: '创建结算单',
    opRefTargetType: 'None',
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '创建结算单',
  })
  async create(payload: SettlementSaveRequest, options?: any): Promise<string> {
    return this.post('saveSettlementStatement', { ...options, data: payload });
  }
  @CRUD.Op({
    label: '开票',
    visibleOn: "status == 'Confirmed'",
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '开票',
  })
  async invoice(
    data: SettlementCommand & { invoiceRefId: string },
  ): Promise<SettlementRecord> {
    return this.post('invoice', {
      data: { ...settlementCommand(data), invoiceRefId: data.invoiceRefId },
    });
  }
  @CRUD.ListTable({
    refEntityClass: 'com.levin.oak.base.entities.SettlementStatement',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '查询列表',
  })
  async list(
    payload: Record<string, unknown>,
    options?: any,
  ): Promise<{ items: SettlementRecord[]; totals: number }> {
    return this.get('list', { ...options, params: payload });
  }
  @CRUD.Op({
    label: '进入待打款',
    visibleOn: "status == 'Confirmed'",
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '进入待打款',
  })
  async preparePayment(data: SettlementCommand): Promise<SettlementRecord> {
    return this.post('preparePayment', {
      data: { ...settlementCommand(data) },
    });
  }
  @CRUD.Op({ label: '查看结算资料', confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据',
    res: '结算单',
    action: '查看结算资料',
  })
  async readFinancialDetails(
    payload: Pick<SettlementCommand, 'id'>,
    options?: any,
  ): Promise<SettlementRecord> {
    // 财务范围由服务端会话判定，查询参数只提交单据 ID。
    return this.get('readFinancialDetails', {
      ...options,
      params: { id: payload.id },
    });
  }
  @CRUD.Op({
    label: '登记打款',
    visibleOn: "status == 'PendingPayment' || status == 'Paying'",
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '登记打款',
  })
  async registerPayment(
    data: SettlementPaymentCommand,
  ): Promise<SettlementRecord> {
    return this.post('registerPayment', {
      data: {
        ...settlementCommand(data),
        amount: data.amount,
        paidTime: data.paidTime,
        proofFileResId: data.proofFileResId,
        requestKey: data.requestKey,
      },
    });
  }
  @CRUD.Op({ confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '查看详情',
  })
  async retrieve(
    payload: Pick<SettlementCommand, 'id'>,
    options?: any,
  ): Promise<SettlementRecord> {
    return this.get('retrieve', { ...options, params: payload });
  }
  @CRUD.Op({
    label: '退回发票',
    visibleOn: "status == 'PendingPayment' && paidAmount == 0",
    confirmText: 'None',
  })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '退回发票',
  })
  async returnInvoice(
    data: SettlementCommand & { reason: string },
  ): Promise<SettlementRecord> {
    return this.post('returnInvoice', {
      data: { ...settlementCommand(data), reason: data.reason },
    });
  }
  @CRUD.Op({ label: '修改结算单', confirmText: 'None' })
  @ResAuthorize({
    domain: 'com.levin.oak.base',
    type: '业务数据-结算单',
    action: '修改结算单',
  })
  async update(
    payload: SettlementSaveRequest,
    options?: any,
  ): Promise<SettlementRecord> {
    return this.put('updateSettlementStatement', { ...options, data: payload });
  }
}
export const settlementStatementService = new SettlementStatementService();
