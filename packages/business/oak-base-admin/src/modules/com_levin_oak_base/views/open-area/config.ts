import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { formatAdministrativeArea } from '@levin/admin-framework/framework-commons/shared/administrative-area-data';

import { openAreaService } from '../../api/open-area-service';
import {
  buildModuleDictOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  tenantOptionsLoader,
} from '../api-module';

export function getOpenAreaDisplayNames(record: Record<string, any>) {
  const areaCodeList = Array.isArray(record.areaCodeList)
    ? record.areaCodeList
    : [];

  if (areaCodeList.length === 0) {
    return ['未限制（全国）'];
  }

  return areaCodeList.map((code) => formatAdministrativeArea(code));
}

export const pageMeta = {
  name: 'OpenArea',
  title: '开通区域',
  description: '维护开通区域配置。',
} as const;

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
    '按租户、组织、域名、业务类别和业务类型维护可选行政区划范围。开通区域代码列表为空时，当前范围不限制可选区域。',
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
      key: 'orgId',
      label: '所属组织',
      layoutGroup: 'ownership',
      layoutOrder: 20,
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
      layoutGroup: 'basic',
      layoutGroupTitle: '开通范围',
      layoutOrder: 10,
      help: '为空时匹配当前租户、组织下的任意域名。',
      search: true,
      table: true,
      width: 220,
    },
    {
      key: 'bizCategory',
      label: '业务类别',
      layoutGroup: 'basic',
      layoutOrder: 20,
      help: '为空时匹配任意业务类别。',
      loadOptions: buildModuleDictOptionsLoader(
        'com.levin.oak.base.entities.OpenArea.bizCategory',
      ),
      search: true,
      table: true,
      type: 'select',
      width: 160,
    },
    {
      key: 'bizType',
      label: '业务类型',
      layoutGroup: 'basic',
      layoutOrder: 30,
      help: '为空时匹配任意业务类型。',
      loadOptions: buildModuleDictOptionsLoader(
        'com.levin.oak.base.entities.OpenArea.bizType',
      ),
      search: true,
      table: true,
      type: 'select',
      width: 160,
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
      layoutGroup: 'business',
      layoutGroupTitle: '状态设置',
      layoutOrder: 10,
      help: '为空表示长期有效。',
      search: true,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'business',
      layoutOrder: 20,
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
      layoutOrder: 30,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    { key: 'orderCode', label: '排序代码', layoutGroup: 'business', layoutOrder: 40, type: 'number' },
    { key: 'exInfo', label: '扩展信息', layoutGroup: 'extension', layoutGroupTitle: '扩展信息', layoutOrder: 10, type: 'json' },
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
    { key: 'remark', label: '备注', fullRow: true, layoutGroup: 'remark', layoutGroupTitle: '备注信息', layoutOrder: 10, type: 'textarea' },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  title: '开通区域',
};
