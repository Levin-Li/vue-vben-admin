import { describe, expect, it, vi } from 'vitest';

import {
  electronicInvoiceProviderConnectionPageCrudConfig,
  electronicInvoiceProviderOptions,
  getElectronicInvoiceProviderGuide,
  pageMeta,
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
  it('uses the authorization name in the page and field labels', () => {
    expect(pageMeta.title).toBe('开票授权');
    expect(electronicInvoiceProviderConnectionPageCrudConfig.title).toBe(
      '开票授权',
    );
    expect(electronicInvoiceProviderConnectionPageCrudConfig.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'status', label: '授权状态' }),
      ]),
    );
  });

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

  it('requires a legal subject and does not ask for a partner relation', async () => {
    const fields = electronicInvoiceProviderConnectionPageCrudConfig.fields;
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'legalSubjectId',
          label: '法律主体',
          required: true,
          search: true,
        }),
      ]),
    );
    expect(fields?.some((field) => field.key === 'partnerId')).toBe(false);
    const subjectField = fields?.find(
      (field) => field.key === 'legalSubjectId',
    );
    expect(
      subjectField?.tableValue?.({
        legalSubjectId: 'subject-1',
        legalSubjectName: '甲公司',
      }),
    ).toBe('甲公司');
    await expect(
      electronicInvoiceProviderConnectionPageCrudConfig.transformSubmit?.(
        { providerCode: 'nuonuo', simulation: true },
        null,
      ),
    ).rejects.toThrow('请选择需要开票的法律主体');
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

  it('keeps operation-specific authorization guidance', () => {
    expect(getElectronicInvoiceProviderGuide('fapiaotong')).toMatchObject({
      authorizationRefLabel: '发票通授权引用',
      supportLevel: 'full',
    });
    expect(getElectronicInvoiceProviderGuide('nuonuo')).toMatchObject({
      authorizationRefLabel: '诺诺授权引用',
      supportLevel: 'full',
    });
    expect(getElectronicInvoiceProviderGuide('wechatpay')).toMatchObject({
      authorizationRefLabel: '腾讯授权引用',
      supportLevel: 'limited',
    });
  });

  it('normalizes simulation mode and blocks unsupported Tencent live activation', async () => {
    await expect(
      electronicInvoiceProviderConnectionPageCrudConfig.transformSubmit?.(
        {
          legalSubjectId: 'subject-1',
          providerCode: 'nuonuo',
          simulation: 'false',
        },
        null,
      ),
    ).resolves.toMatchObject({
      legalSubjectId: 'subject-1',
      providerCode: 'nuonuo',
      simulation: false,
    });

    await expect(
      electronicInvoiceProviderConnectionPageCrudConfig.transformSubmit?.(
        {
          legalSubjectId: 'subject-2',
          providerCode: 'wechatpay',
          simulation: false,
        },
        null,
      ),
    ).rejects.toThrow(/腾讯电子发票当前仅支持模拟或灰度联调/);
  });
});
