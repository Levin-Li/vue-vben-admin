import type { CrudPageConfig } from '../../shared/types';

import { demoService } from '#/api/com_levin_oak_base/demo';

import { buildApiMethodPermissions } from '../../shared/crud-permissions';
import { DEFAULT_CRUD_MODAL_WIDTH, tenantOptionsLoader } from '../api-module';

export const demoPageCrudConfig: CrudPageConfig = {
  apiBase: '/Demo',
  createPermission: buildApiMethodPermissions(demoService, 'create'),
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  deletePermission: buildApiMethodPermissions(demoService, 'delete'),
  editPermission: buildApiMethodPermissions(demoService, 'update'),
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForSaasUser: true,
    },
    {
      key: '__tenant',
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForSaasUser: true,
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
    { key: 'mobile', label: '手机号码', search: true, table: true, width: 140 },
    { key: 'email', label: '邮箱', search: true, table: true, width: 180 },
    { key: 'url', label: '普通链接', search: true, table: true, width: 200 },
    { key: 'qrCode', label: '二维码' },
    { key: 'location', label: '地理位置', table: true, width: 180 },
    { key: 'areaCode', label: '省市区行政编码', table: true, width: 180 },
    { key: 'timeRange', label: '时间范围' },
    { key: 'treeOrg', label: '树形组织' },
    {
      key: 'imageUrl',
      label: '单张图片',
      table: true,
      type: 'image',
      width: 120,
    },
    {
      key: 'imageUrls',
      label: '图片集',
      fullRow: true,
      multiple: true,
      type: 'image',
    },
    { key: 'fileUrl', label: '文件链接', type: 'file' },
    { key: 'pdfFileUrl', label: 'PDF文件', type: 'file' },
    { key: 'num', label: '数值', type: 'number' },
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
    { key: 'localDate', label: '日期', table: true, type: 'date', width: 160 },
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
    { key: 'localTime', label: '时间', table: true, type: 'time', width: 140 },
    { key: 'htmlData', label: 'HTML', fullRow: true, type: 'html' },
    { key: 'jsonData', label: 'JSON数据', fullRow: true, type: 'json' },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  queryPermission: buildApiMethodPermissions(demoService, 'list'),
  title: '示例管理',
  transformSubmit: (values) => {
    const nextValues = { ...values };

    if (Array.isArray(nextValues.imageUrls)) {
      nextValues.imageUrls = nextValues.imageUrls.join(',');
    }

    return nextValues;
  },
};
