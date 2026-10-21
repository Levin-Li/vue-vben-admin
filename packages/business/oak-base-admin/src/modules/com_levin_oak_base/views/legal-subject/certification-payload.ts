// 认证事件只传主体与组织上下文，不再携带个人归属。
export function buildCertificationActionPayload(record: Record<string, any>) {
  return {
    id: record.id,
    _operatorAction: record._operatorAction,
    remark: record._operatorAction,
    optimisticLock: record.optimisticLock,
    orgId: record.orgId,
    tenantId: record.tenantId,
  };
}
