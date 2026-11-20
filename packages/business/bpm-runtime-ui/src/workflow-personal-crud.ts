import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import type {
  WorkflowInstanceView,
  WorkflowRuntimePage,
  WorkflowTaskView,
} from './types';

import { workflowStatusLabel } from './workflow-task-form';

type PersonalTab = 'copied' | 'done' | 'started' | 'todo';

/** 把服务端实际时间转换为当前浏览器的本地时间，不推断缺失时间。 */
function displayRelevantTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** 操作槽接收通用记录；只在必需DTO标识完整时进入专用办理逻辑。 */
export function isPersonalWorkflowTask(
  value: unknown,
): value is WorkflowTaskView {
  return (
    typeof value === 'object' &&
    value !== null &&
    'taskId' in value &&
    typeof value.taskId === 'string' &&
    value.taskId.trim().length > 0
  );
}
export function isPersonalWorkflowInstance(
  value: unknown,
): value is WorkflowInstanceView {
  return (
    typeof value === 'object' &&
    value !== null &&
    'instanceId' in value &&
    typeof value.instanceId === 'string' &&
    value.instanceId.trim().length > 0 &&
    'status' in value &&
    typeof value.status === 'string'
  );
}

/** 每栏只展示服务端实际返回的业务信息与当前范围内的流程事实。 */
export function createPersonalWorkflowCrudConfig(
  tab: PersonalTab,
  load: (query: {
    cursor?: string;
    size: number;
  }) => Promise<WorkflowRuntimePage<WorkflowInstanceView | WorkflowTaskView>>,
  options?: { path: string; permissions?: string[] },
): CrudPageConfig {
  const taskList = tab === 'todo' || tab === 'done';
  return {
    title: {
      todo: '待我处理',
      done: '我已处理',
      started: '我发起的',
      copied: '抄送我的',
    }[tab],
    apiBase:
      options?.path ?? `/com.levin.oak.base/V1/api/workflow-runtime/${tab}`,
    dataAttrTargets: {
      list: {
        method: 'GET',
        path:
          options?.path ?? `/com.levin.oak.base/V1/api/workflow-runtime/${tab}`,
      },
    },
    queryPermission: options?.permissions ?? [],
    // 公共CRUD用tableName（而非name）隔离同一路由的列偏好。
    listTables: [
      {
        key: `personal-${tab}`,
        name: `personal-${tab}`,
        tableName: `personal-${tab}`,
      },
    ],
    recordKey: taskList ? 'taskId' : 'instanceId',
    paginationMode: 'cursor',
    defaultQuery: { pageSize: 20 },
    apiService: {
      list: (params = {}) => load({ cursor: params.cursor, size: 20 }),
    },
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: false,
    allowExport: false,
    fields: [
      {
        key: 'businessTitle',
        label: '业务事项',
        table: true,
        form: false,
        sortable: false,
        width: 240,
      },
      {
        key: 'definitionName',
        label: '流程',
        table: true,
        form: false,
        sortable: false,
        width: 160,
      },
      {
        key: 'initiatorName',
        label: '发起人',
        table: true,
        form: false,
        sortable: false,
        width: 120,
      },
      ...(taskList
        ? [
            {
              key: 'taskName',
              label: '办理环节',
              table: true,
              form: false,
              sortable: false,
              width: 180,
            },
          ]
        : []),
      {
        key: taskList ? 'status' : 'executionStatus',
        label: taskList ? '任务状态' : '执行状态',
        table: true,
        form: false,
        sortable: false,
        width: 140,
        tableValue: (record) =>
          taskList && record.status === 'Completed'
            ? '已处理'
            : workflowStatusLabel(
                taskList
                  ? record.status
                  : record.executionStatus || record.status,
              ),
      },
      {
        key: 'relevantTime',
        label: {
          todo: '到达时间',
          done: '处理时间',
          started: '发起时间',
          copied: '抄送时间',
        }[tab],
        table: true,
        form: false,
        sortable: false,
        width: 170,
        tableValue: (record) => displayRelevantTime(record.relevantTime),
      },
      ...(taskList
        ? []
        : [
            {
              key: 'outcome',
              label: '审批结果',
              table: true,
              form: false,
              sortable: false,
              width: 140,
              tableValue: (record: Record<string, any>) =>
                workflowStatusLabel(record.outcome),
            },
            {
              key: 'effectStatus',
              label: '业务处理',
              table: true,
              form: false,
              sortable: false,
              width: 140,
              tableValue: (record: Record<string, any>) =>
                workflowStatusLabel(record.effectStatus),
            },
            {
              key: 'lastError',
              label: '处理异常',
              table: true,
              form: false,
              sortable: false,
              width: 220,
            },
          ]),
    ],
  };
}
