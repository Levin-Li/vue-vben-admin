import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import {
  brandOptionsLoader,
  tenantSiteDnsDomainOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

export const tenantSitePageCrudConfig: CrudPageConfig = {
  apiBase: '/TenantSite',
  createPath: '/TenantSite/create',
  createPermission: '/TenantSite/create',
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  description:
    '租户站点只保存站点配置和完整域名字符串，域名资产、解析和证书在域名管理中维护。',
  fields: [
    {
      key: 'tenantId',
      label: '所属租户',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      required: true,
      search: true,
      type: 'select',
      visibleForSaasUser: true,
    },
    {
      key: '__tenant',
      label: '所属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForSaasUser: true,
      width: 180,
    },
    {
      key: 'id',
      label: '站点ID',
      fixed: 'left',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'brandId',
      label: '品牌',
      loadOptions: brandOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
    },
    {
      key: 'name',
      label: '站点名称',
      required: true,
      search: true,
      table: true,
      width: 150,
    },
    {
      key: 'domain',
      label: '完整域名',
      allowInput: true,
      loadOptions: tenantSiteDnsDomainOptionsLoader,
      placeholder: '可手动输入或选择完整域名',
      required: true,
      search: true,
      searchOrder: -100,
      table: true,
      type: 'select',
      width: 220,
    },
    { key: 'shortcutIcon', label: 'shortcutIcon', type: 'image' },
    { key: 'logo', label: 'Logo', table: true, type: 'image', width: 90 },
    {
      key: 'gteExpiredTime',
      label: '站点到期开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteExpiredTime',
      label: '站点到期结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'expiredTime',
      label: '站点到期时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    { key: 'techSupport', label: '技术支持', fullRow: true, type: 'textarea' },
    { key: 'copyright', label: '版权声明', fullRow: true, type: 'textarea' },
    { key: 'uiExInfo', label: '前端展示扩展信息', fullRow: true, type: 'json' },
    { key: 'exInfo', label: '扩展信息', fullRow: true, type: 'json' },
    { key: 'orderCode', label: '排序代码', type: 'number' },
    {
      key: 'enable',
      label: '是否启用',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    { key: 'remark', label: '备注', type: 'textarea' },
  ],
  modalWidth: 1000,
  title: '租户站点管理',
  transformSubmit: async (values) => {
    const nextValues = { ...values };
    nextValues.domain = String(nextValues.domain || '').trim();

    if (!nextValues.domain) {
      throw new TypeError('请选择完整域名');
    }

    return nextValues;
  },
};
