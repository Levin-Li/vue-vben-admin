import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { supportMailboxRuleService } from '../../api/support-mailbox-rule-service';

export const pageMeta = {
  name: 'SupportMailboxRule',
  title: '支持邮箱受理规则',
  description: '配置支持邮箱入站来源和受理队列，显式启用或停用。',
} as const;

export const pageOperations = [
  { opName: 'list', apiMethods: [supportMailboxRuleService.list] },
  { opName: 'retrieve', apiMethods: [supportMailboxRuleService.retrieve] },
  { opName: 'create', apiMethods: [supportMailboxRuleService.create] },
  { opName: 'update', apiMethods: [supportMailboxRuleService.update] },
  { opName: 'enable', apiMethods: [supportMailboxRuleService.enable] },
  { opName: 'disable', apiMethods: [supportMailboxRuleService.disable] },
];

/** 受理范围和配置动作由页面服务适配；列表工具与字段展示使用公共 CRUD。 */
export function createSupportMailboxRuleCrudConfig(options: {
  channelLabel: (value: string) => string;
  list: NonNullable<CrudApiService['list']>;
}): CrudPageConfig {
  return {
    apiBase: '/SupportMailboxRuleAction',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService: { list: options.list },
    queryPermission: buildApiMethodPermissions(
      supportMailboxRuleService,
      'list',
    ),
    dataAttrTargets: {
      list: {
        method: 'GET',
        path: `${OAK_BASE_API_MODULE}/SupportMailboxRuleAction/list`,
      },
    },
    dataAttrConditionKeys: ['tenantId', 'orgId'],
    defaultQuery: { pageIndex: 1, pageSize: 20 },
    title: pageMeta.title,
    description: pageMeta.description,
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: false,
    allowExport: false,
    listOperations: [
      { key: 'mailbox:create', label: '创建受理邮箱', placement: 'left' },
    ],
    fields: [
      {
        key: 'email',
        label: '邮箱地址',
        table: true,
        form: false,
        sortable: false,
        width: 260,
      },
      {
        key: 'inboundChannel',
        label: '入站通道',
        table: true,
        form: false,
        sortable: false,
        width: 150,
        tableValue: (record) => options.channelLabel(record.inboundChannel),
      },
      {
        key: 'queueId',
        label: '受理队列',
        table: true,
        form: false,
        sortable: false,
        width: 200,
      },
      {
        key: 'enabled',
        label: '启用状态',
        table: true,
        form: false,
        sortable: false,
        width: 110,
        tableValue: (record) => (record.enabled ? '已启用' : '已停用'),
      },
    ],
  };
}
