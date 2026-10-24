// 只在管理端详情响应中补齐展示文案，不改变法律主体关联或持久化数据。
export function withLegalSubjectStatus<T>(response: T): T {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return response;
  }

  const record = response as Record<string, unknown>;
  if (
    record.data &&
    typeof record.data === 'object' &&
    !Array.isArray(record.data)
  ) {
    return {
      ...record,
      data: withLegalSubjectStatus(record.data),
    } as T;
  }

  return { ...record, legalSubjectStatus: getLegalSubjectStatus(record) } as T;
}

// 仅根据服务端返回的关联 ID 派生状态，缺失授权字段时避免误报“待完善”。
export function getLegalSubjectStatus(record: Record<string, unknown>): string {
  if (!Object.hasOwn(record, 'legalSubjectId')) return '状态不可见';
  return record.legalSubjectId === null ||
    record.legalSubjectId === undefined ||
    record.legalSubjectId === ''
    ? '待完善'
    : '已关联';
}
