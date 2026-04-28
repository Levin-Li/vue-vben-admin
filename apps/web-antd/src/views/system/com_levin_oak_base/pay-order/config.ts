import type { CrudPageConfig } from '../../shared/types';

import {
  DEFAULT_CRUD_MODAL_WIDTH,
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  payChannelOptionsLoader,
  payChannelTypeOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const currencyTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.CurrencyType',
);
const payWayOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.PayWay',
);
const tradeStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.TradeStatus',
);
const currencyCodeOptionsLoader = buildDictOptionsLoader('CurrencyCode');

export const payOrderPageCrudConfig: CrudPageConfig = {
  apiBase: '/PayOrder',
  defaultFormValues: {
    amount: 0,
    discountAmount: 0,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    { key: 'tenantId', label: '归属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForSaasUser: true },
    { key: '__tenant', label: '归属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForSaasUser: true, width: 180 },
    { key: 'id', label: '订单ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    { key: 'bizType', label: '业务类型', search: true, table: true, width: 140 },
    { key: 'bizObjId', label: '业务对象ID', table: true, width: 180 },
    { key: 'bizOrderNo', label: '业务单号', search: true, table: true, width: 180 },
    { key: 'title', label: '订单标题', search: true, table: true, width: 180 },
    { key: 'amount', label: '支付金额', table: true, type: 'number', width: 120 },
    { key: 'discountAmount', label: '优惠金额', table: true, type: 'number', width: 120 },
    { key: 'inCurrencyType', label: '货币类型', form: false, loadOptions: currencyTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'currencyType', label: '货币类型', loadOptions: currencyTypeOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'currencyCode', label: '货币代码', loadOptions: currencyCodeOptionsLoader, search: true, table: true, type: 'select', width: 120 },
    { key: 'payChannelId', label: '支付通道', loadOptions: payChannelOptionsLoader, remoteSearch: true, search: true, type: 'select' },
    { key: 'inPayChannelType', label: '支付通道类型', form: false, loadOptions: payChannelTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'payChannelType', label: '支付通道类型', loadOptions: payChannelTypeOptionsLoader, table: true, type: 'select', width: 140 },
    { key: 'payAppName', label: '支付工具名称', table: true, width: 160 },
    { key: 'inPayWay', label: '支付方式', form: false, loadOptions: payWayOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'payWay', label: '支付方式', loadOptions: payWayOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'inPayStatus', label: '支付状态', form: false, loadOptions: tradeStatusOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'payStatus', label: '支付状态', loadOptions: tradeStatusOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'payResultDesc', label: '支付结果描述', fullRow: true, type: 'textarea' },
    { key: 'payInfo', label: '支付快照信息', fullRow: true, type: 'json' },
    { key: 'exchangeInfo', label: '换汇信息', fullRow: true, type: 'json' },
    { key: 'gtePayTime', label: '支付时间开始', form: false, search: true, type: 'datetime' },
    { key: 'ltePayTime', label: '支付时间结束', form: false, search: true, type: 'datetime' },
    { key: 'payTime', label: '支付成功时间', table: true, type: 'datetime', width: 180 },
    { key: 'deleteTimeForUnpaid', label: '未支付删除时间', table: true, type: 'datetime', width: 180 },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'lastUpdateTime', label: '更新时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '支付订单管理',
};
