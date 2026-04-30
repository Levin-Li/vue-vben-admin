import type { CrudPageConfig } from '../../shared/types';

import {
  buildEnumOptionsLoader,
  buildModulePermission,
  DEFAULT_CRUD_MODAL_WIDTH,
  jobPostOptionsLoader,
  modulePost,
  roleOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const noticeContentTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Notice$ContentType',
);
const noticeStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.SimpleFlowStatus',
);
const noticePermissionType = '业务数据-通知';

function buildNoticeAction(path: string) {
  return async (record: Record<string, any>) =>
    modulePost(path, {}, {
      params: { _operatorAction: record._operatorAction, id: record.id },
    });
}

export const noticePageCrudConfig: CrudPageConfig = {
  apiBase: '/Notice',
  defaultFormValues: {
    editable: true,
    enable: true,
    matchCategoryList: [],
    matchJobPostCodeList: [],
    matchRoleCodeList: [],
    orderCode: 100,
  },
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
      label: '通知ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'containsName',
      label: '名称',
      form: false,
      search: true,
    },
    {
      key: 'name',
      label: '名称',
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'status',
      label: '发布状态',
      form: false,
      loadOptions: noticeStatusOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'category',
      label: '通知类别',
      search: true,
      table: true,
      width: 140,
    },
    {
      key: 'contentType',
      label: '内容类型',
      loadOptions: noticeContentTypeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'expiredTime',
      label: '过期时间',
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
    {
      key: 'content',
      label: '通知内容',
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'matchCategoryList',
      label: '匹配用户类别',
      fullRow: true,
      type: 'tags',
    },
    {
      key: 'matchJobPostCodeList',
      label: '匹配岗位编码',
      fullRow: true,
      loadOptions: jobPostOptionsLoader,
      multiple: true,
      remoteSearch: true,
      type: 'select',
    },
    {
      key: 'matchRoleCodeList',
      label: '匹配角色列表',
      fullRow: true,
      loadOptions: roleOptionsLoader,
      multiple: true,
      remoteSearch: true,
      type: 'role-select',
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
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
  permissionResourceName: '通知',
  permissionTypePrefix: '业务数据-',
  queryPermission: buildModulePermission(
    '通用数据-通知',
    '查询列表',
    '/Notice/list',
  ),
  rowActions: [
    {
      handler: buildNoticeAction('/Notice/auditCommit'),
      label: '提交审核',
      permission: buildModulePermission(
        noticePermissionType,
        '提交审核',
        '/Notice/auditCommit',
      ),
    },
    {
      handler: buildNoticeAction('/Notice/auditReject'),
      label: '审核拒绝',
      permission: buildModulePermission(
        noticePermissionType,
        '审核拒绝',
        '/Notice/auditReject',
      ),
    },
    {
      handler: buildNoticeAction('/Notice/auditApproved'),
      label: '审核通过',
      permission: buildModulePermission(
        noticePermissionType,
        '审核通过',
        '/Notice/auditApproved',
      ),
    },
    {
      handler: buildNoticeAction('/Notice/publish'),
      label: '发布',
      permission: buildModulePermission(
        noticePermissionType,
        '发布上线',
        '/Notice/publish',
      ),
    },
    {
      handler: buildNoticeAction('/Notice/offline'),
      label: '下线',
      permission: buildModulePermission(
        noticePermissionType,
        '下架',
        '/Notice/offline',
      ),
    },
    {
      handler: buildNoticeAction('/Notice/archived'),
      label: '存档',
      permission: buildModulePermission(
        noticePermissionType,
        '存档',
        '/Notice/archived',
      ),
    },
  ],
  title: '通知公告管理',
};
