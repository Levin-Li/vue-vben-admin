import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { electronicInvoiceProviderConnectionService } from '../../api/electronic-invoice-provider-connection-service';
import {
  buildModuleOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
  withModuleCrudConfig,
} from '../api-module';

const partnerOptions = buildModuleOptionsLoader(
  '/Partner/list',
  'subjectName',
  'id',
);

export type ElectronicInvoiceProviderCode =
  | 'fapiaotong'
  | 'nuonuo'
  | 'wechatpay';

export interface ElectronicInvoiceProviderGuide {
  authorizationRefHelp: string;
  authorizationRefLabel: string;
  authorizationRefPlaceholder: string;
  authorizationSteps: string[];
  liveRequirements: string[];
  merchantFit: string;
  name: string;
  productionGuard: string;
  statusTag: string;
  summary: string;
  supportLevel: 'full' | 'limited';
  terminalRefHelp: string;
  terminalRefLabel: string;
  terminalRefRequired?: boolean;
}

const providerGuides: Record<
  ElectronicInvoiceProviderCode,
  ElectronicInvoiceProviderGuide
> = {
  fapiaotong: {
    authorizationRefHelp:
      '填写国票发票通完成刷脸授权后返回的授权单号、商户关系单号或平台侧授权引用。',
    authorizationRefLabel: '发票通授权引用',
    authorizationRefPlaceholder: '例如：auth-ft-202608280001',
    authorizationSteps: [
      '商户在线完成企业实名认证、协议签约和法人刷脸授权。',
      '在本系统选择“国票信息·发票通”，优先开启模拟器联调。',
      '切正式环境前，把开放平台应用、密钥、回调地址和商户税号绑定完成。',
    ],
    liveRequirements: [
      '商户已在发票通开放平台开通可用应用。',
      '商户税号、开票主体和合作伙伴中的开票信息一致。',
      '已从官方平台拿到正式环境 appKey、appSecret 或等价凭据。',
    ],
    merchantFit: '适合平台代接入，商户自助授权链路相对完整。',
    name: '国票信息·发票通',
    productionGuard:
      '正式开票前必须先在发票通后台完成应用开通、签约和法人刷脸授权，再关闭模拟器。',
    statusTag: '推荐接入',
    summary: '多商户托管和商户自助授权能力较完整，适合作为平台商户主接入通道。',
    supportLevel: 'full',
    terminalRefHelp:
      '若发票通返回税控设备号、开票终端号或全电标识，可回填到这里，方便后续排障。',
    terminalRefLabel: '税控终端/全电标识',
  },
  nuonuo: {
    authorizationRefHelp:
      '填写诺诺开放平台完成企业授权后返回的授权编号、企业编码或官方回跳引用。',
    authorizationRefLabel: '诺诺授权引用',
    authorizationRefPlaceholder: '例如：nn-auth-202608280001',
    authorizationSteps: [
      '商户先在诺诺开放平台完成企业实名认证与应用授权。',
      '联调阶段先使用模拟器验证开票、回调和状态补偿流程。',
      '切正式环境前，确认商户税号、开票邮箱和回调配置已在官方平台生效。',
    ],
    liveRequirements: [
      '商户已具备诺诺正式应用和接口权限。',
      '商户税号、销方名称、银行及地址信息已在合作伙伴开票资料中维护完整。',
      '正式环境 SDK 凭据、回调地址和白名单已在官方平台配置。',
    ],
    merchantFit: '适合已有诺诺合作基础、希望优先走官方 SDK 的商户。',
    name: '诺诺开放平台',
    productionGuard:
      '正式环境需要诺诺官方应用授权和企业资质齐备；未完成前请保持模拟器开启。',
    statusTag: 'SDK优先',
    summary: '官方 SDK 成熟，适合优先走 SDK 接入并复用诺诺已有商户授权体系。',
    supportLevel: 'full',
    terminalRefHelp:
      '诺诺如返回税控设备号、盘号或终端编号，建议同步回填，便于对账与异常定位。',
    terminalRefLabel: '税控终端/税盘标识',
  },
  wechatpay: {
    authorizationRefHelp:
      '填写腾讯电子发票平台或微信支付灰度申请链路返回的授权流水号、商户号关联引用。',
    authorizationRefLabel: '腾讯授权引用',
    authorizationRefPlaceholder: '例如：wx-einvoice-auth-202608280001',
    authorizationSteps: [
      '优先用模拟器联调整条开票链路，先不要直接切正式环境。',
      '如要接入真实环境，需先确认腾讯电子发票能力已经对当前商户开放灰度。',
      '只有灰度资格、接口配置和回调联通都确认后，才考虑关闭模拟器。',
    ],
    liveRequirements: [
      '商户已拿到腾讯电子发票/微信支付侧明确的灰度准入资格。',
      '商户号、回调地址、签名配置和发票能力绑定已经通过官方审核。',
      '没有灰度资格时只能走模拟器，不应发起正式开票。',
    ],
    merchantFit: '适合已拿到腾讯灰度资格的商户；默认只建议做模拟联调。',
    name: '腾讯电子发票（灰度）',
    productionGuard:
      '当前默认只支持模拟或灰度联调；未拿到腾讯灰度资格时禁止关闭模拟器。',
    statusTag: '灰度限制',
    summary:
      '适合补充微信生态场景，但正式能力受灰度准入限制，默认按模拟联调处理。',
    supportLevel: 'limited',
    terminalRefHelp:
      '若腾讯侧提供商户号、设备号或发票终端标识，可回填到这里，帮助后续联调定位。',
    terminalRefLabel: '商户号/终端标识',
  },
};

export const electronicInvoiceProviderOptions = (
  Object.entries(providerGuides) as Array<
    [ElectronicInvoiceProviderCode, ElectronicInvoiceProviderGuide]
  >
).map(([value, guide]) => ({
  label: guide.name,
  value,
}));

export function getElectronicInvoiceProviderGuide(providerCode?: string) {
  if (providerCode && providerCode in providerGuides) {
    return providerGuides[providerCode as ElectronicInvoiceProviderCode];
  }

  return providerGuides.fapiaotong;
}

function normalizeSimulationFlag(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'false') {
      return false;
    }
    if (normalized === 'true') {
      return true;
    }
  }

  return Boolean(value);
}

export const pageMeta = {
  name: 'ElectronicInvoiceProviderConnection',
  title: '电子发票供应商连接',
  description: '维护电子发票供应商连接。',
} as const;

export const electronicInvoiceProviderConnectionPageCrudConfig: CrudPageConfig =
  withModuleCrudConfig({
    apiBase: '/EInvoiceProviderConnection',
    domainObject: true,
    apiService: electronicInvoiceProviderConnectionService,
    createPath: '/EInvoiceProviderConnection/activate',
    title: '电子发票供应商连接',
    modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
    defaultFormValues: {
      simulation: true,
    },
    transformSubmit: async (values) => {
      const providerCode = values.providerCode as
        | ElectronicInvoiceProviderCode
        | undefined;
      const simulation = normalizeSimulationFlag(values.simulation);

      if (!values.partnerId) {
        throw new Error('请先选择已经维护开票信息的合作伙伴。');
      }

      if (!providerCode || !(providerCode in providerGuides)) {
        throw new Error('请选择受支持的电子发票供应商。');
      }

      if (!simulation && providerCode === 'wechatpay') {
        throw new Error(
          '腾讯电子发票当前仅支持模拟或灰度联调；未拿到腾讯灰度资格前，请保持“启用模拟器”为开启状态。',
        );
      }

      return {
        ...values,
        simulation,
      };
    },
    fields: [
      {
        key: 'tenantId',
        label: '归属租户',
        loadOptions: tenantOptionsLoader,
        remoteSearch: true,
        search: true,
        type: 'select',
        visibleForPlatformUser: true,
      },
      {
        key: 'id',
        label: '连接ID',
        form: false,
        search: true,
        table: true,
        width: 180,
      },
      {
        key: 'partnerId',
        label: '开票合作伙伴',
        required: true,
        loadOptions: partnerOptions,
        remoteSearch: true,
        search: true,
        table: true,
        type: 'select',
        width: 220,
        help: '请选择已经维护完整开票资料的合作伙伴；正式联调时该合作伙伴即作为销方主体快照来源。',
      },
      // 精确匹配例外：供应商由固定选项选择，查询时按选中的完整编码过滤。
      {
        key: 'providerCode',
        label: '供应商',
        required: true,
        loadOptions: async () => electronicInvoiceProviderOptions,
        search: true,
        table: true,
        type: 'select',
        width: 150,
        help: (formState) =>
          getElectronicInvoiceProviderGuide(formState.providerCode)
            .productionGuard,
        placeholder: '选择供应商后可查看对应的开户与授权要求',
      },
      {
        key: 'simulation',
        label: '启用模拟器',
        type: 'switch',
        valueType: 'boolean',
        form: true,
        table: false,
        help: (formState) => {
          const guide = getElectronicInvoiceProviderGuide(
            formState.providerCode,
          );

          return formState.providerCode === 'wechatpay'
            ? `${guide.productionGuard} 建议默认开启模拟器完成首轮验收。`
            : `建议先开启模拟器完成全链路验收；${guide.productionGuard}`;
        },
      },
      {
        key: 'status',
        label: '连接状态',
        search: true,
        table: true,
        form: false,
        width: 140,
      },
      {
        key: 'providerMerchantId',
        label: '供应商商户标识',
        table: true,
        width: 200,
      },
      {
        key: 'invoiceTypeList',
        label: '允许票种',
        form: false,
        table: true,
        width: 180,
      },
      { key: 'authorizationRef', label: '授权引用', table: true, width: 220 },
      { key: 'terminalRef', label: '税盘/全电标识', table: true, width: 180 },
      {
        key: 'expiredTime',
        label: '授权有效期',
        form: false,
        table: true,
        type: 'datetime',
        width: 180,
      },
      {
        key: 'diagnosticMessage',
        label: '诊断信息',
        type: 'textarea',
        form: false,
        table: true,
        width: 280,
      },
      {
        key: 'providerExInfo',
        label: '供应商扩展信息',
        type: 'json',
        form: false,
      },
      {
        key: 'createTime',
        label: '创建时间',
        form: false,
        table: true,
        type: 'datetime',
        width: 180,
      },
    ],
  });
