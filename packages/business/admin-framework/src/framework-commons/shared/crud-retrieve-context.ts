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

export function buildCrudRetrieveParams(
  record: GenericRecord,
  recordKey: string,
) {
  return Object.fromEntries(
    Object.entries({
      [recordKey]: record?.[recordKey],
      orgId: record?.orgId,
    }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export function buildCrudDeleteParams(
  record: GenericRecord,
  recordKey: string,
) {
  return Object.fromEntries(
    Object.entries({
      [recordKey]: record?.[recordKey],
    }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}
