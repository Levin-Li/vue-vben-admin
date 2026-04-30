import type { CrudPageConfig } from '../../shared/types';

import {
  brandOptionsLoader,
  getTenantSiteVendorDomainRenewBeforeDays,
  modulePostCrudAction,
  tenantOptionsLoader,
  tenantSiteVendorOptionsLoader,
} from '../api-module';

const applyStatusOptions = [
  { label: '未提交', value: 'UnCommit' },
  { label: '申请中', value: 'Applying' },
  { label: '续期中', value: 'Renewing' },
  { label: '申请成功', value: 'Approved' },
  { label: '申请失败', value: 'Failed' },
];

function extractDomainSuffix(domain?: string) {
  const normalizedDomain = String(domain || '')
    .trim()
    .replace(/\.+$/, '');
  const parts = normalizedDomain.split('.').filter(Boolean);

  if (parts.length < 2) {
    return '';
  }

  return `.${parts.slice(-2).join('.')}`;
}

function parseDateTimeValue(value: unknown) {
  if (!value) {
    return Number.NaN;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const normalized = String(value).trim().replace(' ', 'T');
  return new Date(normalized).getTime();
}

function getRenewBeforeMs(days?: number) {
  const normalizedDays = Number(days);
  return (Number.isFinite(normalizedDays) && normalizedDays >= 0
    ? normalizedDays
    : 30) * 24 * 60 * 60 * 1000;
}

function isDomainRenewDue(record: Record<string, any>) {
  const expiredAt = parseDateTimeValue(record?.domainExpiredTime);

  if (Number.isNaN(expiredAt)) {
    return false;
  }

  return (
    expiredAt <=
    Date.now() +
      getRenewBeforeMs(
        getTenantSiteVendorDomainRenewBeforeDays(record?.domainVendor),
      )
  );
}

function canRenewDomain(record: Record<string, any>) {
  return Boolean(
    record?.id &&
      record?.domainExpiredTime &&
      record.domainApplyStatus !== 'Applying' &&
      record.domainApplyStatus !== 'Renewing' &&
      isDomainRenewDue(record),
  );
}

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
    '租户站点的新增/编辑仅维护自有域名；供应商域名通过独立申请入口创建，并提供重新申请、解析、续期与状态同步操作。',
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
      search: true,
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
      key: 'domainVendor',
      formCreate: false,
      formEdit: true,
      label: '域名供应商',
      loadOptions: tenantSiteVendorOptionsLoader,
      table: true,
      type: 'select',
      width: 150,
    },
    {
      key: 'domainSuffix',
      formCreate: false,
      formEdit: true,
      label: '域名后缀',
      table: true,
      type: 'select',
      width: 160,
    },
    {
      key: 'domain',
      label: '完整域名',
      required: true,
      search: true,
      table: true,
      width: 220,
    },
    {
      key: 'inDomainApplyStatus',
      label: '域名申请状态',
      form: false,
      multiple: true,
      options: applyStatusOptions,
      search: true,
      type: 'select',
    },
    {
      key: 'domainApplyStatus',
      label: '域名状态',
      form: false,
      options: applyStatusOptions,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'inDomainSslCertApplyStatus',
      label: 'SSL 状态',
      form: false,
      multiple: true,
      options: applyStatusOptions,
      search: true,
      type: 'select',
    },
    {
      key: 'domainSslCertApplyStatus',
      label: 'SSL 状态',
      form: false,
      options: applyStatusOptions,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'domainDnsRecords',
      formCreate: false,
      formEdit: false,
      label: 'DNS 记录快照',
      fullRow: true,
      type: 'json',
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
    {
      key: 'gteDomainExpiredTime',
      label: '域名到期开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteDomainExpiredTime',
      label: '域名到期结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'domainExpiredTime',
      label: '域名到期时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    { key: 'domainApplyToken', label: '域名申请Token', form: false },
    { key: 'domainApplyApi', label: '域名申请Api地址', form: false },
    {
      key: 'domainSslCertApplyApi',
      label: '域名SSL证书申请Api地址',
      form: false,
    },
    {
      key: 'domainSslCertApplyToken',
      label: '域名SSL证书申请Token',
      form: false,
    },
    {
      key: 'domainSslCertFileSavePath',
      label: '域名SSL证书保存路径',
      form: false,
    },
    {
      key: 'domainSslCert',
      label: '域名SSL证书',
      form: false,
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'domainSslCertKey',
      label: '域名SSL证书密钥',
      form: false,
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'gteDomainSslCertExpiredTime',
      label: 'SSL证书到期开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteDomainSslCertExpiredTime',
      label: 'SSL证书到期结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'domainSslCertExpiredTime',
      label: 'SSL证书到期时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
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
  modalWidth: 1200,
  transformSubmit: async (values, editingRecord) => {
    const nextValues = { ...values };
    const providerManaged = Boolean(editingRecord?.domainVendor);

    if (providerManaged) {
      delete nextValues.domain;
      delete nextValues.domainVendor;
      delete nextValues.domainSuffix;
      delete nextValues.domainApplyApi;
      return nextValues;
    }

    const domain = String(nextValues.domain || '').trim();

    if (!domain) {
      throw new TypeError('请输入完整域名');
    }

    nextValues.domain = domain;
    nextValues.domainSuffix =
      extractDomainSuffix(domain) ||
      nextValues.domainSuffix ||
      editingRecord?.domainSuffix;
    nextValues.domainVendor = undefined;
    nextValues.domainApplyApi = undefined;

    return nextValues;
  },
  rowActions: [
    {
      handler: async (record) => {
        await modulePostCrudAction(`/TenantSite/${record.id}/syncStatus`);
      },
      label: '同步状态',
      permission: ['/TenantSite/*/syncStatus', '/TenantSite/{id}/syncStatus'],
    },
    {
      confirmText: '确认续期当前域名吗？',
      handler: async (record) => {
        await modulePostCrudAction(`/TenantSite/${record.id}/renewDomain`);
      },
      label: '续期域名',
      permission: ['/TenantSite/*/renewDomain', '/TenantSite/{id}/renewDomain'],
      visible: canRenewDomain,
    },
  ],
  title: '租户站点管理',
};
