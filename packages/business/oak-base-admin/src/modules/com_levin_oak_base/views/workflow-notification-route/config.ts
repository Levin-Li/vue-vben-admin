import type { SelectOption } from '@levin/admin-framework';

import type {
  NotificationChannel,
  WorkflowNotificationEventName,
} from '../../api/workflow-notification-route-service';

export const pageMeta = {
  name: 'WorkflowNotificationRoute',
  title: '工作流通知路由',
  description:
    '配置当前授权范围工作流事件的精确个人渠道与三家群机器人逻辑目标。',
} as const;
export const workflowNotificationEvents: {
  label: string;
  value: WorkflowNotificationEventName;
}[] = [
  { label: '任务创建', value: 'TaskCreated' },
  { label: '任务提醒', value: 'TaskReminder' },
  { label: '任务到期', value: 'TaskDeadline' },
  { label: '任务处理完成', value: 'TaskProcessed' },
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
