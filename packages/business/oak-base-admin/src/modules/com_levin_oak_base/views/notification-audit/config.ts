import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { notificationAuditService } from '../../api/notification-audit-service';

export const pageMeta = {
  name: 'NotificationAudit',
  title: '通知投递记录',
  description: '查看安全投递审计并执行独立的未受理核验与重试。',
} as const;

// 普通审计列表交给公共 CRUD；详情时间线和人工处理仍由页面专用流程承载。
export function createNotificationAuditCrudConfig(options: {
  apiService: CrudApiService;
  channelLabel: (value: string) => string;
  initialQuery?: Record<string, unknown>;
  statuses: { label: string; value: string }[];
  statusLabel: (value: string) => string;
}): CrudPageConfig {
  return {
    title: pageMeta.title,
    description: '查询当前授权范围内的通知投递记录。',
    apiBase: '/NotificationAudit',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService: options.apiService,
    queryPermission: buildApiMethodPermissions(
      notificationAuditService,
      'list',
    ),
    dataAttrTargets: {
      list: {
        method: 'GET',
        path: `${OAK_BASE_API_MODULE}/NotificationAudit/list`,
      },
    },
    dataAttrConditionKeys: ['tenantId', 'orgId'],
    defaultQuery: { pageIndex: 1, pageSize: 20 },
    initialQuery: options.initialQuery,
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: false,
    // 独立审计接口没有受控全量导出，不将单页结果冒充完整导出。
    allowExport: false,
    fields: [
      {
        key: 'orgId',
        label: '业务范围',
        type: 'org-tree-select',
        search: true,
        table: false,
        form: false,
        detail: false,
        loadOptions: async () => [],
      },
      {
        key: 'status',
        label: '投递状态',
        type: 'select',
        search: true,
        table: true,
        form: false,
        options: options.statuses,
        tableValue: (record) => options.statusLabel(String(record.status)),
        sortable: false,
        width: 160,
      },
      {
        key: 'id',
        label: '投递标识',
        table: true,
        form: false,
        sortable: false,
        width: 240,
      },
      {
        key: 'channel',
        label: '渠道',
        table: true,
        form: false,
        tableValue: (record) => options.channelLabel(String(record.channel)),
        sortable: false,
        width: 150,
      },
      {
        key: 'attemptCount',
        label: '尝试次数',
        type: 'number',
        table: true,
        form: false,
        sortable: false,
        width: 110,
      },
    ],
  };
}
