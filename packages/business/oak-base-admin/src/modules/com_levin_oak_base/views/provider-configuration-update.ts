import { omitNonPlatformTenantId } from '@levin/admin-framework/framework-commons/shared/crud-retrieve-context';

// 快捷配置只更新当前供应商，并保留已读取记录的租户范围和版本。
export interface ProviderConfigurationRecord {
  id?: string;
  optimisticLock?: number;
  servicePluginProviderCode?: string;
  servicePluginProviderInstanceCode?: string;
  tenantId?: null | string;
  value?: Record<string, unknown>;
}

// 新增设置只初始化自身供应商；更新基本信息时供应商编码保持不可变。
export function prepareProviderSettingSubmit(
  values: Record<string, unknown>,
  editing: boolean,
) {
  if (editing) {
    const {
      servicePluginProviderCode: _providerCode,
      servicePluginProviderInstanceCode: _providerInstanceCode,
      usageCount: _usageCount,
      ...editableValues
    } = values;
    return editableValues;
  }
  const providerCode = String(values.servicePluginProviderCode || '').trim();
  const providerInstanceCode = String(
    values.servicePluginProviderInstanceCode || 'default',
  ).trim();
  if (!providerCode) throw new Error('请选择供应商');
  if (!providerInstanceCode) throw new Error('请输入配置实例编码');
  return {
    ...values,
    servicePluginProviderInstanceCode: providerInstanceCode,
    usageCount: 0,
    usageWeight: Number(values.usageWeight || 1),
    value: { [providerCode]: {} },
  };
}

export function buildProviderConfigurationUpdate(
  record: ProviderConfigurationRecord,
  providerCode: string,
  configuration: unknown,
  platformActor: boolean,
) {
  if (!providerCode || record.servicePluginProviderCode !== providerCode) {
    throw new Error('供应商编码与当前设置记录不一致');
  }
  return omitNonPlatformTenantId(
    {
      autoForceUpdateField: false,
      forceUpdateFields: ['value'],
      id: record.id,
      optimisticLock: record.optimisticLock,
      tenantId: record.tenantId,
      value: { [providerCode]: configuration },
    },
    platformActor,
  );
}
