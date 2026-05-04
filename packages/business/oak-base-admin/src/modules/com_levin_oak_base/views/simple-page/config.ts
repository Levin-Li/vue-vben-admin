import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { simplePageService } from '@levin/oak-base-admin/modules/com_levin_oak_base/api/simple-page';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  DEFAULT_CRUD_MODAL_WIDTH,
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const simplePageCategoryOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.SimplePage.category',
);
const simplePageTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.SimplePage$Type',
);
const simpleStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.SimpleFlowStatus',
);
const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);

type SimplePageActionMethod =
  | 'archived'
  | 'auditApproved'
  | 'auditCommit'
  | 'auditReject'
  | 'offline'
  | 'preview'
  | 'publish';

function buildSimplePageAction(methodName: SimplePageActionMethod) {
  return async (record: Record<string, any>) =>
    simplePageService[methodName]({
      _operatorAction: record._operatorAction,
      id: record.id,
    });
}

function buildSimplePageActionPermission(methodName: SimplePageActionMethod) {
  return buildApiMethodPermissions(simplePageService, methodName);
}

export const simplePagePageCrudConfig: CrudPageConfig = {
  apiBase: '/SimplePage',
  createPermission: buildApiMethodPermissions(simplePageService, 'create'),
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
    status: 'Draft',
    type: 'json',
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  deletePermission: buildApiMethodPermissions(simplePageService, 'delete'),
  editPermission: buildApiMethodPermissions(simplePageService, 'update'),
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
      label: '页面ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'inType',
      label: '页面类型',
      form: false,
      loadOptions: simplePageTypeOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    { key: 'containsName', label: '名称', form: false, search: true },
    { key: 'endsWithDomain', label: '域名', form: false, search: true },
    {
      key: 'confidentialLevel',
      label: '机密等级',
      loadOptions: confidentialLevelOptionsLoader,
      search: true,
      form: false,
      type: 'select',
      valueType: 'number',
    },
    {
      key: 'inCategory',
      label: '分类',
      form: false,
      loadOptions: simplePageCategoryOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    { key: 'containsGroupName', label: '分组名称', form: false, search: true },
    {
      key: 'inStatus',
      label: '状态',
      form: false,
      loadOptions: simpleStatusOptionsLoader,
      multiple: true,
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
    { key: 'name', label: '名称', required: true, table: true, width: 180 },
    {
      key: 'type',
      label: '页面类型',
      loadOptions: simplePageTypeOptionsLoader,
      required: true,
      table: true,
      type: 'select',
      width: 120,
    },
    { key: 'domain', label: '域名', table: true, width: 140 },
    {
      key: 'confidentialLevel',
      label: '机密等级',
      loadOptions: confidentialLevelOptionsLoader,
      table: true,
      type: 'select',
      valueType: 'number',
      width: 120,
    },
    { key: 'icon', label: '图标', type: 'image' },
    {
      key: 'category',
      label: '分类',
      loadOptions: simplePageCategoryOptionsLoader,
      table: true,
      type: 'select',
      width: 140,
    },
    { key: 'groupName', label: '分组名称', table: true, width: 140 },
    {
      key: 'status',
      label: '状态',
      loadOptions: simpleStatusOptionsLoader,
      table: true,
      type: 'select',
      width: 120,
    },
    { key: 'versionName', label: '版本号', table: true, width: 120 },
    { key: 'path', label: '访问路径', table: true, width: 220 },
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
      key: 'requireAuthorizations',
      label: '权限或角色',
      fullRow: true,
      type: 'tags',
    },
    { key: 'content', label: '内容', fullRow: true, type: 'textarea' },
    { key: 'setting', label: '设置', fullRow: true, type: 'json' },
    { key: 'auditRemark', label: '审核说明', fullRow: true, type: 'textarea' },
    { key: 'orderCode', label: '排序代码', type: 'number' },
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
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  queryPermission: buildApiMethodPermissions(simplePageService, 'list'),
  rowActions: [
    {
      action: 'link',
      handler: buildSimplePageAction('preview'),
      label: '预览',
      permission: buildSimplePageActionPermission('preview'),
      reloadAfterAction: false,
      successMessage: false,
      visibleOn: "(status == 'Draft' || status == 'AuditRejected')",
    },
    {
      handler: buildSimplePageAction('auditCommit'),
      label: '提交审核',
      permission: buildSimplePageActionPermission('auditCommit'),
    },
    {
      handler: buildSimplePageAction('auditReject'),
      label: '审核拒绝',
      permission: buildSimplePageActionPermission('auditReject'),
    },
    {
      handler: buildSimplePageAction('auditApproved'),
      label: '审核通过',
      permission: buildSimplePageActionPermission('auditApproved'),
    },
    {
      handler: buildSimplePageAction('publish'),
      label: '发布',
      permission: buildSimplePageActionPermission('publish'),
    },
    {
      handler: buildSimplePageAction('offline'),
      label: '下线',
      permission: buildSimplePageActionPermission('offline'),
    },
    {
      handler: buildSimplePageAction('archived'),
      label: '存档',
      permission: buildSimplePageActionPermission('archived'),
    },
  ],
  title: '简单页面管理',
};
