export interface PayChannelPluginProvider {
  code?: string;
  configEditor?: string;
  disabled?: boolean;
  name?: string;
}

export interface PayChannelServicePlugin {
  enable?: boolean;
  pluginImplType?: string;
  providerList?: PayChannelPluginProvider[];
}

export const PAY_CHANNEL_PLUGIN_IMPL_TYPES: Record<string, string> = {
  BLOCK_CHAIN_TOKEN_COIN:
    'com.levin.oak.base.biz.pay.usdt.UsdtPayServicePlugin',
  LEGAL_TENDER: 'com.levin.oak.base.biz.pay.DefaultBizPayServiceImpl',
};

export function getPayChannelPluginImplType(currencyType: unknown) {
  return PAY_CHANNEL_PLUGIN_IMPL_TYPES[String(currencyType || '')];
}

export function getPayChannelProviders(
  currencyType: unknown,
  plugins: PayChannelServicePlugin[],
) {
  const pluginImplType = getPayChannelPluginImplType(currencyType);
  const plugin = plugins.find(
    (item) =>
      item.enable !== false && item.pluginImplType === pluginImplType,
  );

  return (plugin?.providerList || []).filter(
    (item) =>
      Boolean(item.code) &&
      !item.disabled &&
      String(item.configEditor || '').trim().startsWith('class:'),
  );
}

export function createPayChannelDetailInfo(
  provider: PayChannelPluginProvider,
) {
  return {
    '@JsonSchema': String(provider.configEditor || '').trim(),
    providerCode: provider.code,
  };
}
