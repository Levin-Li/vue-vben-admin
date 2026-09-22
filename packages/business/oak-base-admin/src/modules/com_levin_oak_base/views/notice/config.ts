import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { noticeService } from '../../api/notice-service';
import {
  buildDictOptionsLoader,
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  jobPostOptionsLoader,
  orgCategoryOptionsLoader,
  orgTypeOptionsLoader,
  roleOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

// 内容类型是 Notice 的固定展示契约，显式声明后不依赖枚举扫描接口是否已发现内部枚举。
const noticeContentTypeOptionsLoader = async () => [
  { label: '文本', value: 'Text' },
  { label: 'MarkDown', value: 'Markdown' },
  { label: '网页', value: 'Html' },
  { label: 'JsonSchema', value: 'JsonSchema' },
  { label: 'AmisJsonView', value: 'AmisJsonView' },
  { label: '图片', value: 'Pic' },
  { label: '视频', value: 'Video' },
  { label: '音频', value: 'Audio' },
  { label: '文件', value: 'File' },
];
const noticeStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.SimpleFlowStatus',
);
const userTypeOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.User.type',
);
const userCategoryOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.User$Category',
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

export const pageMeta = {
  name: 'Notice',
  title: '通知公告管理',
  description: '维护通知公告。',
} as const;

export const noticePageCrudConfig: CrudPageConfig = {
  apiBase: '/Notice',
  domainObject: true,
  apiService: noticeService,
  defaultFormValues: {
    editable: true,
    enable: true,
    matchCategoryList: [],
    matchAreaList: [],
    matchJobPostCodeList: [],
    matchRoleCodeList: [],
    matchTypeList: [],
    orgCategoryList: [],
    orgTypeList: [],
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
      label: '内部名称',
      layoutGroup: 'basic',
      layoutGroupTitle: '通知信息',
      layoutOrder: 10,
      required: true,
      table: true,
      width: 180,
    },
    // 面向接收用户展示的标题和摘要，与管理端内部名称分开维护。
    {
      key: 'title',
      label: '通知标题',
      layoutGroup: 'basic',
      layoutOrder: 15,
      table: true,
      width: 220,
    },
    {
      key: 'subtitle',
      label: '通知摘要',
      layoutGroup: 'basic',
      layoutOrder: 18,
      fullRow: true,
      type: 'textarea',
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
      layoutGroup: 'basic',
      layoutOrder: 20,
      search: true,
      table: true,
      width: 140,
    },
    {
      key: 'contentType',
      label: '内容类型',
      layoutGroup: 'basic',
      layoutOrder: 30,
      loadOptions: noticeContentTypeOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'level',
      label: '通知级别',
      layoutGroup: 'business',
      layoutGroupTitle: '发布设置',
      layoutOrder: 5,
      loadOptions: buildEnumOptionsLoader(
        'com.levin.oak.base.entities.Notice$Level',
      ),
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'publishTime',
      label: '计划发布时间',
      layoutGroup: 'business',
      layoutOrder: 8,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'expiredTime',
      label: '过期时间',
      layoutGroup: 'business',
      layoutGroupTitle: '发布设置',
      layoutOrder: 10,
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
    {
      key: 'content',
      label: '通知内容',
      layoutGroup: 'basic',
      fullRow: true,
      layoutOrder: 40,
      type: 'textarea',
    },
    {
      key: 'matchAreaList',
      detail: true,
      label: '匹配用户区域',
      help: '可选择省、市或区县；省、市范围会覆盖下属区域，空值不限制用户区域。',
      layoutGroup: 'extension',
      layoutGroupTitle: '投放范围',
      layoutOrder: 5,
      type: 'string-array',
    },
    {
      key: 'matchTypeList',
      detail: true,
      label: '匹配用户类型',
      layoutGroup: 'extension',
      layoutOrder: 8,
      loadOptions: userTypeOptionsLoader,
      multiple: true,
      type: 'select',
    },
    {
      key: 'matchCategoryList',
      detail: true,
      label: '匹配用户类别',
      layoutGroup: 'extension',
      layoutGroupTitle: '投放范围',
      layoutOrder: 10,
      loadOptions: userCategoryOptionsLoader,
      multiple: true,
      type: 'select',
    },
    {
      key: 'orgCategoryList',
      detail: true,
      label: '匹配组织类别',
      layoutGroup: 'extension',
      layoutOrder: 35,
      loadOptions: orgCategoryOptionsLoader,
      multiple: true,
      type: 'select',
    },
    {
      key: 'orgTypeList',
      detail: true,
      label: '匹配组织类型',
      layoutGroup: 'extension',
      layoutOrder: 40,
      loadOptions: orgTypeOptionsLoader,
      multiple: true,
      type: 'select',
    },
    {
      key: 'matchJobPostCodeList',
      detail: true,
      label: '匹配岗位编码',
      layoutGroup: 'extension',
      layoutOrder: 20,
      loadOptions: jobPostOptionsLoader,
      multiple: true,
      remoteSearch: true,
      type: 'select',
    },
    {
      key: 'matchRoleCodeList',
      detail: true,
      label: '匹配角色列表',
      layoutGroup: 'extension',
      layoutOrder: 30,
      loadOptions: roleOptionsLoader,
      multiple: true,
      remoteSearch: true,
      type: 'role-select',
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      layoutOrder: 10,
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
      flowFormFields: [],
      label: '提交审核',
      permission: buildNoticeActionPermission('auditCommit'),
    },
    {
      handler: buildNoticeAction('auditReject'),
      flowFormFields: ['_operatorAction'],
      label: '审核拒绝',
      permission: buildNoticeActionPermission('auditReject'),
    },
    {
      handler: buildNoticeAction('auditApproved'),
      flowFormFields: [],
      label: '审核通过',
      permission: buildNoticeActionPermission('auditApproved'),
    },
    {
      handler: buildNoticeAction('publish'),
      flowFormFields: [],
      label: '发布',
      permission: buildNoticeActionPermission('publish'),
    },
    {
      handler: buildNoticeAction('offline'),
      flowFormFields: [],
      label: '下线',
      permission: buildNoticeActionPermission('offline'),
    },
    {
      handler: buildNoticeAction('archived'),
      flowFormFields: [],
      label: '存档',
      permission: buildNoticeActionPermission('archived'),
    },
  ],
  title: '通知公告管理',
};
