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

export interface PayChannelSelectionState {
  detailInfo?: unknown;
  providerCode?: unknown;
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
  };
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

export function normalizePayChannelDetailInfo(detailInfo: unknown) {
  if (detailInfo && typeof detailInfo === 'object' && !Array.isArray(detailInfo)) {
    return detailInfo as Record<string, any>;
  }
  return {};
}

export function reconcilePayChannelProviderSelection(
  selection: PayChannelSelectionState,
  providers: PayChannelPluginProvider[],
  pluginConfigured: boolean,
) {
  const detailInfo = normalizePayChannelDetailInfo(selection.detailInfo);

  if (!pluginConfigured) {
    return {
      detailInfo: {},
      providerCode: undefined,
    };
  }

  const providerCode =
    normalizeText(selection.providerCode) ||
    normalizeText(detailInfo.providerCode);
  const schemaSource = normalizeText(detailInfo['@JsonSchema']);
  const currentProvider = providers.find((item) => item.code === providerCode);

  if (currentProvider) {
    const controlledDetailInfo = createPayChannelDetailInfo(currentProvider);
    if (
      schemaSource &&
      schemaSource !== controlledDetailInfo['@JsonSchema']
    ) {
      return {
        detailInfo: controlledDetailInfo,
        providerCode: currentProvider.code,
      };
    }

    return {
      detailInfo: {
        ...detailInfo,
        ...controlledDetailInfo,
      },
      providerCode: currentProvider.code,
    };
  }

  if (providerCode || schemaSource) {
    return {
      detailInfo: {},
      providerCode: undefined,
    };
  }

  return {
    detailInfo,
    providerCode: undefined,
  };
}
