import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { accessLogService } from '../../api/access-log-service';
import { DEFAULT_CRUD_MODAL_WIDTH, tenantOptionsLoader } from '../api-module';

function formatAccessLogRequestInfo(record: Record<string, any>) {
  const method = String(record.requestMethod || '').trim();
  const uri = String(record.requestUri || '').trim();

  return [method, uri].filter(Boolean).join(' ');
}

function formatAccessLogSourceInfo(record: Record<string, any>) {
  const remoteAddr = String(record.remoteAddr || '').trim();
  const accessRegion = String(record.accessRegion || '').trim();

  return [remoteAddr, accessRegion].filter(Boolean).join('\n');
}

export const pageMeta = {
  name: 'AccessLog',
  title: '访问日志管理',
  description: '查询系统访问日志。',
} as const;

export const accessLogPageCrudConfig: CrudPageConfig = {
  apiBase: '/AccessLog',
  domainObject: true,
  apiService: accessLogService,
  allowCreate: false,
  allowDelete: false,
  allowEdit: false,
  allowRetrieve: true,
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: 'containsRemoteAddr',
      label: '操作IP地址',
      form: false,
      search: true,
    },
    { key: 'containsTitle', label: '标题', form: false, search: true },
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
      label: '日志ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'domain', label: '域名', search: true, table: true, width: 160 },
    { key: 'containsVisitor', label: '访问者', form: false, search: true },
    { key: 'visitor', label: '访问者', table: true, width: 140 },
    { key: 'title', label: '标题', table: true, width: 180 },
    {
      key: 'logType',
      label: '日志类型',
      search: true,
      table: true,
      width: 120,
    },
    {
      key: 'isException',
      label: '是否异常',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    { key: 'containsBizKey', label: '业务主键', form: false, search: true },
    { key: 'bizKey', label: '业务主键', table: true, width: 160 },
    { key: 'containsBizType', label: '业务类型', form: false, search: true },
    { key: 'bizType', label: '业务类型', table: true, width: 140 },
    { key: 'containsRequestUri', label: '请求URI', form: false, search: true },
    {
      key: 'requestUri',
      label: '请求信息',
      table: true,
      tableValue: formatAccessLogRequestInfo,
      width: 320,
    },
    { key: 'requestMethod', label: '请求方法', table: false },
    {
      key: 'responseStatus',
      label: '响应状态码',
      table: true,
      type: 'number',
      width: 120,
    },
    {
      key: 'remoteAddr',
      label: '来源信息',
      table: true,
      tableValue: formatAccessLogSourceInfo,
      width: 180,
    },
    { key: 'accessRegion', label: '访问归属地', form: false, table: false },
    {
      key: 'gteCreateTime',
      label: '访问时间开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteCreateTime',
      label: '访问时间结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'headInfo',
      form: false,
      label: '头部信息',
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'requestParams',
      form: false,
      label: '请求参数',
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'requestBody',
      form: false,
      label: '请求体',
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'responseBody',
      form: false,
      label: '响应体',
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'exceptionInfo',
      form: false,
      label: '异常信息',
      fullRow: true,
      table: false,
      type: 'textarea',
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '访问日志管理',
};
