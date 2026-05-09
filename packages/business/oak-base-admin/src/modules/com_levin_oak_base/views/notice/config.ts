import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { noticeService } from '../../api/notice-service';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  jobPostOptionsLoader,
  roleOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const noticeContentTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Notice$ContentType',
);
const noticeStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.SimpleFlowStatus',
);
type NoticeActionMethod =
  | 'archived'
  | 'auditApproved'
  | 'auditCommit'
  | 'auditReject'
  | 'offline'
  | 'publish';

function buildNoticeAction(methodName: NoticeActionMethod) {
  return async (record: Record<string, any>) =>
    noticeService[methodName]({
      _operatorAction: record._operatorAction,
      id: record.id,
    });
}

function buildNoticeActionPermission(methodName: NoticeActionMethod) {
  return buildApiMethodPermissions(noticeService, methodName);
}

export const noticePageCrudConfig: CrudPageConfig = {
  apiBase: '/Notice',
  apiService: noticeService,
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
  rowActions: [
    {
      handler: buildNoticeAction('auditCommit'),
      label: '提交审核',
      permission: buildNoticeActionPermission('auditCommit'),
    },
    {
      handler: buildNoticeAction('auditReject'),
      label: '审核拒绝',
      permission: buildNoticeActionPermission('auditReject'),
    },
    {
      handler: buildNoticeAction('auditApproved'),
      label: '审核通过',
      permission: buildNoticeActionPermission('auditApproved'),
    },
    {
      handler: buildNoticeAction('publish'),
      label: '发布',
      permission: buildNoticeActionPermission('publish'),
    },
    {
      handler: buildNoticeAction('offline'),
      label: '下线',
      permission: buildNoticeActionPermission('offline'),
    },
    {
      handler: buildNoticeAction('archived'),
      label: '存档',
      permission: buildNoticeActionPermission('archived'),
    },
  ],
  title: '通知公告管理',
};
