import type { AgentSkill } from '@levin/admin-framework';

import { agentGenericRequest, agentReadSkills } from './agent-business-common';
import { roleService } from './api/role-service';
import { servicePluginService } from './api/service-plugin-service';
import { servicePluginSettingService } from './api/service-plugin-setting-service';
import { tenantService } from './api/tenant-service';
import { userService } from './api/user-service';

// 角色与插件设置只支持租户范围，不向原接口提交并不存在的组织条件。
function tenantParams(args: Record<string, unknown>) {
  const { orgId: _orgId, ...params } = args;
  return agentGenericRequest(params);
}

// 基础配置只提供运行状态和容量摘要，不向模型提供凭证、权限配置或表达式。
export const adminAgentSkills: readonly AgentSkill[] = [
  ...agentReadSkills({
    resource: 'user',
    title: '系统用户状态',
    service: userService,
    fields: [
      'id',
      'nickname',
      'type',
      'category',
      'state',
      'enable',
      'expiredTime',
      'createTime',
    ],
    filters: {
      containsNickname: { kind: 'text', maxLength: 64 },
      type: { kind: 'code', maxLength: 64 },
      category: { kind: 'code' },
      state: { kind: 'code' },
      enable: { kind: 'boolean' },
    },
  }),
  ...agentReadSkills({
    resource: 'role',
    title: '系统角色状态',
    service: roleService,
    fields: ['id', 'code', 'name', 'type', 'enable', 'expiredTime'],
    filters: {
      code: { kind: 'text', maxLength: 64 },
      containsName: { kind: 'text', maxLength: 128 },
      type: { kind: 'code', maxLength: 64 },
      enable: { kind: 'boolean' },
    },
    list: (args) => roleService.list(tenantParams(args)),
    retrieve: (args) => roleService.retrieve(tenantParams(args)),
  }),
  ...agentReadSkills({
    resource: 'tenant',
    title: '租户状态与许可容量',
    service: tenantService,
    scope: false,
    fields: [
      'id',
      'name',
      'code',
      'type',
      'level',
      'enable',
      'expiredTime',
      'licenseCnt',
      'remainingLicenseCnt',
    ],
    filters: {
      containsName: { kind: 'text', maxLength: 128 },
      code: { kind: 'text', maxLength: 64 },
      type: { kind: 'code', maxLength: 64 },
      level: { kind: 'code', maxLength: 64 },
      enable: { kind: 'boolean' },
    },
  }),
  ...agentReadSkills({
    resource: 'servicePlugin',
    title: '服务插件状态',
    service: servicePluginService,
    scope: false,
    fields: [
      'id',
      'name',
      'categoryName',
      'groupName',
      'pluginTypeName',
      'providerSelectionMode',
      'enable',
      'expiredTime',
    ],
    filters: {
      containsName: { kind: 'text', maxLength: 128 },
      categoryName: { kind: 'text', maxLength: 64 },
      groupName: { kind: 'text', maxLength: 64 },
      enable: { kind: 'boolean' },
    },
  }),
  ...agentReadSkills({
    resource: 'servicePluginSetting',
    title: '服务插件供应商设置状态',
    service: servicePluginSettingService,
    fields: [
      'id',
      'servicePluginId',
      'servicePluginProviderCode',
      'servicePluginProviderInstanceCode',
      'usageCount',
      'usageWeight',
      'domain',
      'enable',
    ],
    filters: {
      servicePluginId: { kind: 'id' },
      servicePluginProviderCode: { kind: 'code' },
      servicePluginProviderInstanceCode: { kind: 'code' },
      domain: { kind: 'text', maxLength: 253 },
      enable: { kind: 'boolean' },
    },
    list: (args) => servicePluginSettingService.list(tenantParams(args)),
    retrieve: (args) =>
      servicePluginSettingService.retrieve(tenantParams(args)),
  }),
];
