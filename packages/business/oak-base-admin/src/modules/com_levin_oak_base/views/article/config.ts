import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { articleService } from '../../api/article-service';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  articleChannelOptionsLoader,
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  FILE_STORAGE_MULTI_UPLOAD_PATH,
  tenantOptionsLoader,
} from '../api-module';

const articleStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.SimpleFlowStatus',
);
const articleContentTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Article$ContentType',
);
const articleCoverLayoutOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Article$CoverLayout',
);
const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
type ArticleActionMethod =
  | 'archived'
  | 'auditApproved'
  | 'auditCommit'
  | 'auditReject'
  | 'offline'
  | 'publish';

function buildArticleAction(methodName: ArticleActionMethod) {
  return async (record: Record<string, any>) =>
    articleService[methodName]({
      _operatorAction: record._operatorAction,
      id: record.id,
    });
}

function buildArticleActionPermission(methodName: ArticleActionMethod) {
  return buildApiMethodPermissions(articleService, methodName);
}

export const articlePageCrudConfig: CrudPageConfig = {
  apiBase: '/Article',
  apiService: articleService,
  defaultFormValues: {
    collectCount: 0,
    commentCount: 0,
    coverImgUrls: [],
    editable: true,
    enable: true,
    forwardCount: 0,
    likeCount: 0,
    orderCode: 100,
    readCount: 0,
    shareCount: 0,
    status: 'Draft',
    tagList: [],
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
      label: '文章ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'containsTitle',
      label: '标题',
      form: false,
      search: true,
    },
    {
      key: 'title',
      label: '标题',
      required: true,
      table: true,
      width: 220,
    },
    {
      key: 'containsAuthor',
      label: '作者',
      form: false,
      search: true,
    },
    {
      key: 'author',
      label: '作者',
      table: true,
      width: 140,
    },
    {
      key: 'channelId',
      label: '栏目',
      loadOptions: articleChannelOptionsLoader,
      remoteSearch: true,
      search: true,
      table: true,
      type: 'select',
      width: 180,
    },
    {
      key: 'category',
      label: '资讯类别',
      search: true,
      table: true,
      width: 140,
    },
    {
      key: 'source',
      label: '转载来源',
      search: true,
      table: true,
      width: 160,
    },
    {
      key: 'contentType',
      label: '内容类型',
      loadOptions: articleContentTypeOptionsLoader,
      table: true,
      type: 'select',
      width: 140,
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
      key: 'confidentialLevel',
      label: '机密等级',
      loadOptions: confidentialLevelOptionsLoader,
      type: 'select',
      valueType: 'number',
    },
    {
      key: 'bizObjId',
      label: '业务对象ID',
      table: true,
      width: 180,
    },
    {
      key: 'coverLayout',
      label: '封面布局',
      loadOptions: articleCoverLayoutOptionsLoader,
      type: 'select',
    },
    {
      key: 'coverImgUrls',
      label: '封面图',
      fullRow: true,
      multiple: true,
      table: true,
      type: 'image',
      uploadPath: FILE_STORAGE_MULTI_UPLOAD_PATH,
      width: 120,
    },
    {
      key: 'keywords',
      label: '关键字',
      fullRow: true,
      type: 'tags',
    },
    {
      key: 'tagList',
      label: '标签列表',
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
  rowActions: [
    {
      handler: buildArticleAction('auditCommit'),
      label: '提交审核',
      permission: buildArticleActionPermission('auditCommit'),
    },
    {
      handler: buildArticleAction('auditReject'),
      label: '审核拒绝',
      permission: buildArticleActionPermission('auditReject'),
    },
    {
      handler: buildArticleAction('auditApproved'),
      label: '审核通过',
      permission: buildArticleActionPermission('auditApproved'),
    },
    {
      handler: buildArticleAction('publish'),
      label: '发布',
      permission: buildArticleActionPermission('publish'),
    },
    {
      handler: buildArticleAction('offline'),
      label: '下线',
      permission: buildArticleActionPermission('offline'),
    },
    {
      handler: buildArticleAction('archived'),
      label: '存档',
      permission: buildArticleActionPermission('archived'),
    },
  ],
  title: '文章管理',
};
