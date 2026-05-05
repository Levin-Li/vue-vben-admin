import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import {
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

const lifecycleStatusOptions = [
  { label: '待注册', value: 'PendingRegistration' },
  { label: '正常', value: 'Active' },
  { label: '转移中', value: 'PendingTransfer' },
  { label: '已过期', value: 'Expired' },
  { label: '赎回期', value: 'Redemption' },
  { label: '已暂停', value: 'Suspended' },
  { label: '已删除', value: 'Deleted' },
  { label: '未知', value: 'Unknown' },
];

export const domainPageCrudConfig: CrudPageConfig = {
  allowCreate: false,
  apiBase: '/Domain',
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  description: '根域名资产独立维护，解析记录和证书申请都从这里进入。',
  fields: [
    {
      key: 'tenantId',
      label: '所属租户',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
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
      label: '域名ID',
      fixed: 'left',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'name',
      label: '根域名',
      disabledOnEdit: true,
      required: true,
      search: true,
      table: true,
      width: 220,
    },
    {
      key: 'providerName',
      label: '域名供应商',
      disabledOnEdit: true,
      loadOptions: tenantSiteVendorOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 150,
    },
    {
      key: 'domainApplyStatus',
      label: '域名状态',
      form: false,
      options: applyStatusOptions,
      search: true,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'lifecycleStatus',
      label: '生命周期',
      form: false,
      options: lifecycleStatusOptions,
      search: true,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'domainExpiredTime',
      label: '域名到期时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'neverExpires',
      label: '永不过期',
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'autoRenew',
      label: '自动续期',
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'providerDomainId',
      label: '供应商域名ID',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'providerZoneId',
      label: '供应商Zone ID',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'dnsRecords',
      formCreate: false,
      formEdit: false,
      fullRow: true,
      label: 'DNS记录快照',
      type: 'json',
    },
    { key: 'nameservers', label: 'NS服务器', fullRow: true, type: 'json' },
    {
      key: 'exInfo',
      label: '扩展信息',
      fullRow: true,
      type: 'json',
    },
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
  title: '根域名管理',
  transformSubmit: async (values) => {
    const nextValues = { ...values };
    nextValues.name = String(nextValues.name || '')
      .trim()
      .toLowerCase();

    if (!nextValues.name) {
      throw new TypeError('请输入根域名');
    }

    return nextValues;
  },
};
