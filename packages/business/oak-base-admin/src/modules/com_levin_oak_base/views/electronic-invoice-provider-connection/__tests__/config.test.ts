import { describe, expect, it, vi } from 'vitest';

import {
  electronicInvoiceProviderConnectionPageCrudConfig,
  electronicInvoiceProviderOptions,
  getElectronicInvoiceProviderGuide,
} from '../config';

vi.mock('../../../api/electronic-invoice-provider-connection-service', () => ({
  electronicInvoiceProviderConnectionService: {},
}));

vi.mock('../../api-module', () => ({
  buildModuleOptionsLoader: () => async () => [],
  DEFAULT_CRUD_MODAL_WIDTH: 960,
  tenantOptionsLoader: async () => [],
  withModuleCrudConfig: (config: any) => config,
}));

describe('electronic invoice provider connection page config', () => {
  it('lets platform users select the tenant that owns the issuer connection', () => {
    expect(electronicInvoiceProviderConnectionPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'tenantId',
          type: 'select',
          visibleForPlatformUser: true,
        }),
      ]),
    );
  });

  it('keeps the supported provider options visible to merchants', () => {
    expect(electronicInvoiceProviderOptions).toEqual([
      expect.objectContaining({
        label: '国票信息·发票通',
        value: 'fapiaotong',
      }),
      expect.objectContaining({
        label: '诺诺开放平台',
        value: 'nuonuo',
      }),
      expect.objectContaining({
        label: '腾讯电子发票（灰度）',
        value: 'wechatpay',
      }),
    ]);
  });

  it('exposes provider-specific guidance for authorization and production cutover', () => {
    expect(getElectronicInvoiceProviderGuide('fapiaotong')).toMatchObject({
      authorizationRefLabel: '发票通授权引用',
      statusTag: '推荐接入',
      supportLevel: 'full',
    });
    expect(getElectronicInvoiceProviderGuide('nuonuo')).toMatchObject({
      authorizationRefLabel: '诺诺授权引用',
      statusTag: 'SDK优先',
      supportLevel: 'full',
    });
    expect(getElectronicInvoiceProviderGuide('wechatpay')).toMatchObject({
      authorizationRefLabel: '腾讯授权引用',
      statusTag: '灰度限制',
      supportLevel: 'limited',
    });
  });

  it('normalizes simulation mode and blocks unsupported Tencent live activation', async () => {
    await expect(
      electronicInvoiceProviderConnectionPageCrudConfig.transformSubmit?.(
        {
          partnerId: 'partner-1',
          providerCode: 'nuonuo',
          simulation: 'false',
        },
        null,
      ),
    ).resolves.toMatchObject({
      partnerId: 'partner-1',
      providerCode: 'nuonuo',
      simulation: false,
    });

    await expect(
      electronicInvoiceProviderConnectionPageCrudConfig.transformSubmit?.(
        {
          partnerId: 'partner-2',
          providerCode: 'wechatpay',
          simulation: false,
        },
        null,
      ),
    ).rejects.toThrow(/腾讯电子发票当前仅支持模拟或灰度联调/);
  });
});
