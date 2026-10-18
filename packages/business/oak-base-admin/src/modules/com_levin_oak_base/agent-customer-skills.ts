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
  agentGenericRequest,
  agentPermission,
  agentReadSkills,
} from './agent-business-common';
import { channelPartnerService } from './api/channel-partner-service';
import { customerService } from './api/customer-service';
import { legalSubjectService } from './api/legal-subject-service';
import { orgService } from './api/org-service';
import { partnerService } from './api/partner-service';
import { supplierPartnerService } from './api/supplier-partner-service';

// 主档与关系只提供运营摘要；身份号码、联系人、账户、开票资料和自由扩展字段不进入模型。
const commonFields = [
  'id',
  'tenantId',
  'orgId',
  'enable',
  'optimisticLock',
  'createTime',
  'lastUpdateTime',
] as const;
const relationFields = [
  ...commonFields,
  'displayName',
  'shortName',
  'type',
  'level',
  'groupName',
  'legalSubjectId',
  'legalSubjectName',
  'certificationStatus',
] as const;
const relationFilters = {
  containsDisplayName: { kind: 'text', maxLength: 128 },
  level: { kind: 'text', maxLength: 64 },
  groupName: { kind: 'text', maxLength: 128 },
  enable: { kind: 'boolean' },
} as const;

type ProfileService = {
  retrieve: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
};

// 仅开放已有专用版本化接口的三个运营字段，不使用生成 CRUD 修改归属或认证状态。
function profileSkill(
  resource: string,
  title: string,
  service: ProfileService,
): AgentSkill {
  const allowed = () =>
    agentPermission(service, 'retrieve') && agentPermission(service, 'update');
  return {
    id: `com.levin.oak.base.${resource}.updateProfile`,
    description: `按用户明确要求修改一条${title}的运营等级 level、分组 groupName 或启用 enable。需要 id，可选 tenantId、orgId。只修改提供的字段，须聊天预览确认。`,
    inputSchema: {
      required: ['id'],
      properties: {
        id: { type: 'string', maxLength: 128 },
        tenantId: { type: 'string', maxLength: 128 },
        orgId: { type: 'string', maxLength: 128 },
        level: { type: 'string', maxLength: 64 },
        groupName: { type: 'string', maxLength: 128 },
        enable: { type: 'boolean' },
      },
    },
    maxRecords: 1,
    permission: `${title}更新权限`,
    available: allowed,
    risk: 'confirm',
    writeIntent: [
      `修改${title}`,
      `更新${title}`,
      `调整${title}`,
      `设置${title}`,
      `启用${title}`,
      `停用${title}`,
    ],
    preview: async (args) => {
      agentExactKeys(args, [
        'id',
        'tenantId',
        'orgId',
        'level',
        'groupName',
        'enable',
      ]);
      if (!allowed()) throw new Error('当前用户无权修改运营资料');
      const id = agentId(args.id, '记录 ID');
      const scope = agentBusinessScope(args);
      const selectedTenant = currentGlobalTenantId.value;
      const selectedOrg = currentGlobalOrgId.value;
      const patch: Record<string, boolean | string> = {};
      for (const field of ['level', 'groupName', 'enable'] as const) {
        if (args[field] === undefined) continue;
        const value = args[field];
        if (field === 'enable') {
          if (typeof value !== 'boolean')
            throw new Error('enable 必须是布尔值');
        } else if (
          typeof value !== 'string' ||
          !value.trim() ||
          value.length > (field === 'level' ? 64 : 128) ||
          [...value].some((character) => (character.codePointAt(0) ?? 32) < 32)
        )
          throw new Error(`${field} 格式不正确`);
        patch[field] = value as boolean | string;
      }
      if (Object.keys(patch).length === 0)
        throw new Error('至少提供一个运营字段');
      const authenticatedUser = useUserStore().userInfo;
      const actorId = authenticatedUser?.id;
      const actorTenantId = authenticatedUser?.tenantId;
      const actorPlatform = isPlatformUser(authenticatedUser);
      const checkAccess = () => {
        const currentUser = useUserStore().userInfo;
        if (
          currentUser?.id !== actorId ||
          currentUser?.tenantId !== actorTenantId ||
          isPlatformUser(currentUser) !== actorPlatform
        )
          throw new Error('当前身份已变化');
        if (!allowed()) throw new Error('当前权限已变化');
        if (
          currentGlobalTenantId.value !== selectedTenant ||
          currentGlobalOrgId.value !== selectedOrg
        )
          throw new Error('当前范围已变化，请重新发起');
      };
      const user = useUserStore().userInfo;
      const actorTenant = isPlatformUser(user) ? undefined : user?.tenantId;
      const item = await service.retrieve(
        agentGenericRequest({ ...scope, id }),
      );
      checkAccess();
      const effectiveTenant = item?.tenantId || actorTenant;
      if (
        !item ||
        item.id !== id ||
        !effectiveTenant ||
        (actorTenant && actorTenant !== effectiveTenant) ||
        !Number.isSafeInteger(item.optimisticLock) ||
        item.optimisticLock < 0 ||
        (scope.tenantId && scope.tenantId !== effectiveTenant) ||
        (scope.orgId && scope.orgId !== item.orgId)
      )
        throw new Error('记录范围或版本信息不正确');
      const original = {
        tenantId: agentId(effectiveTenant, '租户 ID'),
        ...(item.orgId ? { orgId: agentId(item.orgId, '组织 ID') } : {}),
        id,
      };
      const matchesScope = (latest: any) =>
        latest &&
        latest.id === id &&
        (latest.tenantId || actorTenant) === effectiveTenant &&
        latest.orgId === item.orgId;
      const matchesPatch = (latest: any) =>
        matchesScope(latest) &&
        Object.entries(patch).every(
          ([field, value]) => latest[field] === value,
        );
      const description = `${title} (${id})：${Object.entries(patch)
        .map(
          ([field, value]) =>
            `${field}: ${String(item[field] ?? '未设置').slice(0, 128)} → ${String(value)}`,
        )
        .join('；')}`;
      let attempted = false;
      return {
        description,
        source: `${title}详情接口`,
        recheck: async () => {
          checkAccess();
          const latest = await service.retrieve(agentGenericRequest(original));
          checkAccess();
          return matchesPatch(latest);
        },
        execute: async () => {
          checkAccess();
          if (attempted)
            throw new Error('操作已提交，请只读复查结果，不可重复提交');
          const latest = await service.retrieve(agentGenericRequest(original));
          checkAccess();
          if (
            !matchesScope(latest) ||
            latest.optimisticLock !== item.optimisticLock
          )
            throw new Error('记录已变化，请重新发起操作');
          if (matchesPatch(latest)) return '记录已经是目标值，无需重复操作。';
          // 发起后即锁定重试；网络异常可能发生在服务端已经提交之后。
          attempted = true;
          await service.update(
            agentGenericRequest({
              ...original,
              optimisticLock: item.optimisticLock,
              ...patch,
            }),
          );
          checkAccess();
          const verified = await service.retrieve(
            agentGenericRequest(original),
          );
          checkAccess();
          if (!matchesPatch(verified))
            throw new Error('执行结果核验不一致，请只读复查');
          return `${description}，已执行并核验。`;
        },
      };
    },
  };
}

// 每个资源显式绑定其真实服务，合作伙伴基类没有普通更新端点，因此保持只读。
export const customerAgentSkills: readonly AgentSkill[] = [
  ...agentReadSkills({
    resource: 'customer',
    title: '客户',
    service: customerService,
    fields: [
      ...commonFields,
      'legalSubjectId',
      'legalSubjectName',
      'type',
      'channelPartnerId',
      'channelPartnerName',
      'level',
      'groupName',
    ],
    filters: {
      level: { kind: 'text', maxLength: 64 },
      groupName: { kind: 'text', maxLength: 128 },
      type: { kind: 'code' },
      channelPartnerId: { kind: 'id' },
      enable: { kind: 'boolean' },
    },
  }),
  ...agentReadSkills({
    resource: 'partner',
    title: '合作伙伴',
    service: partnerService,
    fields: relationFields,
    filters: relationFilters,
  }),
  ...agentReadSkills({
    resource: 'supplierPartner',
    title: '供应伙伴',
    service: supplierPartnerService,
    fields: relationFields,
    filters: { ...relationFilters, type: { kind: 'code' } },
  }),
  ...agentReadSkills({
    resource: 'channelPartner',
    title: '渠道伙伴',
    service: channelPartnerService,
    fields: relationFields,
    filters: { ...relationFilters, type: { kind: 'code' } },
  }),
  ...agentReadSkills({
    resource: 'legalSubject',
    title: '法律主体',
    service: legalSubjectService,
    fields: [
      ...commonFields,
      'subjectName',
      'shortName',
      'subjectType',
      'certificationStatus',
    ],
    filters: {
      containsSubjectName: { kind: 'text', maxLength: 128 },
      subjectType: { kind: 'code' },
      enable: { kind: 'boolean' },
    },
  }),
  ...agentReadSkills({
    resource: 'org',
    title: '组织',
    service: orgService,
    fields: [
      ...commonFields,
      'name',
      'code',
      'parentId',
      'type',
      'legalSubjectId',
    ],
    filters: {
      containsName: { kind: 'text', maxLength: 128 },
      parentId: { kind: 'id' },
      type: { kind: 'code' },
      enable: { kind: 'boolean' },
    },
  }),
  profileSkill('customer', '客户', customerService),
  profileSkill('supplierPartner', '供应伙伴', supplierPartnerService),
  profileSkill('channelPartner', '渠道伙伴', channelPartnerService),
];
