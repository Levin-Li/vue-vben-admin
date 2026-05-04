import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import {
  DEFAULT_CRUD_MODAL_WIDTH,
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const fundAccountStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.FundAccount$Status',
);
const currencyTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.CurrencyType',
);
const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
const currencyCodeOptionsLoader = buildDictOptionsLoader('CurrencyCode');

export const fundAccountPageCrudConfig: CrudPageConfig = {
  apiBase: '/FundAccount',
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
    status: 'Normal',
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    { key: 'tenantId', label: '归属租户', loadOptions: tenantOptionsLoader, remoteSearch: true, search: true, type: 'select', visibleForSaasUser: true },
    { key: '__tenant', label: '归属租户', fixed: 'left', form: false, table: true, type: 'tenant', visibleForSaasUser: true, width: 180 },
    { key: 'id', label: '账户ID', fixed: 'left', form: false, search: true, table: true, width: 180 },
    { key: 'name', label: '账户名称', required: true, search: true, table: true, width: 160 },
    { key: 'inStatus', label: '账户状态', form: false, loadOptions: fundAccountStatusOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'status', label: '账户状态', loadOptions: fundAccountStatusOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'inCurrencyType', label: '货币类型', form: false, loadOptions: currencyTypeOptionsLoader, multiple: true, search: true, type: 'select' },
    { key: 'currencyType', label: '货币类型', loadOptions: currencyTypeOptionsLoader, table: true, type: 'select', width: 120 },
    { key: 'currencyCode', label: '货币代码', loadOptions: currencyCodeOptionsLoader, search: true, table: true, type: 'select', width: 120 },
    { key: 'balance', label: '可用余额', table: true, type: 'number', width: 120 },
    { key: 'freezeBalance', label: '冻结余额', table: true, type: 'number', width: 120 },
    { key: 'creditLimit', label: '授信额度', table: true, type: 'number', width: 120 },
    { key: 'creditBalance', label: '授信余额', table: true, type: 'number', width: 120 },
    { key: 'confidentialLevel', label: '机密等级', loadOptions: confidentialLevelOptionsLoader, type: 'select', valueType: 'number' },
    { key: 'enable', label: '是否启用', search: true, table: true, type: 'switch', valueType: 'boolean', width: 100 },
    { key: 'editable', label: '是否可编辑', search: true, table: true, type: 'switch', valueType: 'boolean', width: 110 },
    { key: 'orderCode', label: '排序代码', type: 'number' },
    { key: 'remark', label: '备注', type: 'textarea' },
    { key: 'createTime', label: '创建时间', form: false, table: true, type: 'datetime', width: 180 },
    { key: 'lastUpdateTime', label: '更新时间', form: false, table: true, type: 'datetime', width: 180 },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '资金账户管理',
};
