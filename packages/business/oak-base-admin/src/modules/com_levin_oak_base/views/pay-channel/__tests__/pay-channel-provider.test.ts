import { describe, expect, it } from 'vitest';

import {
  createPayChannelDetailInfo,
  getPayChannelPluginImplType,
  getPayChannelProviders,
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
      providerCode: 'Alipay',
    });
  });
});
