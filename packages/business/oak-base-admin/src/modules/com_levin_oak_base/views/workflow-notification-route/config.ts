import type { SelectOption } from '@levin/admin-framework';
import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import type {
  NotificationChannel,
  WorkflowNotificationEventName,
} from '../../api/workflow-notification-route-service';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { workflowNotificationRouteService } from '../../api/workflow-notification-route-service';

export const pageMeta = {
  name: 'WorkflowNotificationRoute',
  title: '工作流通知路由',
  description:
    '配置当前授权范围工作流事件的精确个人渠道与三家群机器人逻辑目标。',
} as const;
// 页面操作逐一关联实际服务方法，专用表单不新增权限语义。
export const pageOperations = [
  { opName: 'list', apiMethods: [workflowNotificationRouteService.list] },
  { opName: 'create', apiMethods: [workflowNotificationRouteService.create] },
  {
    opName: 'retrieve',
    apiMethods: [workflowNotificationRouteService.retrieve],
  },
  { opName: 'update', apiMethods: [workflowNotificationRouteService.update] },
  { opName: 'remove', apiMethods: [workflowNotificationRouteService.remove] },
];

export const workflowNotificationEvents: {
  label: string;
  value: WorkflowNotificationEventName;
}[] = [
  { label: '任务创建', value: 'TaskCreated' },
  { label: '任务提醒', value: 'TaskReminder' },
  { label: '任务到期', value: 'TaskDeadline' },
  { label: '任务完成', value: 'TaskProcessed' },
];
export const robotWebhookChannels: readonly NotificationChannel[] = [
  'FeishuWebhook',
  'WeComWebhook',
  'DingTalkWebhook',
];
const supportedChannels = new Set<NotificationChannel>([
  'Email',
  'Station',
  ...robotWebhookChannels,
]);
/** 选项来自服务端枚举，浏览器不补造渠道或存储Webhook地址。 */
export function normalizeNotificationChannels(
  options: SelectOption[],
): { label: string; value: NotificationChannel }[] {
  return options.flatMap((item) =>
    typeof item.value === 'string' &&
    supportedChannels.has(item.value as NotificationChannel)
      ? [{ label: item.label, value: item.value as NotificationChannel }]
      : [],
  );
}
export function validRobotConfigRef(value: string, tenantId?: string) {
  if (value.length > 128 || (tenantId && tenantId.length > 64)) return false;
  const prefix = tenantId ? `tenant:${tenantId}:` : 'platform:';
  return (
    value.startsWith(prefix) &&
    /^[A-Z0-9][\w.-]{0,63}$/i.test(value.slice(prefix.length))
  );
}

/** 列表复用公共查询和工具栏，复杂路由编辑继续使用专用表单。 */
export function createWorkflowNotificationRouteCrudConfig(options: {
  apiService: CrudApiService;
  initialQuery?: Record<string, unknown>;
  loadChannels: () => Promise<SelectOption[]>;
}): CrudPageConfig {
  return {
    title: pageMeta.title,
    description:
      '为工作流事件配置通知渠道；新增时选择事件和渠道，机器人渠道需填写已部署的逻辑目标。',
    apiBase: '/WorkflowNotificationRoute',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService: options.apiService,
    queryPermission: buildApiMethodPermissions(
      workflowNotificationRouteService,
      'list',
    ),
    dataAttrTargets: {
      list: {
        method: 'GET',
        path: `${OAK_BASE_API_MODULE}/WorkflowNotificationRoute/list`,
      },
    },
    dataAttrConditionKeys: ['tenantId', 'orgId'],
    defaultQuery: { pageIndex: 1, pageSize: 20 },
    initialQuery: options.initialQuery,
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: false,
    // 导出接口未提供全量受控读取，避免将单页数据误作完整导出。
    allowExport: false,
    listOperations: [
      { key: 'notification:create', label: '新增通知路由', placement: 'left' },
    ],
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
        key: 'eventName',
        label: '流程事件',
        type: 'select',
        search: true,
        table: true,
        form: false,
        options: workflowNotificationEvents,
        sortable: false,
        width: 150,
      },
      {
        key: 'channel',
        label: '通知渠道',
        type: 'select',
        search: true,
        table: true,
        form: false,
        loadOptions: options.loadChannels,
        sortable: false,
        width: 170,
      },
      {
        key: 'processKey',
        label: '流程标识',
        table: true,
        form: false,
        sortable: false,
        width: 200,
      },
      {
        key: 'nodeKey',
        label: '节点标识',
        table: true,
        form: false,
        sortable: false,
        width: 160,
      },
      {
        key: 'priority',
        label: '优先级',
        type: 'number',
        table: true,
        form: false,
        sortable: false,
        width: 100,
      },
      {
        key: 'enable',
        label: '是否启用',
        table: true,
        form: false,
        sortable: false,
        width: 110,
        tableValue: (record) => (record.enable ? '已启用' : '已停用'),
      },
    ],
  };
}
