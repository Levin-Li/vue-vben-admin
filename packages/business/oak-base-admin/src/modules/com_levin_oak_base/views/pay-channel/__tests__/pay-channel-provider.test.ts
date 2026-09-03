import { describe, expect, it } from 'vitest';

import {
  createPayChannelDetailInfo,
  getPayChannelPluginImplType,
  getPayChannelProviders,
  reconcilePayChannelProviderSelection,
} from '../pay-channel-provider';

const plugins = [
  {
    pluginImplType: 'com.levin.oak.base.biz.pay.DefaultBizPayServiceImpl',
    providerList: [
      { code: 'Alipay', configEditor: 'class:com.example.Alipay', name: '支付宝' },
      { code: 'Wxpay', configEditor: 'class:com.example.Wxpay', name: '微信支付' },
    ],
  },
  {
    pluginImplType: 'com.levin.oak.base.biz.pay.usdt.UsdtPayServicePlugin',
    providerList: [
      { code: 'NowPayments', configEditor: 'class:com.example.NowPayments' },
      { code: 'Disabled', configEditor: 'class:com.example.Disabled', disabled: true },
    ],
  },
];

describe('支付通道供应商目录', () => {
  it('按货币类型隔离支付插件目录', () => {
    expect(getPayChannelPluginImplType('LEGAL_TENDER')).toBe(
      'com.levin.oak.base.biz.pay.DefaultBizPayServiceImpl',
    );
    expect(getPayChannelProviders('LEGAL_TENDER', plugins).map((item) => item.code)).toEqual([
      'Alipay',
      'Wxpay',
    ]);
    expect(getPayChannelProviders('BLOCK_CHAIN_TOKEN_COIN', plugins).map((item) => item.code)).toEqual([
      'NowPayments',
    ]);
  });

  it('只把受控供应商编辑器写入通道详情', () => {
    expect(
      createPayChannelDetailInfo({
        code: 'Alipay',
        configEditor: 'class:com.example.Alipay',
      }),
    ).toEqual({
      '@JsonSchema': 'class:com.example.Alipay',
    });
  });

  it('不会从旧详情 Schema 推断显式 providerCode 字段', () => {
    expect(
      reconcilePayChannelProviderSelection(
        {
          detailInfo: {
            '@JsonSchema': 'class:com.example.NowPayments',
            callbackSecretRef: 'PAY_CALLBACK_SECRET',
          },
        },
        getPayChannelProviders('BLOCK_CHAIN_TOKEN_COIN', plugins),
        true,
      ),
    ).toEqual({
      detailInfo: {},
      providerCode: undefined,
    });
  });

  it('切换到不兼容的供应商或货币类型时会清空旧配置', () => {
    expect(
      reconcilePayChannelProviderSelection(
        {
          detailInfo: {
            '@JsonSchema': 'class:com.example.Alipay',
            appId: 'legacy-app-id',
            providerCode: 'Alipay',
          },
          providerCode: 'NowPayments',
        },
        getPayChannelProviders('BLOCK_CHAIN_TOKEN_COIN', plugins),
        true,
      ),
    ).toEqual({
      detailInfo: {
        '@JsonSchema': 'class:com.example.NowPayments',
      },
      providerCode: 'NowPayments',
    });

    expect(
      reconcilePayChannelProviderSelection(
        {
          detailInfo: {
            '@JsonSchema': 'class:com.example.Alipay',
            providerCode: 'Alipay',
          },
          providerCode: 'Alipay',
        },
        [],
        false,
      ),
    ).toEqual({
      detailInfo: {},
      providerCode: undefined,
    });
  });
});
