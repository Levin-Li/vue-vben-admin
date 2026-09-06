import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { domainService } from '../../api/domain-service';
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

export const pageMeta = {
  name: 'Domain',
  title: '根域名管理',
  description: '维护根域名和关联配置。',
} as const;

export const domainPageCrudConfig: CrudPageConfig = {
  apiBase: '/Domain',
  apiService: domainService,
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
      layoutGroup: 'ownership',
      layoutGroupTitle: '归属信息',
      layoutOrder: 10,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
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
      key: 'id',
      label: '域名ID',
      fixed: 'left',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'containsName',
      label: '根域名',
      form: false,
      search: true,
    },
    {
      key: 'name',
      label: '根域名',
      layoutGroup: 'basic',
      layoutGroupTitle: '域名信息',
      layoutOrder: 10,
      disabledOnEdit: true,
      required: true,
      table: true,
      width: 220,
    },
    // 精确匹配例外：该字段由有限供应商选项选择，查询值必须等于选项编码对应的完整名称。
    {
      key: 'providerName',
      label: '域名供应商',
      layoutGroup: 'basic',
      layoutOrder: 20,
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
      layoutGroup: 'business',
      layoutGroupTitle: '生命周期设置',
      layoutOrder: 10,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'neverExpires',
      label: '永不过期',
      layoutGroup: 'business',
      layoutOrder: 20,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'autoRenew',
      label: '自动续期',
      layoutGroup: 'business',
      layoutOrder: 30,
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
    { key: 'nameservers', label: 'NS服务器', layoutGroup: 'extension', layoutGroupTitle: '解析与扩展信息', layoutOrder: 10, type: 'json' },
    {
      key: 'exInfo',
      label: '扩展信息',
      layoutGroup: 'extension',
      layoutOrder: 20,
      type: 'json',
    },
    { key: 'orderCode', label: '排序代码', layoutGroup: 'business', layoutOrder: 40, type: 'number' },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'business',
      layoutOrder: 50,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      layoutGroup: 'business',
      layoutOrder: 60,
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
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutGroup: 'remark',
      layoutGroupTitle: '备注信息',
      layoutOrder: 10,
      layoutNewRow: true,
      type: 'textarea',
    },
  ],
  modalWidth: 1200,
  title: '根域名管理',
  transformSubmit: async (values, editingRecord) => {
    const nextValues = { ...values };

    if (editingRecord) {
      delete nextValues.name;
      return nextValues;
    }

    nextValues.name = String(nextValues.name || '')
      .trim()
      .toLowerCase();

    if (!nextValues.name) {
      throw new TypeError('请输入根域名');
    }

    return nextValues;
  },
};
