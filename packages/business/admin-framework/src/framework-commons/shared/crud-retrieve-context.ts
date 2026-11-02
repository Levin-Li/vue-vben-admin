type GenericRecord = Record<string, any>;

export function omitNonPlatformTenantId<T extends GenericRecord>(
  payload: T,
  isPlatformUser: boolean,
) {
  if (isPlatformUser || !Object.hasOwn(payload, 'tenantId')) {
    return payload;
  }

  const { tenantId: _tenantId, ...payloadWithoutTenantId } = payload;
  return payloadWithoutTenantId as T;
}

/** 更新定位保留原记录租户，不把隐藏的租户字段当作业务归属变更。 */
export function withCrudUpdateTenantContext<T extends GenericRecord>(
  payload: T,
  record: GenericRecord,
): T {
  // 显式请求值保持原样；原记录无有效租户时不从全局选择器或当前用户猜测。
  const tenantId = record?.tenantId;
  if (
    Object.hasOwn(payload, 'tenantId') ||
    tenantId === undefined ||
    tenantId === null ||
    (typeof tenantId === 'string' && !tenantId.trim())
  )
    return payload;

  return { ...payload, tenantId };
}

export function buildCrudRetrieveParams(
  record: GenericRecord,
  recordKey: string,
) {
  return Object.fromEntries(
    Object.entries({
      [recordKey]: record?.[recordKey],
      orgId: record?.orgId,
    }).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

export function buildCrudDeleteParams(
  record: GenericRecord,
  recordKey: string,
) {
  return Object.fromEntries(
    Object.entries({
      [recordKey]: record?.[recordKey],
    }).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}
