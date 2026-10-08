import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  toWorkflowNotificationRouteInput,
  WorkflowNotificationRouteService,
} from '../api/workflow-notification-route-service';
import {
  normalizeNotificationChannels,
  validRobotConfigRef,
  workflowNotificationEvents,
} from '../views/workflow-notification-route/config';

vi.mock('@vben/runtime/stores', () => ({
  useUserStore: () => ({ userInfo: { platformUser: true } }),
}));

const calls = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@levin/admin-framework', () => ({
  CRUD: { Op: () => () => {}, ListTable: () => () => {} },
  RequestService: class {
    deleteRequest = calls.remove;
    get = calls.get;
    post = calls.post;
    put = calls.put;
  },
  ResAuthorize: () => () => {},
  Service: () => () => {},
  requestClient: {},
}));
const base = {
  tenantId: 'tenant-1',
  orgId: 'org-1',
  eventName: 'TaskCreated' as const,
  channel: 'Station' as const,
  priority: 100,
  forceOverride: false,
  enable: true,
  targetConfig: {},
};
describe('三家机器人通知渠道合同', () => {
  beforeEach(() => vi.clearAllMocks());
  it('精确消费后端三家枚举，不补造渠道或接受URL选项', () => {
    expect(
      normalizeNotificationChannels([
        { label: '飞书 Webhook', value: 'FeishuWebhook' },
        { label: '企业微信 Webhook', value: 'WeComWebhook' },
        { label: '钉钉 Webhook', value: 'DingTalkWebhook' },
        { label: '外部URL', value: 'https://evil.example' },
      ]),
    ).toEqual([
      { label: '飞书 Webhook', value: 'FeishuWebhook' },
      { label: '企业微信 Webhook', value: 'WeComWebhook' },
      { label: '钉钉 Webhook', value: 'DingTalkWebhook' },
    ]);
    expect(normalizeNotificationChannels([])).toEqual([]);
  });
  it.each(['FeishuWebhook', 'WeComWebhook', 'DingTalkWebhook'] as const)(
    '%s只保存原逻辑引用，丢弃URL和秘密字段',
    async (channel) => {
      const input = {
        ...base,
        channel,
        targetConfig: {
          configRef: 'tenant:tenant-1:ops',
          url: 'https://hidden.example',
          secret: 'not-a-real-secret',
          recipientList: ['external@example.com'],
        },
      };
      await new WorkflowNotificationRouteService().create(input);
      expect(calls.post).toHaveBeenCalledWith('create', {
        data: {
          ...base,
          processKey: undefined,
          workflowDefinitionVersionId: undefined,
          nodeKey: undefined,
          remark: undefined,
          matchCondition: undefined,
          channel,
          targetConfig: { configRef: 'tenant:tenant-1:ops' },
          editable: true,
        },
      });
    },
  );
  it.each(['Email', 'Station'] as const)(
    '%s不提供路由配置扩张精确用户受众',
    (channel) => {
      expect(
        toWorkflowNotificationRouteInput({
          ...base,
          channel,
          targetConfig: {
            configRef: 'tenant:tenant-1:ignored',
            recipientList: ['external@example.com'],
          },
        } as Parameters<typeof toWorkflowNotificationRouteInput>[0])
          .targetConfig,
      ).toEqual({});
    },
  );
  it('逻辑前缀不改写，拒绝跨租户、URL和空作用域', () => {
    expect(validRobotConfigRef('tenant:tenant-1:ops', 'tenant-1')).toBe(true);
    expect(validRobotConfigRef('tenant:tenant-2:ops', 'tenant-1')).toBe(false);
    expect(validRobotConfigRef('https://robot.example', 'tenant-1')).toBe(
      false,
    );
    expect(validRobotConfigRef('tenant:tenant-1:ops')).toBe(false);
    expect(validRobotConfigRef('platform:ops')).toBe(true);
    expect(validRobotConfigRef('platform:ops', 'tenant-1')).toBe(false);
    expect(
      validRobotConfigRef(
        `tenant:${'t'.repeat(64)}:${'n'.repeat(64)}`,
        't'.repeat(64),
      ),
    ).toBe(false);
    expect(validRobotConfigRef('tenant:tenant-1:_ops', 'tenant-1')).toBe(false);
  });
  it('工作流事件使用当前实际后端名称，更新绑定读到的版本', async () => {
    expect(workflowNotificationEvents.map((item) => item.value)).toEqual([
      'TaskCreated',
      'TaskReminder',
      'TaskDeadline',
      'TaskProcessed',
    ]);
    await new WorkflowNotificationRouteService().update({
      ...base,
      id: 'route-1',
      optimisticLock: 8,
    });
    expect(calls.put).toHaveBeenCalledWith('update', {
      data: {
        ...toWorkflowNotificationRouteInput(base),
        id: 'route-1',
        optimisticLock: 8,
      },
      autoForceUpdateField: false,
    });
  });
});
