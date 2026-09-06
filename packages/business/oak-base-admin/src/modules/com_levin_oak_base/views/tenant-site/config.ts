import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { tenantSiteService } from '../../api/tenant-site-service';
import {
  brandOptionsLoader,
  tenantSiteDnsDomainOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';
import { siteInfoFormFields, transformSiteInfoSubmit } from '../site-info-form';

export const pageMeta = {
  name: 'TenantSite',
  title: '租户站点管理',
  description: '维护租户站点配置。',
} as const;

export const tenantSitePageCrudConfig: CrudPageConfig = {
  apiBase: '/TenantSite',
  apiService: tenantSiteService,
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
      layoutGroup: 'ownership',
      layoutOrder: 10,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      required: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: '__tenant',
      detail: false,
      label: '所属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 180,
    },
    {
      key: 'orgId',
      label: '所属组织',
      layoutGroup: 'ownership',
      layoutOrder: 15,
      type: 'org-tree-select',
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
      layoutGroup: 'basic',
      layoutOrder: 10,
      loadOptions: brandOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
    },
    {
      key: 'name',
      label: '站点名称',
      layoutGroup: 'basic',
      layoutOrder: 20,
      required: true,
      search: true,
      table: true,
      width: 150,
    },
    {
      key: 'type',
      label: '站点类型',
      layoutGroup: 'basic',
      layoutOrder: 30,
      search: true,
      table: true,
      width: 140,
    },
    {
      key: 'domain',
      label: '完整域名',
      allowInput: true,
      loadOptions: tenantSiteDnsDomainOptionsLoader,
      placeholder: '可手动输入或选择完整域名',
      required: true,
      layoutGroup: 'basic',
      layoutOrder: 40,
      search: true,
      searchOrder: -100,
      table: true,
      type: 'select',
      width: 220,
    },
    ...siteInfoFormFields,
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
      layoutGroup: 'status',
      layoutOrder: 10,
      table: true,
      type: 'datetime',
      width: 180,
    },
    { key: 'uiExInfo', label: '前端展示扩展信息', layoutGroup: 'extension', layoutOrder: 10, type: 'json' },
    { key: 'exInfo', label: '扩展信息', layoutGroup: 'extension', layoutOrder: 20, type: 'json' },
    { key: 'orderCode', label: '排序代码', layoutGroup: 'status', layoutNewRow: true, layoutOrder: 20, type: 'number' },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'status',
      layoutOrder: 30,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      layoutGroup: 'status',
      layoutOrder: 40,
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
    { key: 'remark', label: '备注', fullRow: true, layoutGroup: 'remark', layoutOrder: 10, type: 'textarea' },
  ],
  formMaxColumns: 3,
  modalWidth: 1000,
  title: '租户站点管理',
  transformSubmit: async (values, record) => {
    const nextValues = transformSiteInfoSubmit(values, record);
    nextValues.domain = String(nextValues.domain || '').trim();

    if (!nextValues.domain) {
      throw new TypeError('请选择完整域名');
    }

    return nextValues;
  },
};
