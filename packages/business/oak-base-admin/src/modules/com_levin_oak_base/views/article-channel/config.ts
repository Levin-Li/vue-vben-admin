import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { articleChannelService } from '../../api/article-channel-service';
import { standardCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import {
  articleChannelOptionsLoader,
  buildEnumOptionsLoader,
  DEFAULT_CRUD_MODAL_WIDTH,
  FILE_STORAGE_MULTI_UPLOAD_PATH,
  FILE_STORAGE_SINGLE_UPLOAD_PATH,
  tenantOptionsLoader,
} from '../api-module';

const articleStatusOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.enums.SimpleFlowStatus',
);
const articleCoverLayoutOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Article$CoverLayout',
);
type FlowActionMethod =
  | 'archived'
  | 'auditApproved'
  | 'auditCommit'
  | 'auditReject'
  | 'offline'
  | 'publish';

function buildFlowAction(methodName: FlowActionMethod) {
  return async (record: Record<string, any>) =>
    articleChannelService[methodName]({
      _operatorAction: record._operatorAction,
      id: record.id,
    });
}

function buildFlowActionPermission(methodName: FlowActionMethod) {
  return buildApiMethodPermissions(articleChannelService, methodName);
}

export const pageMeta = {
  name: 'ArticleChannel',
  title: '文章栏目管理',
  description: '维护文章栏目和分类。',
} as const;

export const articleChannelPageCrudConfig: CrudPageConfig = {
  apiBase: '/ArticleChannel',
  domainObject: true,
  apiService: articleChannelService,
  dataAttrTargets: standardCrudDataAttrTargets(articleChannelService),
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
  // 单独声明详情字段，保留表格、查询和提交配置。
  detailExtraFields: [
    { key: 'orderCode', label: '排序代码', layoutOrder: 905 },
    { key: 'enable', label: '是否启用', layoutOrder: 910, type: 'switch' },
    { key: 'editable', label: '是否可编辑', layoutOrder: 915, type: 'switch' },
    {
      key: 'tenantName',
      label: '租户名称',
      detail: false,
    },
    {
      key: 'ownerId',
      label: '所有者标识',
      detail: false,
    },
    {
      key: 'ownerName',
      label: '拥有者名称',
    },
    {
      key: 'owner',
      label: '所有者',
      detail: false,
    },
    {
      key: 'supportEventsByCurrentStatus',
      label: '当前状态下支持的事件清单',
      detail: false,
    },
    {
      key: 'parent',
      label: '父对象',
      detail: false,
    },
    {
      key: 'children',
      label: '子节点',
      detail: false,
    },
    {
      key: 'nodePath',
      label: '树节点路径',
      detail: false,
    },
    {
      key: 'domainId',
      label: '领域标识',
      detail: false,
    },
    {
      key: 'creator',
      label: '创建者',
      detail: false,
    },
    {
      key: 'optimisticLock',
      label: '乐观锁版本号',
      detail: false,
    },
  ],
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      layoutGroup: 'basic',
      layoutGroupOrder: -10,
      layoutGroupTitle: '基础信息',
      layoutOrder: 5,
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
      label: '栏目ID',
      layoutGroup: 'basic',
      layoutGroupOrder: -10,
      layoutGroupTitle: '基础信息',
      layoutOrder: 10,
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
      layoutGroupTitle: '基础信息',
      layoutGroup: 'basic',
      layoutGroupOrder: -10,
      layoutOrder: 15,
      required: true,
      table: true,
      width: 180,
    },
    {
      key: 'parentId',
      label: '父栏目',
      layoutGroupTitle: '基础信息',
      layoutGroup: 'basic',
      layoutGroupOrder: -10,
      layoutOrder: 20,
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
      form: false,
      label: '发布状态',
      layoutGroup: 'basic',
      layoutGroupOrder: -10,
      layoutGroupTitle: '基础信息',
      layoutOrder: 25,
      loadOptions: articleStatusOptionsLoader,
      required: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'expiredTime',
      label: '到期时间',
      layoutGroupTitle: '基础信息',
      layoutGroup: 'basic',
      layoutGroupOrder: -10,
      layoutOrder: 35,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'icon',
      label: '图标',
      layoutGroup: 'media',
      layoutGroupTitle: '媒体资源',
      layoutOrder: 10,
      layoutNewRow: true,
      table: true,
      type: 'image',
      uploadPath: FILE_STORAGE_SINGLE_UPLOAD_PATH,
      width: 90,
    },
    {
      key: 'coverLayout',
      label: '封面布局',
      layoutGroup: 'basic',
      layoutGroupOrder: -10,
      layoutGroupTitle: '基础信息',
      layoutOrder: 30,
      loadOptions: articleCoverLayoutOptionsLoader,
      type: 'select',
    },
    {
      key: 'coverImgUrls',
      label: '封面图片',
      layoutGroup: 'media',
      layoutGroupTitle: '媒体资源',
      layoutOrder: 30,
      multiple: true,
      type: 'image',
      uploadPath: FILE_STORAGE_MULTI_UPLOAD_PATH,
    },
    {
      key: 'imgUrls',
      label: '图片',
      layoutGroup: 'media',
      layoutGroupTitle: '媒体资源',
      layoutOrder: 40,
      multiple: true,
      type: 'image',
      uploadPath: FILE_STORAGE_MULTI_UPLOAD_PATH,
    },
    {
      key: 'avUrls',
      label: '音视频地址',
      layoutGroup: 'media',
      layoutGroupTitle: '媒体资源',
      layoutOrder: 50,
      layoutNewRow: true,
      span: 2,
      type: 'tags',
    },
    {
      key: 'keywords',
      label: '关键字',
      layoutGroupTitle: '栏目素材',
      layoutGroup: 'media',
      layoutOrder: 60,
      span: 2,
      type: 'tags',
    },
    {
      key: 'summary',
      label: '摘要',
      layoutGroupTitle: '栏目素材',
      fullRow: true,
      layoutGroup: 'media',
      layoutOrder: 70,
      type: 'textarea',
    },
    {
      key: 'readCount',
      label: '阅读数',
      layoutGroup: 'business',
      layoutOrder: 30,
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'likeCount',
      label: '点赞数',
      layoutGroup: 'business',
      layoutOrder: 40,
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'forwardCount',
      label: '转发数',
      layoutGroup: 'business',
      layoutOrder: 50,
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'collectCount',
      label: '收藏数',
      layoutGroup: 'business',
      layoutOrder: 60,
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'shareCount',
      label: '分享数',
      layoutGroup: 'business',
      layoutOrder: 70,
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'commentCount',
      label: '评论数',
      layoutGroup: 'business',
      layoutOrder: 80,
      table: true,
      type: 'number',
      width: 100,
    },
    {
      key: 'remark',
      label: '备注',
      layoutOrder: 900,
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'createTime',
      label: '创建时间',
      layoutOrder: 920,
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      layoutOrder: 925,
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  rowActions: [
    {
      handler: buildFlowAction('auditCommit'),
      flowFormFields: [],
      label: '提交审核',
      permission: buildFlowActionPermission('auditCommit'),
    },
    {
      handler: buildFlowAction('auditReject'),
      flowFormFields: ['_operatorAction'],
      label: '审核拒绝',
      permission: buildFlowActionPermission('auditReject'),
    },
    {
      handler: buildFlowAction('auditApproved'),
      flowFormFields: [],
      label: '审核通过',
      permission: buildFlowActionPermission('auditApproved'),
    },
    {
      handler: buildFlowAction('publish'),
      flowFormFields: [],
      label: '发布',
      permission: buildFlowActionPermission('publish'),
    },
    {
      handler: buildFlowAction('offline'),
      flowFormFields: [],
      label: '下线',
      permission: buildFlowActionPermission('offline'),
    },
    {
      handler: buildFlowAction('archived'),
      flowFormFields: [],
      label: '存档',
      permission: buildFlowActionPermission('archived'),
    },
  ],
  title: '文章栏目管理',
};
