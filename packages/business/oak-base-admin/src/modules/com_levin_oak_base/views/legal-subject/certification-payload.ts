// 认证事件只传定位、版本与动作参数，多方范围由服务端可信上下文注入。
export function buildCertificationActionPayload(record: Record<string, any>) {
  return {
    id: record.id,
    _operatorAction: record._operatorAction,
    remark: record._operatorAction,
    optimisticLock: record.optimisticLock,
    tenantId: record.tenantId,
  };
}
