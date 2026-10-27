import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { supportMailboxSettingService } from '../../api/support-mailbox-setting-service';

export const pageMeta = {
  name: 'SupportMailboxSetting',
  title: '客服邮箱设置',
  description: '设置客服邮箱收到邮件后由哪个工单队列处理。',
} as const;

export const pageOperations = [
  { opName: 'list', apiMethods: [supportMailboxSettingService.list] },
  { opName: 'retrieve', apiMethods: [supportMailboxSettingService.retrieve] },
  { opName: 'create', apiMethods: [supportMailboxSettingService.create] },
  { opName: 'update', apiMethods: [supportMailboxSettingService.update] },
  { opName: 'enable', apiMethods: [supportMailboxSettingService.enable] },
  { opName: 'disable', apiMethods: [supportMailboxSettingService.disable] },
];

/** 受理范围和配置动作由页面服务适配；列表工具与字段展示使用公共 CRUD。 */
export function createSupportMailboxSettingCrudConfig(options: {
  channelLabel: (value: string) => string;
  list: NonNullable<CrudApiService['list']>;
}): CrudPageConfig {
  return {
    apiBase: '/SupportMailboxSettingAction',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService: { list: options.list },
    queryPermission: buildApiMethodPermissions(
      supportMailboxSettingService,
      'list',
    ),
    dataAttrTargets: {
      list: {
        method: 'GET',
        path: `${OAK_BASE_API_MODULE}/SupportMailboxSettingAction/list`,
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
      { key: 'mailbox:create', label: '新增客服邮箱', placement: 'left' },
    ],
    fields: [
      {
        key: 'orgId',
        label: '受理组织',
        type: 'org-tree-select',
        search: true,
        table: false,
        form: false,
        detail: false,
      },
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
        label: '收件方式',
        table: true,
        form: false,
        sortable: false,
        width: 150,
        tableValue: (record) => options.channelLabel(record.inboundChannel),
      },
      {
        key: 'queueId',
        label: '工单队列',
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
