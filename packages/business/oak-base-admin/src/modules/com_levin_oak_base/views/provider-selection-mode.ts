export type ProviderSelectionMode =
  | 'MULTI_ACTIVE_BALANCED'
  | 'MULTI_CHOICE'
  | 'SINGLE_ACTIVE';

export type ProviderSelectionModes = Record<string, ProviderSelectionMode>;

// 将接口使用的稳定编码转换为管理员可直接理解的名称。
export function getProviderSelectionModeLabel(mode: unknown): string {
  if (mode === 'SINGLE_ACTIVE') return '单一启用供应商';
  if (mode === 'MULTI_CHOICE') return '使用时选择供应商';
  if (mode === 'MULTI_ACTIVE_BALANCED') return '多家供应商自动分配';
  return '未知模式';
}

export function parseProviderSelectionModesResponse(
  value: unknown,
): ProviderSelectionModes {
  const response = value as undefined | { data?: unknown };
  return parseProviderSelectionModes(response?.data ?? value);
}

export function parseProviderSelectionModes(
  value: unknown,
): ProviderSelectionModes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('服务插件供应商选择模式格式错误');
  }
  const modes: ProviderSelectionModes = {};
  for (const [pluginId, mode] of Object.entries(value)) {
    if (
      mode !== 'SINGLE_ACTIVE' &&
      mode !== 'MULTI_CHOICE' &&
      mode !== 'MULTI_ACTIVE_BALANCED'
    ) {
      throw new Error(`服务插件 ${pluginId} 的供应商选择模式未知`);
    }
    modes[pluginId] = mode;
  }
  return modes;
}

export interface ProviderConfigurationRules {
  allowMultipleConfigurations?: boolean | null;
  providerList?: Array<{
    allowMultipleConfigurations?: boolean | null;
    code?: string;
  }>;
}

// 配置实例数量由插件和具体供应商共同决定，与运行时选择模式无关。
export function allowsMultipleProviderInstances(
  plugin: ProviderConfigurationRules | undefined,
  providerCode?: string,
): boolean {
  if (
    !plugin ||
    plugin.allowMultipleConfigurations === false ||
    !providerCode
  ) {
    return false;
  }

  return (
    plugin.providerList?.some(
      (provider) =>
        provider.code === providerCode &&
        provider.allowMultipleConfigurations === true,
    ) === true
  );
}

export function allowsMultipleActiveProviders(
  mode: ProviderSelectionMode | undefined,
): boolean {
  return mode === 'MULTI_CHOICE' || mode === 'MULTI_ACTIVE_BALANCED';
}

export function getProviderSelectionMode(
  modes: ProviderSelectionModes,
  pluginId?: string,
): ProviderSelectionMode | undefined {
  return pluginId ? modes[pluginId] : undefined;
}

export function describeProviderConfiguration(
  directoryDisabled: boolean,
  configuration: unknown,
): string {
  if (directoryDisabled) return '目录禁用';
  if (
    !configuration ||
    typeof configuration !== 'object' ||
    Array.isArray(configuration)
  ) {
    return '未配置';
  }
  return (configuration as Record<string, unknown>).enable === true
    ? '配置启用'
    : '配置停用';
}
