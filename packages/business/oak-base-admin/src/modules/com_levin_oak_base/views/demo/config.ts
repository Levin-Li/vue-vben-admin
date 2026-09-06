import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { demoService } from '../../api/demo-service';

import { DEFAULT_CRUD_MODAL_WIDTH, tenantOptionsLoader } from '../api-module';

export const pageMeta = {
  name: 'Demo',
  title: '示例管理',
  description: '维护示例业务数据。',
} as const;

export const demoPageCrudConfig: CrudPageConfig = {
  apiBase: '/Demo',
  apiService: demoService,
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
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
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 180,
    },
    {
      key: 'id',
      label: '示例ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'mobile', label: '手机号码', layoutGroup: 'basic', layoutGroupTitle: '基础信息', layoutOrder: 10, search: true, table: true, width: 140 },
    { key: 'email', label: '邮箱', layoutGroup: 'basic', layoutOrder: 20, search: true, table: true, width: 180 },
    { key: 'url', label: '普通链接', layoutGroup: 'basic', layoutOrder: 30, search: true, table: true, width: 200 },
    { key: 'qrCode', label: '二维码', layoutGroup: 'basic', layoutOrder: 40 },
    { key: 'location', label: '地理位置', layoutGroup: 'basic', layoutOrder: 50, table: true, width: 180 },
    {
      key: 'areaCode',
      label: '省市区行政编码',
      layoutGroup: 'basic',
      layoutOrder: 60,
      areaCascader: {
        selectableLevels: ['district'],
        valueKey: 'areaCode',
      },
      table: true,
      type: 'area-cascader',
      width: 180,
    },
    { key: 'timeRange', label: '时间范围', layoutGroup: 'basic', layoutOrder: 70 },
    { key: 'treeOrg', label: '树形组织', layoutGroup: 'basic', layoutOrder: 80 },
    {
      key: 'imageUrl',
      label: '单张图片',
      layoutGroup: 'media',
      layoutGroupTitle: '媒体资源',
      layoutOrder: 10,
      layoutNewRow: true,
      table: true,
      type: 'image',
      width: 120,
    },
    {
      key: 'imageUrls',
      label: '图片集',
      layoutGroup: 'media',
      layoutOrder: 20,
      multiple: true,
      type: 'image',
    },
    {
      key: 'fileUrl',
      label: '文件链接',
      layoutGroup: 'media',
      layoutOrder: 30,
      type: 'file',
    },
    {
      key: 'pdfFileUrl',
      label: 'PDF文件',
      layoutGroup: 'media',
      layoutOrder: 40,
      type: 'file',
    },
    { key: 'num', label: '数值', layoutGroup: 'business', layoutGroupTitle: '时间与数值', layoutOrder: 10, type: 'number' },
    {
      key: 'gteLocalDateTime',
      label: '时间日期开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteLocalDateTime',
      label: '时间日期结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'localDateTime',
      label: '时间日期',
      layoutGroup: 'business',
      layoutOrder: 20,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'gteLocalDate',
      label: '日期开始',
      form: false,
      search: true,
      type: 'date',
    },
    {
      key: 'lteLocalDate',
      label: '日期结束',
      form: false,
      search: true,
      type: 'date',
    },
    { key: 'localDate', label: '日期', layoutGroup: 'business', layoutOrder: 30, table: true, type: 'date', width: 160 },
    {
      key: 'gteLocalTime',
      label: '时间开始',
      form: false,
      search: true,
      type: 'time',
    },
    {
      key: 'lteLocalTime',
      label: '时间结束',
      form: false,
      search: true,
      type: 'time',
    },
    { key: 'localTime', label: '时间', layoutGroup: 'business', layoutOrder: 40, table: true, type: 'time', width: 140 },
    { key: 'jsonData', label: 'JSON数据', layoutGroup: 'extension', layoutGroupTitle: '扩展内容', layoutOrder: 10, type: 'json' },
    { key: 'htmlData', label: 'HTML', fullRow: true, layoutGroup: 'content', layoutGroupTitle: '内容信息', layoutOrder: 10, type: 'html' },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '示例管理',
  transformSubmit: (values) => {
    const nextValues = { ...values };

    if (Array.isArray(nextValues.imageUrls)) {
      nextValues.imageUrls = nextValues.imageUrls.join(',');
    }

    return nextValues;
  },
};
