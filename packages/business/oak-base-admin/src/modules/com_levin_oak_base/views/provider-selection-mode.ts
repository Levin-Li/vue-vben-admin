export type ProviderSelectionMode = 'MULTI_CHOICE' | 'SINGLE_ACTIVE';

export type ProviderSelectionModes = Record<string, ProviderSelectionMode>;

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
    if (mode !== 'SINGLE_ACTIVE' && mode !== 'MULTI_CHOICE') {
      throw new Error(`服务插件 ${pluginId} 的供应商选择模式未知`);
    }
    modes[pluginId] = mode;
  }
  return modes;
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
