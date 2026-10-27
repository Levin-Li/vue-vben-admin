import type { AgentSkill } from '@levin/admin-framework';

import { useUserStore } from '@vben/runtime/stores';

import {
  agentExactKeys,
  agentId,
  currentGlobalOrgId,
  currentGlobalTenantId,
} from '@levin/admin-framework';
import { isPlatformUser } from '@levin/admin-framework/framework-commons/shared/user-identity';

import {
  agentBusinessScope,
  agentPermission,
  agentReadSkills,
  projectAgentRecord,
} from './agent-business-common';
import { notificationAuditService } from './api/notification-audit-service';
import { supportMailboxSettingService } from './api/support-mailbox-setting-service';
import { toGenericSupportRequestScope } from './api/support-request-scope';
import { userMessageService } from './api/user-message-service';

// 模型只接收消息元数据和投递状态，不接收消息正文、链接、邮箱、出站凭证引用或人工核验意见。
const messageFields = [
  'id',
  'priority',
  'readTime',
  'sourceId',
  'sourceType',
  'createTime',
];
const auditFields = [
  'id',
  'eventId',
  'channel',
  'status',
  'attemptCount',
  'exhausted',
  'createTime',
  'deliveredTime',
  'lastAttemptTime',
  'nextAttemptTime',
  'optimisticLock',
];
const mailboxFields = [
  'id',
  'tenantId',
  'orgId',
  'enabled',
  'optimisticLock',
  'queueId',
  'inboundChannel',
  'defaultPriority',
];

// 支持邮箱启停是唯一注册的写操作，预览不写入，确认后只允许执行一次。
const mailboxEnabled: AgentSkill = {
  id: 'com.levin.oak.base.supportMailboxSetting.setEnabled',
  description:
    '按用户明确要求启用或停用客服邮箱。参数 id、enabled，可选 tenantId、orgId；先聊天预览确认再执行，不改邮箱、路由或凭证。',
  inputSchema: {
    required: ['id', 'enabled'],
    properties: {
      id: { type: 'string', maxLength: 128 },
      enabled: { type: 'boolean' },
      tenantId: { type: 'string', maxLength: 128 },
      orgId: { type: 'string', maxLength: 128 },
    },
  },
  maxRecords: 1,
  permission: '客服邮箱启停权限',
  writeIntent: ['启用', '停用', '开启', '关闭', 'enable', 'disable'],
  available: () =>
    agentPermission(supportMailboxSettingService, 'retrieve') &&
    (agentPermission(supportMailboxSettingService, 'enable') ||
      agentPermission(supportMailboxSettingService, 'disable')),
  risk: 'confirm',
  preview: async (args) => {
    agentExactKeys(args, ['id', 'enabled', 'tenantId', 'orgId']);
    const id = agentId(args.id, '规则 ID');
    if (typeof args.enabled !== 'boolean')
      throw new Error('enabled 必须是布尔值');
    const target = args.enabled;
    const permitted = () =>
      agentPermission(supportMailboxSettingService, 'retrieve') &&
      agentPermission(
        supportMailboxSettingService,
        target ? 'enable' : 'disable',
      );
    if (!permitted()) throw new Error('当前用户无客服邮箱启停权限');
    const actor = useUserStore().userInfo;
    const actorId = agentId(actor?.id, '当前用户 ID');
    const actorTenant = actor?.tenantId;
    const actorPlatform = isPlatformUser(actor);
    const scope = agentBusinessScope(args);
    // 非平台用户的租户字段由服务端脱敏，可信归属来自当前认证主体而非模型参数。
    const tenantId = agentId(
      scope.tenantId || (actorPlatform ? undefined : actorTenant),
      '租户 ID',
    );
    const orgId = agentId(scope.orgId, '组织 ID');
    const selectedTenant = currentGlobalTenantId.value;
    const selectedOrg = currentGlobalOrgId.value;
    const query = { id, tenantId, orgId };
    const reauthorize = () => {
      const currentActor = useUserStore().userInfo;
      if (
        currentActor?.id !== actorId ||
        currentActor?.tenantId !== actorTenant ||
        isPlatformUser(currentActor) !== actorPlatform
      ) {
        throw new Error('当前身份已变化，请重新发起操作');
      }
      if (!permitted()) throw new Error('当前用户无客服邮箱启停权限');
      if (
        selectedTenant !== currentGlobalTenantId.value ||
        selectedOrg !== currentGlobalOrgId.value
      ) {
        throw new Error('当前范围已变化，请重新发起操作');
      }
    };
    const item = await supportMailboxSettingService.retrieve(query);
    reauthorize();
    const validRecord = (record: typeof item) => {
      const effectiveTenant =
        record?.tenantId || (actorPlatform ? undefined : actorTenant);
      return (
        record?.id === id &&
        effectiveTenant === tenantId &&
        (actorPlatform || actorTenant === effectiveTenant) &&
        record.orgId === orgId &&
        Number.isSafeInteger(record.optimisticLock) &&
        record.optimisticLock >= 0 &&
        typeof record.enabled === 'boolean'
      );
    };
    if (!validRecord(item)) throw new Error('规则范围或版本信息不正确');
    const description = `客服邮箱 ${id}：${item.enabled ? '启用' : '停用'} → ${target ? '启用' : '停用'}`;
    let consumed = false;
    return {
      description,
      source: '客服邮箱详情接口',
      recheck: async () => {
        reauthorize();
        const latest = await supportMailboxSettingService.retrieve(query);
        reauthorize();
        return validRecord(latest) && latest.enabled === target;
      },
      execute: async () => {
        if (consumed) throw new Error('此操作已提交，请只读复查结果');
        reauthorize();
        // 首次确认即消费，异常后不得盲目重发；复查入口只执行读取。
        consumed = true;
        const latest = await supportMailboxSettingService.retrieve(query);
        reauthorize();
        if (
          !validRecord(latest) ||
          latest.optimisticLock !== item.optimisticLock
        )
          throw new Error('规则已变化，请重新发起操作');
        if (latest.enabled === target)
          return '规则已是目标状态，无需重复操作。';
        reauthorize();
        const command = toGenericSupportRequestScope({
          ...query,
          optimisticLock: item.optimisticLock,
        });
        await (target
          ? supportMailboxSettingService.enable(command)
          : supportMailboxSettingService.disable(command));
        const verified = await supportMailboxSettingService.retrieve(query);
        reauthorize();
        if (!validRecord(verified) || verified.enabled !== target)
          throw new Error('执行结果核验不一致，请只读复查');
        return `${description}，已执行并核验。`;
      },
    };
  },
};

// 个人消息严格使用当前会话 /use 接口，不允许提交他人或跨租户身份。
export const messageAgentSkills: readonly AgentSkill[] = [
  ...agentReadSkills({
    resource: 'userMessage',
    title: '我的消息',
    service: userMessageService,
    scope: false,
    fields: messageFields,
    filters: { unreadOnly: { kind: 'boolean' } },
    list: (args) =>
      userMessageService.list({
        pageIndex: args.pageIndex,
        pageSize: args.pageSize,
        unreadOnly: args.unreadOnly ?? false,
      }),
    retrieve: (args) => userMessageService.retrieve(args.id),
  }),
  {
    id: 'com.levin.oak.base.userMessage.unreadCount',
    description: '查询当前登录用户本人的未读消息数，无参数；不改变已读状态。',
    inputSchema: { required: [], properties: {} },
    maxRecords: 1,
    permission: '查询我的未读消息数',
    available: () => agentPermission(userMessageService, 'unreadCount'),
    risk: 'read',
    execute: async (args) => {
      agentExactKeys(args, []);
      if (!agentPermission(userMessageService, 'unreadCount'))
        throw new Error('当前用户无消息读取权限');
      const count = await userMessageService.unreadCount();
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error('未读消息数量无效');
      return {
        count: 1,
        data: { unreadCount: count },
        source: '我的未读消息数量接口',
      };
    },
  },
  ...agentReadSkills({
    resource: 'notificationAudit',
    title: '通知投递审计',
    service: notificationAuditService,
    actions: ['list'],
    fields: auditFields,
    filters: { status: { kind: 'code', maxLength: 32 } },
  }),
  {
    id: 'com.levin.oak.base.notificationAudit.retrieve',
    description:
      '查看一条当前用户有权访问的通知投递状态与有限尝试结果；参数 id，可选 tenantId，不返回正文、链接、核验原因或重试操作。',
    inputSchema: {
      required: ['id'],
      properties: {
        id: { type: 'string', maxLength: 128 },
        tenantId: { type: 'string', maxLength: 128 },
      },
    },
    maxRecords: 20,
    permission: '查看通知投递审计',
    available: () => agentPermission(notificationAuditService, 'retrieve'),
    risk: 'read',
    execute: async (args) => {
      agentExactKeys(args, ['id', 'tenantId']);
      if (!agentPermission(notificationAuditService, 'retrieve'))
        throw new Error('当前用户无通知审计读取权限');
      const scope = agentBusinessScope(args);
      const response = await notificationAuditService.retrieve({
        id: agentId(args.id, '投递 ID'),
        tenantId: scope.tenantId,
      });
      if (!response?.delivery || !Array.isArray(response.attempts))
        throw new Error('通知审计详情格式不正确');
      const attempts = response.attempts
        .slice(0, 19)
        .map((attempt) =>
          projectAgentRecord(attempt, [
            'attemptNo',
            'outcome',
            'startedTime',
            'finishedTime',
          ]),
        );
      return {
        count: attempts.length + 1,
        data: {
          delivery: projectAgentRecord(response.delivery, auditFields),
          attempts,
          attemptsTruncated:
            response.attemptsTruncated === true ||
            response.attempts.length > 19,
        },
        source: '通知投递审计详情接口',
      };
    },
  },
  ...agentReadSkills({
    resource: 'supportMailboxSetting',
    title: '客服邮箱设置',
    service: supportMailboxSettingService,
    fields: mailboxFields,
  }),
  mailboxEnabled,
];
