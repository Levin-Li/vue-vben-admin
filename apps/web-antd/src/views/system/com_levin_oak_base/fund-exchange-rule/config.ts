import type { CrudPageConfig } from '../../shared/types';

import {
  DEFAULT_CRUD_MODAL_WIDTH,
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const currencyTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.CurrencyType',
);
const currencyCodeOptionsLoader = buildDictOptionsLoader('CurrencyCode');

export const fundExchangeRulePageCrudConfig: CrudPageConfig = {
  apiBase: '/FundExchangeRule',
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
    sourceCurrencyOnlyFromRecharge: false,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    { key: 'tenantId', label: '归属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForSaasUser: true },
    { key: '__tenant', label: '归属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForSaasUser: true, width: 180 },
    { key: 'id', label: '规则ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    { key: 'name', label: '名称', required: true, search: true, table: true, width: 160 },
    { key: 'category', label: '规则类别', search: true, table: true, width: 140 },
    { key: 'gteExpiredTime', label: '有效期开始', form: false, search: true, type: 'datetime' },
    { key: 'lteExpiredTime', label: '有效期结束', form: false, search: true, type: 'datetime' },
    { key: 'expiredTime', label: '有效期', table: true, type: 'datetime', width: 180 },
    { key: 'sourceCurrencyOnlyFromRecharge', label: '仅支持外部充值来源', search: true, table: true, type: 'switch', valueType: 'boolean', width: 140 },
    { key: 'inSourceCurrencyType', label: '原货币类型', form: false, loadOptions: currencyTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'sourceCurrencyType', label: '原货币类型', loadOptions: currencyTypeOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'sourceCurrencyCode', label: '原货币代码', loadOptions: currencyCodeOptionsLoader, type: 'select', width: 120 },
    { key: 'sourceCurrencyAmount', label: '原货币数量', table: true, type: 'number', width: 120 },
    { key: 'inTargetCurrencyType', label: '目标货币类型', form: false, loadOptions: currencyTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'targetCurrencyType', label: '目标货币类型', loadOptions: currencyTypeOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'targetCurrencyCode', label: '目标货币代码', loadOptions: currencyCodeOptionsLoader, type: 'select', width: 120 },
    { key: 'targetCurrencyAmount', label: '目标货币数量', table: true, type: 'number', width: 120 },
    { key: 'targetCurrencyDuration', label: '目标有效时长', type: 'number' },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'editable', label: '是否可编辑', search: true, table: true, type: 'switch', valueType: 'boolean', width: 110 },
    { key: 'deleted', label: '是否已删除', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'remark', label: '备注', type: 'textarea' },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'lastUpdateTime', label: '更新时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '资金兑换规则管理',
};
