import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { collectUserRoleIdentityValues } from '@levin/admin-framework/framework-commons/shared/user-identity';

import { robotNotifyGroupService } from '../../api/robot-notify-group-service';
import {
  buildModuleEnumOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const platformOptionsLoader = buildModuleEnumOptionsLoader(
  'com.levin.oak.base.entities.RobotNotifyGroup$PlatformType',
);

/** 与后端 Webhook 字段的 DataMasking 角色保持一致，组织共享不授予凭据权限。 */
export function canManageRobotWebhook(userInfo: unknown) {
  if (!userInfo || typeof userInfo !== 'object') return false;
  const roles = collectUserRoleIdentityValues(
    userInfo as Record<string, unknown>,
  );
  return (
    roles.has('R_ADMIN') ||
    [...roles].some((role) => role.startsWith('R_PLATFORM_'))
  );
}

export const pageMeta = {
  name: 'RobotNotifyGroup',
  title: '机器人通知群',
  description: '按租户、组织和业务类型维护飞书、企微及钉钉群机器人配置。',
} as const;

export const robotNotifyGroupPageCrudConfig: CrudPageConfig = {
  apiBase: '/RobotNotifyGroup',
  apiService: robotNotifyGroupService,
  domainObject: true,
  defaultFormValues: {
    editable: true,
    enable: true,
    orgShared: false,
  },
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  description:
    '同一租户、组织和业务类型只配置一个通知群；精确配置优先，公共配置作为发送回退。',
  fields: [
    {
      key: 'tenantId',
      label: '所属租户',
      layoutGroup: 'scope',
      layoutGroupTitle: '归属与覆盖范围',
      layoutOrder: 10,
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForPlatformUser: true,
    },
    {
      key: '__tenant',
      detail: false,
      fixed: 'left',
      form: false,
      label: '所属租户',
      table: true,
      type: 'tenant',
      visibleForPlatformUser: true,
      width: 160,
    },
    {
      key: 'orgId',
      label: '所属组织',
      layoutGroup: 'scope',
      layoutOrder: 20,
      search: true,
      table: true,
      type: 'org-tree-select',
      width: 160,
    },
    {
      key: 'id',
      fixed: 'left',
      form: false,
      label: '通知群 ID',
      table: false,
    },
    // 查询 DTO 仅提供精确 name/bizType 条件，页面不能假造 containsName 参数。
    {
      key: 'name',
      label: '名称',
      layoutGroup: 'basic',
      layoutGroupTitle: '通知群配置',
      layoutOrder: 10,
      maxLength: 128,
      required: true,
      search: true,
      table: true,
      width: 190,
    },
    {
      key: 'bizType',
      label: '业务类型',
      layoutGroup: 'basic',
      layoutOrder: 20,
      maxLength: 384,
      required: true,
      search: true,
      table: true,
      width: 190,
    },
    {
      key: 'inPlatformType',
      form: false,
      label: '平台类型',
      loadOptions: platformOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'platformType',
      help: '待配置记录可暂不选择；启用前须选择机器人平台。',
      label: '平台类型',
      layoutGroup: 'basic',
      layoutOrder: 30,
      loadOptions: platformOptionsLoader,
      required: false,
      table: true,
      type: 'select',
      width: 135,
    },
    {
      key: 'description',
      fullRow: true,
      label: '描述',
      layoutGroup: 'basic',
      layoutOrder: 40,
      maxLength: 1024,
      table: false,
      type: 'textarea',
    },
    {
      key: 'webhookUrl',
      detail: false,
      export: false,
      fullRow: true,
      help: '待配置记录可暂为空；启用前必须填写。地址包含发送凭据，仅平台或租户管理员可编辑，列表和详情不展示完整地址。',
      label: 'Webhook 地址',
      layoutGroup: 'basic',
      layoutOrder: 50,
      maxLength: 768,
      required: false,
      search: false,
      table: false,
      type: 'password',
    },
    {
      key: 'orgShared',
      label: '组织共享',
      layoutGroup: 'scope',
      layoutOrder: 30,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    {
      key: 'enable',
      label: '是否启用',
      layoutGroup: 'scope',
      layoutOrder: 40,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
  ],
  modalWidth: 720,
  title: '机器人通知群',
  transformSubmit: (values, editingRecord) => {
    const next = { ...values };
    next.name = String(next.name ?? '').trim();
    next.bizType = String(next.bizType ?? '').trim();
    if (!next.name || !next.bizType) {
      throw new TypeError('请填写名称和业务类型');
    }
    if ('webhookUrl' in next) {
      next.webhookUrl = String(next.webhookUrl ?? '').trim();
      if (!next.webhookUrl && editingRecord) delete next.webhookUrl;
      else if (next.webhookUrl.length > 768) {
        throw new TypeError('Webhook 地址不能超过 768 字符');
      }
    }
    if (next.enable !== false && (!next.platformType || !next.webhookUrl)) {
      throw new TypeError('启用通知群前须填写平台类型和 Webhook 地址');
    }
    if (next.webhookUrl && !next.platformType) {
      throw new TypeError('填写 Webhook 地址时须选择平台类型');
    }
    if (next.webhookUrl) {
      let url: URL;
      try {
        url = new URL(next.webhookUrl);
      } catch {
        throw new TypeError('Webhook 地址格式无效');
      }
      const hosts: Record<string, string> = {
        DingTalkWebhook: 'oapi.dingtalk.com',
        FeishuWebhook: 'open.feishu.cn',
        WeComWebhook: 'qyapi.weixin.qq.com',
      };
      if (
        url.protocol !== 'https:' ||
        url.host !== hosts[String(next.platformType)] ||
        url.username ||
        url.password ||
        url.hash
      ) {
        throw new TypeError('Webhook 必须使用所选平台的官方 HTTPS 地址');
      }
    }
    return next;
  },
};
