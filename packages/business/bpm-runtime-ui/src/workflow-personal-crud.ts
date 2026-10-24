import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import type {
  WorkflowInstanceView,
  WorkflowRuntimePage,
  WorkflowTaskView,
} from './types';

import { workflowStatusLabel } from './workflow-task-form';

type PersonalTab = 'copied' | 'done' | 'started' | 'todo';

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

/** 四分栏契约没有时间和关键词字段；只配置真实返回列和接口支持的游标。 */
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
    title: { todo: '待办', done: '已办', started: '我发起', copied: '抄送' }[
      tab
    ],
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
        label: '关联业务',
        table: true,
        form: false,
        sortable: false,
        width: 240,
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
        : [
            {
              key: 'purposeKey',
              label: '流程用途',
              table: true,
              form: false,
              sortable: false,
              width: 160,
            },
          ]),
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
        key: taskList ? 'processInstanceId' : 'instanceId',
        label: '流程实例',
        table: true,
        form: false,
        sortable: false,
        width: 220,
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
