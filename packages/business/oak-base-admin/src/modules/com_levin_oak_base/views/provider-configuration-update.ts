import { omitNonPlatformTenantId } from '@levin/admin-framework/framework-commons/shared/crud-retrieve-context';

// 快捷配置只更新当前供应商，并保留已读取记录的租户范围和版本。
export interface ProviderConfigurationRecord {
  id?: string;
  optimisticLock?: number;
  tenantId?: null | string;
  value?: Record<string, unknown>;
}

export function buildProviderConfigurationUpdate(
  record: ProviderConfigurationRecord,
  providerCode: string,
  configuration: unknown,
  platformActor: boolean,
) {
  return omitNonPlatformTenantId(
    {
      autoForceUpdateField: false,
      forceUpdateFields: ['value'],
      id: record.id,
      optimisticLock: record.optimisticLock,
      tenantId: record.tenantId,
      value: { ...record.value, [providerCode]: configuration },
    },
    platformActor,
  );
}
