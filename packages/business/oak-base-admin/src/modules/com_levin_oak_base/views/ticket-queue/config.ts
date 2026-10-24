import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { ticketQueueService } from '../../api/ticket-queue-service';

export const pageMeta = {
  name: 'TicketQueue',
  title: '工单受理队列',
  description: '维护授权组织的工单受理队列与处理人范围。',
} as const;

// 专用保存与启停接口分别声明权限；公共 CRUD 只接管列表能力。
export const pageOperations = [
  { opName: 'list', apiMethods: [ticketQueueService.list] },
  { opName: 'retrieve', apiMethods: [ticketQueueService.retrieve] },
  { opName: 'save', apiMethods: [ticketQueueService.save] },
  { opName: 'setEnabled', apiMethods: [ticketQueueService.setEnabled] },
];

export function createTicketQueueCrudConfig(options: {
  apiService: CrudApiService;
  initialQuery?: Record<string, unknown>;
}): CrudPageConfig {
  return {
    title: pageMeta.title,
    description: pageMeta.description,
    apiBase: '/TicketQueueAction',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService: options.apiService,
    queryPermission: buildApiMethodPermissions(ticketQueueService, 'list'),
    dataAttrTargets: {
      list: {
        method: 'GET',
        path: `${OAK_BASE_API_MODULE}/TicketQueueAction/list`,
      },
    },
    dataAttrConditionKeys: ['tenantId', 'orgId'],
    defaultQuery: { pageIndex: 1, pageSize: 20 },
    initialQuery: options.initialQuery,
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: false,
    // 专用接口未声明全量导出，不能将当前分页伪装成完整结果。
    allowExport: false,
    listOperations: [
      { key: 'queue:create', label: '新建队列', placement: 'left' },
    ],
    fields: [
      {
        key: 'orgId',
        label: '受理组织',
        type: 'org-tree-select',
        search: true,
        table: false,
        form: false,
        detail: false,
        loadOptions: async () => [],
      },
      {
        key: 'code',
        label: '队列编码',
        search: true,
        table: true,
        form: false,
        sortable: false,
        width: 180,
      },
      {
        key: 'name',
        label: '队列名称',
        table: true,
        form: false,
        sortable: false,
        width: 220,
      },
      {
        key: 'enabled',
        label: '是否受理',
        type: 'switch',
        table: true,
        form: false,
        sortable: false,
        width: 120,
        tableValue: (record) => (record.enabled ? '受理中' : '已停用'),
      },
    ],
  };
}
