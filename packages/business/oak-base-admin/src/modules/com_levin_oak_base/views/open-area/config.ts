import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { formatAdministrativeArea } from '@levin/admin-framework/framework-commons/shared/administrative-area-data';

import { openAreaService } from '../../api/open-area-service';
import { DEFAULT_CRUD_MODAL_WIDTH, tenantOptionsLoader } from '../api-module';

export function getOpenAreaDisplayNames(record: Record<string, any>) {
  const areaCodeList = Array.isArray(record.areaCodeList)
    ? record.areaCodeList
    : [];

  if (areaCodeList.length === 0) {
    return ['未限制（全国）'];
  }

  return areaCodeList.map((code) => formatAdministrativeArea(code));
}

export const openAreaPageCrudConfig: CrudPageConfig = {
  apiBase: '/OpenArea',
  apiService: openAreaService,
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
    '按租户、组织和域名维护可选行政区划范围。开通区域代码列表为空时，当前范围不限制可选区域。',
  fields: [
    {
      key: 'tenantId',
      label: '所属租户',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: '__tenant',
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
      search: true,
      type: 'org-tree-select',
    },
    {
      key: 'id',
      label: '配置ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'domain',
      label: '域名',
      help: '为空时匹配当前租户、组织下的任意域名。',
      search: true,
      table: true,
      width: 220,
    },
    {
      key: 'areaCodeList',
      cellTooltip: true,
      form: false,
      label: '已开通区域',
      table: true,
      tableMaxWidth: 360,
      tableValue: getOpenAreaDisplayNames,
      type: 'tags',
      width: 280,
    },
    {
      key: 'expiredTime',
      label: '到期时间',
      help: '为空表示长期有效。',
      search: true,
      table: true,
      type: 'datetime',
      width: 180,
    },
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
    { key: 'orderCode', label: '排序代码', type: 'number' },
    { key: 'exInfo', label: '扩展信息', type: 'json' },
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
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '开通区域',
};
