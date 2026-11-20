import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { workflowManagementService } from '../../api/workflow-management-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';

// 管理入口分别登记查询、详情及受控运行命令，不提供引擎维护入口。
export const pageMeta = {
  name: 'WorkflowInstance',
  title: '工作流实例管理',
  description: '按授权业务范围查看流程运行实例、固定版本流程图和实际轨迹。',
} as const;

export const pageOperations = [
  { opName: 'terminate', apiMethods: [workflowRuntimeService.terminate] },
  { opName: 'recover', apiMethods: [workflowRuntimeService.recover] },
  { opName: 'instances', apiMethods: [workflowManagementService.instances] },
  { opName: 'instance', apiMethods: [workflowManagementService.instance] },
];

export const workflowInstanceStatusOptions = [
  { label: '运行中', value: 'Running' },
  { label: '已结束', value: 'Completed' },
  { label: '等待结果交付', value: 'PendingEffects' },
  { label: '已挂起', value: 'Suspended' },
];

const statusLabels: Record<string, string> = {
  Running: '运行中',
  Completed: '已结束',
  Cancelled: '已取消',
  Suspended: '已挂起',
  PendingEffects: '等待结果交付',
  Approved: '通过',
  Rejected: '拒绝',
  Withdrawn: '已撤回',
  Terminated: '已终止',
  Pending: '待处理',
  Applied: '已应用',
  Failed: '处理失败',
};
export const workflowInstanceStatusLabel = (value?: string) =>
  value ? (statusLabels[value] ?? value) : '—';

/** 管理列表直接交给标准CRUD；仅适配真实只读接口和无总数游标分页。 */
export function createWorkflowInstanceCrudConfig(options: {
  apiService: CrudApiService;
  initialDefinitionId?: string;
  loadDefinitions: () => Promise<Array<{ label: string; value: string }>>;
  retainedQuery?: Record<string, unknown>;
  showOrganization: boolean;
}): CrudPageConfig {
  return {
    title: pageMeta.title,
    apiBase: '/workflow-management',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService: options.apiService,
    queryPermission: buildApiMethodPermissions(
      workflowManagementService,
      'instances',
    ),
    dataAttrTargets: {
      list: {
        method: 'GET',
        path: `${OAK_BASE_API_MODULE}/workflow-management/instances`,
      },
    },
    dataAttrConditionKeys: ['tenantId', 'orgId', 'size', 'cursor'],
    recordKey: 'instanceId',
    paginationMode: 'cursor',
    defaultQueryAutoSearch: true,
    defaultQuery: { pageSize: 20 },
    initialQuery: {
      ...options.retainedQuery,
      definitionId:
        options.initialDefinitionId ?? options.retainedQuery?.definitionId,
    },
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: false,
    // 实例接口不提供完整授权总数或全量读取，不能伪装标准全量导出。
    allowExport: false,
    fields: [
      // 接口只返回授权的业务标识，范围筛选允许选择授权租户或组织。
      {
        key: '__tenant',
        label: '归属租户',
        type: 'tenant',
        table: true,
        form: false,
        detail: false,
        sortable: false,
        visibleForPlatformUser: true,
        width: 180,
      },
      {
        key: 'orgId',
        label: '业务组织',
        type: 'org-tree-select',
        search: options.showOrganization,
        table: true,
        form: false,
        detail: false,
        loadOptions: async () => [],
        sortable: false,
        width: 180,
      },
      {
        key: 'keyword',
        label: '关键词',
        placeholder: '流程或业务关键词',
        search: true,
        table: false,
        form: false,
        detail: false,
      },
      {
        key: 'status',
        label: '执行状态',
        type: 'select',
        options: workflowInstanceStatusOptions,
        search: true,
        table: false,
        form: false,
        detail: false,
      },
      {
        key: 'definitionId',
        label: '流程',
        type: 'select',
        placeholder: '全部已浏览流程',
        loadOptions: options.loadDefinitions,
        search: true,
        table: false,
        form: false,
        detail: false,
      },
      {
        key: 'definitionName',
        label: '流程',
        table: true,
        form: false,
        sortable: false,
        width: 220,
      },
      {
        key: 'businessTitle',
        label: '关联业务',
        table: true,
        form: false,
        sortable: false,
        width: 240,
      },
      {
        key: 'executionStatus',
        label: '执行状态',
        table: true,
        form: false,
        sortable: false,
        width: 160,
        tableValue: (record) =>
          workflowInstanceStatusLabel(record.executionStatus || record.status),
      },
      {
        key: 'outcome',
        label: '审批结果',
        table: true,
        form: false,
        sortable: false,
        width: 140,
        tableValue: (record) => workflowInstanceStatusLabel(record.outcome),
      },
      {
        key: 'effectStatus',
        label: '业务交付',
        table: true,
        form: false,
        sortable: false,
        width: 160,
        tableValue: (record) =>
          workflowInstanceStatusLabel(record.effectStatus),
      },
    ],
  };
}
