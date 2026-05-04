import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import {
  DEFAULT_CRUD_MODAL_WIDTH,
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const tradeTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.TradeType',
);
const tradeStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.TradeStatus',
);
const currencyTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.CurrencyType',
);
const currencyCodeOptionsLoader = buildDictOptionsLoader('CurrencyCode');
const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);

export const fundAccountLogPageCrudConfig: CrudPageConfig = {
  apiBase: '/FundAccountLog',
  allowCreate: false,
  allowDelete: false,
  allowEdit: false,
  allowRetrieve: true,
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    { key: 'tenantId', label: '归属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForSaasUser: true },
    { key: '__tenant', label: '归属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForSaasUser: true, width: 180 },
    { key: 'id', label: '流水ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    { key: 'tradeAccountId', label: '交易账号ID', search: true, table: true, width: 180 },
    { key: 'tradeAccountName', label: '交易账号名称', search: true, table: true, width: 160 },
    { key: 'tradePeerAccountId', label: '对方账号ID', search: true, table: true, width: 180 },
    { key: 'tradePeerAccountName', label: '对方账号名称', search: true, table: true, width: 160 },
    { key: 'inTradeType', label: '交易类型', form: false, loadOptions: tradeTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'tradeType', label: '交易类型', loadOptions: tradeTypeOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'inTradeStatus', label: '交易状态', form: false, loadOptions: tradeStatusOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'tradeStatus', label: '交易状态', loadOptions: tradeStatusOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'inTradeCurrencyType', label: '货币类型', form: false, loadOptions: currencyTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'tradeCurrencyType', label: '货币类型', loadOptions: currencyTypeOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'tradeCurrencyCode', label: '货币代码', loadOptions: currencyCodeOptionsLoader, search: true, table: true, type: 'select', width: 120 },
    { key: 'tradeAmount', label: '交易金额', table: true, type: 'number', width: 120 },
    { key: 'tradeTitle', label: '交易标题', table: true, width: 180 },
    { key: 'bizOrderNo', label: '业务单号', search: true, table: true, width: 180 },
    { key: 'bizOrderType', label: '业务单类型', table: true, width: 140 },
    { key: 'gteTradeExpiredTime', label: '交易截止开始', form: false, search: true, type: 'datetime' },
    { key: 'lteTradeExpiredTime', label: '交易截止结束', form: false, search: true, type: 'datetime' },
    { key: 'gteCreateTime', label: '记账时间开始', form: false, search: true, type: 'datetime' },
    { key: 'lteCreateTime', label: '记账时间结束', form: false, search: true, type: 'datetime' },
    { key: 'tradeResultDesc', label: '交易结果描述', fullRow: true, type: 'textarea' },
    { key: 'tradeLog', form: false, label: '交易过程信息', fullRow: true, type: 'json' },
    { key: 'extInfo', label: '交易扩展信息', fullRow: true, type: 'json' },
    { key: 'confidentialLevel', label: '机密等级', loadOptions: confidentialLevelOptionsLoader, type: 'select', valueType: 'number' },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'lastUpdateTime', label: '更新时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '资金账户日志管理',
};
