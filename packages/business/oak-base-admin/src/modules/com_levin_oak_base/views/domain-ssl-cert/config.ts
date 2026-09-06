import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { domainSslCertService } from '../../api/domain-ssl-cert-service';
import { tenantOptionsLoader } from '../api-module';

const applyStatusOptions = [
  { label: '未提交', value: 'UnCommit' },
  { label: '申请中', value: 'Applying' },
  { label: '续期中', value: 'Renewing' },
  { label: '申请成功', value: 'Approved' },
  { label: '申请失败', value: 'Failed' },
];

const sslApplyApiOptions = [{ label: '手动配置', value: 'manual://ssl-cert' }];

export const pageMeta = {
  name: 'DomainSslCert',
  title: 'SSL证书管理',
  description: '维护域名 SSL 证书。',
} as const;

export const domainSslCertPageCrudConfig: CrudPageConfig = {
  apiBase: '/DomainSslCert',
  apiService: domainSslCertService,
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
    sslApplyStatus: 'UnCommit',
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  description: '集中维护域名证书申请、手动配置、下载和本地证书文件生成。',
  fields: [
    {
      key: 'tenantId',
      label: '所属租户',
      fullRow: true,
      layoutGroup: 'ownership',
      layoutOrder: 10,
      layoutNewRow: true,
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
      label: '证书ID',
      fixed: 'left',
      form: false,
      table: true,
      width: 180,
    },
    {
      key: 'containsDomain',
      label: '证书域名',
      form: false,
      search: true,
    },
    {
      key: 'domain',
      label: '证书域名',
      fullRow: true,
      layoutGroup: 'basic',
      layoutOrder: 10,
      layoutNewRow: true,
      required: true,
      table: true,
      width: 240,
    },
    {
      key: 'containsRootDomain',
      label: '根域名',
      form: false,
      search: true,
    },
    {
      key: 'rootDomain',
      label: '根域名',
      layoutGroup: 'basic',
      layoutOrder: 20,
      formCreate: false,
      table: true,
      width: 200,
    },
    {
      key: 'sslApplyApi',
      label: 'SSL申请API',
      layoutGroup: 'business',
      layoutOrder: 10,
      formCreate: false,
      options: sslApplyApiOptions,
      table: true,
      width: 220,
    },
    {
      key: 'sslApplyStatus',
      label: '申请状态',
      layoutGroup: 'business',
      layoutOrder: 20,
      formCreate: false,
      options: applyStatusOptions,
      search: true,
      table: true,
      type: 'select',
      width: 130,
    },
    {
      key: 'sslCertExpiredTime',
      label: '证书到期时间',
      layoutGroup: 'business',
      layoutOrder: 30,
      formCreate: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'sslCertChainPem',
      form: false,
      label: '证书链PEM',
      type: 'textarea',
    },
    {
      key: 'sslPrivateKeyPem',
      form: false,
      label: '私钥PEM',
      type: 'textarea',
    },
    {
      key: 'exInfo',
      formCreate: false,
      label: '扩展信息',
      layoutGroup: 'extension',
      layoutOrder: 10,
      type: 'json',
    },
    { key: 'orderCode', formCreate: false, label: '排序代码', layoutGroup: 'business', layoutOrder: 40, type: 'number' },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'business',
      layoutOrder: 50,
      formCreate: false,
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
      formCreate: false,
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
      layoutOrder: 10,
      layoutNewRow: true,
      type: 'textarea',
    },
  ],
  modalWidth: 640,
  title: 'SSL证书管理',
  transformSubmit: async (values) => {
    const nextValues = { ...values };
    nextValues.domain = String(nextValues.domain || '')
      .trim()
      .toLowerCase();
    nextValues.name = nextValues.domain;
    nextValues.editable = true;
    nextValues.enable = true;
    nextValues.orderCode = nextValues.orderCode ?? 100;
    nextValues.sslApplyStatus = nextValues.sslApplyStatus || 'UnCommit';

    if (!nextValues.domain) {
      throw new TypeError('请输入证书域名');
    }

    for (const key of [
      'rootDomain',
      'sslApplyApi',
      'sslApplyToken',
      'exInfo',
    ]) {
      if (!nextValues[key]) {
        Reflect.deleteProperty(nextValues, key);
      }
    }

    return nextValues;
  },
};
