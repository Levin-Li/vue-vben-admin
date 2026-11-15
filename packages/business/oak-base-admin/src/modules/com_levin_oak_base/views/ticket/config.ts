import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { ticketService } from '../../api/ticket-service';

export const pageMeta = {
  name: 'Ticket',
  title: '客服工单',
  description: '查看工单会话并按授权状态执行分派、处理、回复和解决。',
} as const;

// 工单列表使用公共查询、分页和列工具；状态命令与会话仍由专用页面负责。
export function createTicketCrudConfig(options: {
  apiService: CrudApiService;
  initialQuery?: Record<string, unknown>;
  stateLabel: (value?: string) => string;
  statuses: { label: string; value: string }[];
}): CrudPageConfig {
  return {
    title: pageMeta.title,
    description: '查询授权范围内的客服工单；打开工单后处理会话与状态。',
    apiBase: '/TicketAction',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService: options.apiService,
    queryPermission: buildApiMethodPermissions(ticketService, 'list'),
    dataAttrTargets: {
      list: { method: 'GET', path: `${OAK_BASE_API_MODULE}/TicketAction/list` },
    },
    dataAttrConditionKeys: ['tenantId', 'orgId'],
    defaultQuery: { pageIndex: 1, pageSize: 20 },
    initialQuery: options.initialQuery,
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: false,
    allowExport: false,
    listOperations: [{ key: 'ticket:help', label: '帮助', placement: 'right' }],
    fields: [
      // 归属租户仅向平台人员展示；筛选仍使用经授权的业务范围选择器。
      {
        key: '__tenant',
        label: '归属租户',
        type: 'tenant',
        form: false,
        detail: false,
        table: true,
        visibleForPlatformUser: true,
        sortable: false,
        width: 180,
      },
      {
        key: 'orgId',
        label: '业务范围',
        type: 'org-tree-select',
        search: true,
        table: true,
        tableValue: (record) => record.orgName || record.orgId,
        sortable: false,
        width: 180,
        form: false,
        detail: false,
        loadOptions: async () => [],
      },
      {
        key: 'status',
        label: '工单状态',
        type: 'select',
        search: true,
        table: true,
        form: false,
        options: options.statuses,
        tableValue: (record) => options.stateLabel(String(record.status)),
        sortable: false,
        width: 160,
      },
      {
        key: 'title',
        label: '标题',
        table: true,
        form: false,
        sortable: false,
        width: 260,
      },
      {
        key: 'requesterEmail',
        label: '请求人邮箱',
        table: true,
        form: false,
        sortable: false,
        width: 240,
      },
    ],
  };
}
