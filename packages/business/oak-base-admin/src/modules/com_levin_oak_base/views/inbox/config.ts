import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';
import { inboxService } from '../../api/inbox-service';

export const pageMeta = { name: 'Inbox', title: '收件箱', description: '查看由邮件中转接收的邮件。' } as const;

export const inboxPageCrudConfig: CrudPageConfig = {
  apiBase: '/Inbox',
  apiService: inboxService,
  defaultQuery: { pageIndex: 1, pageSize: 20 },
  description: '邮件按实际收件地址归属到用户、组织、租户或平台。邮件正文仅在详情中查看。',
  fields: [
    { key: 'id', label: '邮件ID', form: false, table: true, width: 160 },
    { key: '__tenant', detail: false, label: '所属租户', form: false, table: true, type: 'tenant', visibleForPlatformUser: true, width: 160 },
    { key: 'recipientEmail', label: '收件人', search: true, table: true, width: 220 },
    { key: 'fromEmail', label: '发件人', search: true, table: true, width: 220 },
    { key: 'subject', label: '主题', search: true, table: true, width: 280 },
    { key: 'receivedTime', label: '接收时间', search: true, table: true, type: 'datetime', width: 180 },
    { key: 'status', label: '状态', search: true, table: true, type: 'select', width: 120,
      options: [{ label: '已接收', value: 'Received' }, { label: '处理中', value: 'Processing' }, { label: '已处理', value: 'Processed' }, { label: '失败', value: 'Failed' }, { label: '已归档', value: 'Archived' }] },
    { key: 'textContent', label: '文本正文', form: false, table: false, type: 'textarea', fullRow: true },
    { key: 'htmlContent', label: 'HTML 正文', form: false, table: false, type: 'textarea', fullRow: true },
    { key: 'attachmentFileIds', label: '附件', form: false, table: false, type: 'string-array', fullRow: true },
    { key: 'authenticationResult', label: '认证结果', form: false, table: false, type: 'json', fullRow: true },
    { key: 'processError', label: '处理失败摘要', form: false, table: false, type: 'textarea', fullRow: true },
  ],
  modalWidth: 960,
  title: '收件箱',
};
