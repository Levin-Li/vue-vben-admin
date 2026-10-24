import { getResAuthorizeMeta, getServiceMeta } from '@levin/admin-framework';
import { describe, expect, it } from 'vitest';

import { channelPartnerService } from '../api/channel-partner-service';
import { partnerService } from '../api/partner-service';
import { settlementOrderService } from '../api/settlement-order-service';
import { supplierPartnerService } from '../api/supplier-partner-service';
import { channelPartnerPageCrudConfig } from '../views/channel-partner/config';
import { partnerCommonFields } from '../views/partner/config';
import { settlementOrderPageCrudConfig } from '../views/settlement-order/config';
import { supplierPartnerPageCrudConfig } from '../views/supplier-partner/config';

describe('合作伙伴与结算单 API 操作身份', () => {
  it('共用认证动作使用后端合作伙伴资源类型', () => {
    expect(getServiceMeta(partnerService).type).toBe('业务数据-合作伙伴');
    for (const operation of [
      'submitCertification',
      'approveCertification',
      'rejectCertification',
      'revokeCertification',
    ] as const) {
      expect(
        getResAuthorizeMeta(
          partnerService[operation] as Parameters<
            typeof getResAuthorizeMeta
          >[0],
        ).type,
      ).toBe('业务数据-合作伙伴');
    }
  });
  it('使用后端字段策略返回的业务数据类型', () => {
    for (const [service, type] of [
      [supplierPartnerService, '业务数据-供应伙伴'],
      [channelPartnerService, '业务数据-渠道伙伴'],
      [settlementOrderService, '业务数据-结算单'],
    ] as const) {
      expect(getServiceMeta(service).type).toBe(type);
      for (const operation of [
        'create',
        'list',
        'retrieve',
        'update',
      ] as const) {
        expect(
          getResAuthorizeMeta(
            service[operation] as Parameters<typeof getResAuthorizeMeta>[0],
          ).type,
        ).toBe(type);
      }
    }
  });

  it('伙伴中文资源名称和保存更新权限一致，保留 API 路径', () => {
    for (const [service, config, name, path] of [
      [
        supplierPartnerService,
        supplierPartnerPageCrudConfig,
        '供应伙伴',
        '/SupplierPartner',
      ],
      [
        channelPartnerService,
        channelPartnerPageCrudConfig,
        '渠道伙伴',
        '/ChannelPartner',
      ],
    ] as const) {
      expect(getServiceMeta(service).title).toBe(name);
      expect(getServiceMeta(service).basePath).toBe(path);
      expect(config.title).toBe(name);
      expect(
        getResAuthorizeMeta(
          service.create as Parameters<typeof getResAuthorizeMeta>[0],
        ).action,
      ).toBe(`保存${name}`);
      expect(
        getResAuthorizeMeta(
          service.update as Parameters<typeof getResAuthorizeMeta>[0],
        ).action,
      ).toBe(`更新${name}`);
    }
    expect(getServiceMeta(partnerService).title).toBe('合作伙伴');
  });

  it('列表与详情策略定位到后台实际路由', () => {
    for (const [config, resource] of [
      [supplierPartnerPageCrudConfig, 'SupplierPartner'],
      [channelPartnerPageCrudConfig, 'ChannelPartner'],
      [settlementOrderPageCrudConfig, 'SettlementOrder'],
    ] as const) {
      expect(config.listPath).toBe(`/${resource}/list`);
      expect(config.allowDelete).toBe(false);
    }
    for (const [config, service] of [
      [supplierPartnerPageCrudConfig, supplierPartnerService],
      [channelPartnerPageCrudConfig, channelPartnerService],
    ] as const) {
      expect(config.dataAttrTargets?.retrieve?.method).toBe('GET');
      expect(config.dataAttrTargets?.retrieve?.path).toBe(
        service.buildRequestPath('retrieve'),
      );
    }
    expect(settlementOrderPageCrudConfig.detailPath).toBe(
      '/SettlementOrder/retrieve',
    );
  });

  it('普通合作伙伴列表与详情不展示法定主体名称', () => {
    expect(
      partnerCommonFields.find((field) => field.key === 'legalSubjectName'),
    ).toMatchObject({
      form: false,
      table: false,
      detail: false,
      export: false,
    });
  });
});
