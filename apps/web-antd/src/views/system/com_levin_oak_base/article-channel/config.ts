import type { CrudPageConfig } from '../../shared/types';

import {
  articleChannelOptionsLoader,
  buildEnumOptionsLoader,
  buildModulePermission,
  DEFAULT_CRUD_MODAL_WIDTH,
  FILE_STORAGE_MULTI_UPLOAD_PATH,
  FILE_STORAGE_SINGLE_UPLOAD_PATH,
  modulePost,
  tenantOptionsLoader,
} from '../api-module';

const articleStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.SimpleFlowStatus',
);
const articleCoverLayoutOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Article$CoverLayout',
);
const articleChannelPermissionType = '业务数据-资讯栏目';

function buildArticleChannelAction(path: string) {
  return async (record: Record<string, any>) =>
    modulePost(path, {}, {
      params: { _operatorAction: record._operatorAction, id: record.id },
    });
}

export const articleChannelPageCrudConfig: CrudPageConfig = {
  apiBase: '/ArticleChannel',
  defaultFormValues: {
    collectCount: 0,
    commentCount: 0,
    coverImgUrls: [],
    editable: true,
    enable: true,
    forwardCount: 0,
    imgUrls: [],
    likeCount: 0,
    orderCode: 100,
    readCount: 0,
    shareCount: 0,
    status: 'Draft',
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
      label: '栏目ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'name',
      label: '名称',
      required: true,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'pinyinName',
      label: '拼音名',
      table: true,
      width: 160,
    },
    {
      key: 'parentId',
      label: '父栏目',
      loadOptions: articleChannelOptionsLoader,
      remoteSearch: true,
      search: true,
      table: true,
      type: 'select',
      width: 180,
    },
    {
      key: 'inStatus',
      label: '发布状态',
      form: false,
      loadOptions: articleStatusOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'status',
      label: '发布状态',
      loadOptions: articleStatusOptionsLoader,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'expiredTime',
      label: '到期时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'icon',
      label: '图标',
      table: true,
      type: 'image',
      uploadPath: FILE_STORAGE_SINGLE_UPLOAD_PATH,
      width: 90,
    },
    {
      key: 'coverLayout',
      label: '封面布局',
      loadOptions: articleCoverLayoutOptionsLoader,
      type: 'select',
    },
    {
      key: 'coverImgUrls',
      label: '封面图片',
      fullRow: true,
      multiple: true,
      type: 'image',
      uploadPath: FILE_STORAGE_MULTI_UPLOAD_PATH,
    },
    {
      key: 'imgUrls',
      label: '图片',
      fullRow: true,
      multiple: true,
      type: 'image',
      uploadPath: FILE_STORAGE_MULTI_UPLOAD_PATH,
    },
    {
      key: 'avUrls',
      label: '音视频地址',
      fullRow: true,
      type: 'tags',
    },
    {
      key: 'keywords',
      label: '关键字',
      fullRow: true,
      type: 'tags',
    },
    {
      key: 'summary',
      label: '摘要',
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'readCount',
      label: '阅读数',
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'likeCount',
      label: '点赞数',
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'forwardCount',
      label: '转发数',
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'collectCount',
      label: '收藏数',
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'shareCount',
      label: '分享数',
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'commentCount',
      label: '评论数',
      table: true,
      type: 'number',
      width: 100,
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
  permissionResourceName: '资讯栏目',
  permissionTypePrefix: '业务数据-',
  rowActions: [
    {
      handler: buildArticleChannelAction('/ArticleChannel/auditCommit'),
      label: '提交审核',
      permission: buildModulePermission(
        articleChannelPermissionType,
        '提交审核',
        '/ArticleChannel/auditCommit',
      ),
    },
    {
      handler: buildArticleChannelAction('/ArticleChannel/auditReject'),
      label: '审核拒绝',
      permission: buildModulePermission(
        articleChannelPermissionType,
        '审核拒绝',
        '/ArticleChannel/auditReject',
      ),
    },
    {
      handler: buildArticleChannelAction('/ArticleChannel/auditApproved'),
      label: '审核通过',
      permission: buildModulePermission(
        articleChannelPermissionType,
        '审核通过',
        '/ArticleChannel/auditApproved',
      ),
    },
    {
      handler: buildArticleChannelAction('/ArticleChannel/publish'),
      label: '发布',
      permission: buildModulePermission(
        articleChannelPermissionType,
        '发布上线',
        '/ArticleChannel/publish',
      ),
    },
    {
      handler: buildArticleChannelAction('/ArticleChannel/offline'),
      label: '下线',
      permission: buildModulePermission(
        articleChannelPermissionType,
        '下架',
        '/ArticleChannel/offline',
      ),
    },
    {
      handler: buildArticleChannelAction('/ArticleChannel/archived'),
      label: '存档',
      permission: buildModulePermission(
        articleChannelPermissionType,
        '存档',
        '/ArticleChannel/archived',
      ),
    },
  ],
  title: '文章栏目管理',
};
