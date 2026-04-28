import type { CrudPageConfig } from '../../shared/types';

import {
  currencyCodeOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  languageCodeOptionsLoader,
} from '../api-module';

export const nationPageCrudConfig: CrudPageConfig = {
  apiBase: '/Nation',
  defaultFormValues: {
    enable: true,
    orderCode: 100,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  permissionResourceName: '国家',
  permissionTypePrefix: '系统数据-',
  fields: [
    {
      key: 'id',
      label: '国家码',
      disabledOnEdit: true,
      fixed: 'left',
      required: true,
      search: true,
      table: true,
      width: 120,
    },
    { key: 'cnName', label: '中文名', search: true, table: true, width: 140 },
    { key: 'enName', label: '英文名', search: true, table: true, width: 180 },
    {
      key: 'iso3Letter',
      label: '3字母国家码',
      search: true,
      table: true,
      width: 140,
    },
    {
      key: 'telephoneAreaCode',
      label: '电话区号',
      search: true,
      table: true,
      width: 120,
    },
    {
      key: 'language',
      label: '语言',
      loadOptions: languageCodeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    { key: 'continent', label: '洲', search: true, table: true, width: 120 },
    { key: 'timezone', label: '时区', table: true, width: 180 },
    {
      key: 'currencyCode',
      label: '货币编码',
      loadOptions: currencyCodeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 120,
    },
    { key: 'currencyName', label: '货币名称', table: true, width: 140 },
    { key: 'currencySymbol', label: '货币符号', table: true, width: 100 },
    {
      key: 'enable',
      label: '是否启用',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    { key: 'orderCode', label: '排序代码', type: 'number' },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '国家管理',
};
