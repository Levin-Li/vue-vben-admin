import type { CrudPageConfig } from '../../shared/types';

import {
  DEFAULT_CRUD_MODAL_WIDTH,
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  payChannelAgentCodeOptionsLoader,
  payChannelTypeOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const currencyTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.CurrencyType',
);
const currencyCodeOptionsLoader = buildDictOptionsLoader('CurrencyCode');

export const payChannelPageCrudConfig: CrudPageConfig = {
  apiBase: '/PayChannel',
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
    currencyCodeList: [],
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    { key: 'tenantId', label: '归属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForSaasUser: true },
    { key: '__tenant', label: '归属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForSaasUser: true, width: 180 },
    { key: 'id', label: '通道ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    { key: 'name', label: '通道名称', required: true, search: true, table: true, width: 180 },
    { key: 'gteExpiredTime', label: '有效期开始', form: false, search: true, type: 'datetime' },
    { key: 'lteExpiredTime', label: '有效期结束', form: false, search: true, type: 'datetime' },
    { key: 'expiredTime', label: '有效期', table: true, type: 'datetime', width: 180 },
    { key: 'logo', label: '支付通道图标', table: true, type: 'image', width: 120 },
    { key: 'inType', label: '通道类型', form: false, loadOptions: payChannelTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'type', label: '通道类型', loadOptions: payChannelTypeOptionsLoader, table: true, type: 'select', width: 140 },
    { key: 'inCurrencyType', label: '货币类型', form: false, loadOptions: currencyTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'currencyType', label: '货币类型', loadOptions: currencyTypeOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'currencyCodeList', label: '支持货币代码', fullRow: true, loadOptions: currencyCodeOptionsLoader, multiple: true, type: 'select' },
    { key: 'inAgentCode', label: '通道代理商', form: false, loadOptions: payChannelAgentCodeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'agentCode', label: '通道代理商', loadOptions: payChannelAgentCodeOptionsLoader, table: true, type: 'select', width: 140 },
    { key: 'rate', label: '通道费率', table: true, type: 'number', width: 120 },
    { key: 'merchantId', label: '商户编码', table: true, width: 160 },
    { key: 'merchantName', label: '商户名称', table: true, width: 160 },
    { key: 'payWayItemList', label: '支持支付方式', fullRow: true, type: 'json' },
    { key: 'detailInfo', label: '通道详情', fullRow: true, type: 'json' },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'editable', label: '是否可编辑', search: true, table: true, type: 'switch', valueType: 'boolean', width: 110 },
    { key: 'remark', label: '备注', type: 'textarea' },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'lastUpdateTime', label: '更新时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '支付渠道管理',
};
