import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { inboxService } from '../../api/inbox-service';
import { fixedCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';

export const pageMeta = {
  name: 'Inbox',
  title: '收件箱',
  description: '查看本地 SMTP 与邮件中转收到的邮件，并处理私有原文和工单受理。',
} as const;

const parseStatusOptions = [
  { label: '已解析', value: 'Parsed' },
  { label: '解析失败', value: 'Failed' },
];

const statusOptions = [
  { label: '已接收', value: 'Received' },
  { label: '处理中', value: 'Processing' },
  { label: '已处理', value: 'Processed' },
  { label: '失败', value: 'Failed' },
  { label: '已归档', value: 'Archived' },
];

export const inboxPageCrudConfig: CrudPageConfig = {
  apiBase: '/Inbox',
  apiService: inboxService,
  dataAttrTargets: fixedCrudDataAttrTargets(inboxService, {
    list: { method: 'GET', path: 'list' },
    retrieve: { method: 'GET', path: 'retrieve' },
  }),
  allowCreate: false,
  allowDelete: false,
  allowEdit: false,
  allowRetrieve: true,
  defaultQuery: { pageIndex: 1, pageSize: 20 },
  description: '邮件按实际收件地址归属；正文、原文和附件仅在授权详情中查看。',
  detailPermission: buildApiMethodPermissions(inboxService, 'retrieve'),
  fields: [
    {
      key: 'orgId',
      label: '受理组织',
      type: 'org-tree-select',
      search: true,
      table: false,
      form: false,
      detail: false,
    },
    { key: 'id', label: '邮件ID', form: false, table: true, width: 160 },
    {
      key: '__tenant',
      detail: false,
      label: '所属租户',
      form: false,
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 160,
    },
    {
      key: 'subject',
      label: '主题',
      form: false,
      search: true,
      table: true,
      width: 280,
    },
    {
      key: 'fromEmail',
      label: '发件人',
      form: false,
      search: true,
      table: true,
      width: 220,
    },
    {
      key: 'recipientEmail',
      label: '收件人',
      form: false,
      search: true,
      table: true,
      width: 220,
    },
    {
      key: 'inboundChannel',
      label: '入站通道',
      form: false,
      search: true,
      table: true,
      type: 'select',
      options: [
        { label: '本地 SMTP', value: 'LocalSmtp' },
        { label: 'Forward Email 中转', value: 'ForwardEmail' },
      ],
      width: 140,
    },
    {
      key: 'receivedTime',
      label: '接收时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'parseStatus',
      label: '解析状态',
      form: false,
      search: true,
      table: true,
      type: 'select',
      options: parseStatusOptions,
      width: 120,
    },
    {
      key: 'status',
      label: '处理状态',
      form: false,
      search: true,
      table: true,
      type: 'select',
      options: statusOptions,
      width: 120,
    },
    // 私有正文和会话证据只进入授权详情，不参与列表导出。
    {
      key: 'messageIdHeader',
      label: 'Message-ID',
      export: false,
      form: false,
      table: false,
    },
    {
      key: 'inReplyToHeader',
      label: 'In-Reply-To',
      export: false,
      form: false,
      table: false,
    },
    {
      key: 'referencesHeader',
      label: 'References',
      export: false,
      form: false,
      table: false,
    },
    {
      key: 'textContent',
      label: '文本正文',
      export: false,
      form: false,
      table: false,
      type: 'textarea',
      fullRow: true,
    },
    {
      key: 'htmlContent',
      label: 'HTML 源文本',
      export: false,
      form: false,
      table: false,
      type: 'textarea',
      fullRow: true,
    },
    {
      key: 'authenticationResult',
      label: '认证结果',
      export: false,
      form: false,
      table: false,
      type: 'json',
      fullRow: true,
    },
    {
      key: 'processError',
      label: '处理失败摘要',
      export: false,
      form: false,
      table: false,
      type: 'textarea',
      fullRow: true,
    },
  ],
  modalWidth: 960,
  queryPermission: buildApiMethodPermissions(inboxService, 'list'),
  retrieveLabel: '邮件详情',
  title: '收件箱',
};
