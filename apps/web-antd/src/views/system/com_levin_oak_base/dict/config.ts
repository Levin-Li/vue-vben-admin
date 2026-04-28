import type { CrudPageConfig } from '../../shared/types';

import { dictService } from '#/api/com_levin_oak_base/dict';

import { buildApiMethodPermissions } from '../../shared/crud-permissions';
import { tenantOptionsLoader } from '../api-module';

export const dictTitle = '数据字典管理';

export const dictTypeOptions = [
  { label: '系统', value: 'System' },
  { label: '自定义', value: 'Custom' },
];

export const dictPageCrudConfig: CrudPageConfig = {
  apiBase: '/Dict',
  createPermission: buildApiMethodPermissions(dictService, 'create'),
  defaultFormValues: {
    editable: true,
    enable: true,
    itemList: [],
    orderCode: 100,
    type: 'Custom',
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  deletePermission: buildApiMethodPermissions(dictService, 'delete'),
  editPermission: buildApiMethodPermissions(dictService, 'update'),
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
      label: '字典ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'containsName', label: '字典名称', form: false, search: true },
    { key: 'code', label: '字典编码', form: false, search: true },
    {
      key: 'inType',
      label: '字典类型',
      form: false,
      multiple: true,
      options: dictTypeOptions,
      search: true,
      type: 'select',
    },
    {
      key: 'gteCreateTime',
      label: '创建时间开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteCreateTime',
      label: '创建时间结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'name',
      label: '字典名称',
      required: true,
      table: true,
      width: 160,
    },
    {
      key: 'code',
      label: '字典编码',
      disabledOnEdit: true,
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'type',
      label: '字典类型',
      options: dictTypeOptions,
      required: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'itemList',
      label: '字典项',
      fullRow: true,
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
  modalWidth: 672,
  queryPermission: buildApiMethodPermissions(dictService, 'list'),
  title: dictTitle,
};
