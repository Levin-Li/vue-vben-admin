import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { platformDomainService } from '../../api/platform-domain-service';
import { standardCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';

const stateOptions = [
  { label: '草稿', value: 'Draft' },
  { label: '已发布', value: 'Published' },
  { label: '已下线', value: 'Offline' },
  { label: '已删除', value: 'Deleted' },
];

export const pageMeta = {
  name: 'PlatformDomain',
  title: '平台领域',
  description: '维护平台数据领域、发布状态与扩展信息。',
} as const;

export const platformDomainPageCrudConfig: CrudPageConfig = {
  apiBase: '/PlatformDomain',
  apiService: platformDomainService,
  dataAttrTargets: standardCrudDataAttrTargets(platformDomainService),
  defaultFormValues: {
    editable: true,
    enable: true,
    orderCode: 100,
  },
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  description: '平台领域用于限定 RBAC 数据领域边界，状态变更由服务端流程控制。',
  detailExtraFields: [
    { key: 'actionLog', label: '流程日志', detail: false },
    {
      key: 'supportEventsByCurrentStatus',
      label: '当前状态可执行动作',
      detail: false,
    },
    {
      key: 'expiredTime',
      label: '到期时间',
      type: 'datetime',
      layoutGroup: 'basic',
      layoutGroupTitle: '基础信息',
      layoutOrder: 60,
    },
  ],
  fields: [
    {
      key: 'id',
      label: '领域ID',
      disabledOnEdit: true,
      fixed: 'left',
      form: true,
      required: true,
      search: true,
      showIdOnCreate: true,
      table: true,
      width: 220,
      layoutGroup: 'basic',
      layoutGroupOrder: 10,
      layoutGroupTitle: '基础信息',
      layoutOrder: 10,
    },
    { key: 'containsName', label: '领域名称', form: false, search: true },
    {
      key: 'name',
      label: '领域名称',
      required: true,
      table: true,
      width: 180,
      layoutGroup: 'basic',
      layoutGroupTitle: '基础信息',
      layoutOrder: 20,
    },
    {
      key: 'type',
      label: '领域类型',
      table: true,
      width: 140,
      layoutGroup: 'basic',
      layoutGroupTitle: '基础信息',
      layoutOrder: 30,
    },
    {
      key: 'state',
      label: '状态',
      form: false,
      options: stateOptions,
      search: true,
      table: true,
      type: 'select',
      width: 120,
      layoutGroup: 'basic',
      layoutGroupOrder: 10,
      layoutGroupTitle: '基础信息',
      layoutOrder: 40,
    },
    {
      key: 'confidentialLevel',
      label: '机密等级',
      table: true,
      type: 'number',
      width: 120,
      layoutGroup: 'basic',
      layoutGroupOrder: 10,
      layoutGroupTitle: '基础信息',
      layoutOrder: 50,
    },
    {
      key: 'exInfoEditor',
      label: '扩展信息编辑器',
      fullRow: true,
      type: 'textarea',
      layoutGroup: 'content',
      layoutGroupOrder: 30,
      layoutGroupTitle: '扩展配置',
      layoutOrder: 10,
    },
    {
      key: 'exInfo',
      label: '扩展信息',
      fullRow: true,
      jsonSchemaEditor: true,
      jsonSchema: ':exInfoEditor',
      type: 'json',
      layoutGroup: 'content',
      layoutGroupOrder: 30,
      layoutGroupTitle: '扩展配置',
      layoutOrder: 20,
    },
    {
      key: 'enable',
      label: '是否启用',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
      layoutGroup: 'maintenance',
      layoutGroupOrder: 90,
      layoutGroupTitle: '补充与维护',
      layoutOrder: 10,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      formCreate: true,
      formEdit: true,
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
      layoutGroup: 'maintenance',
      layoutGroupOrder: 90,
      layoutGroupTitle: '补充与维护',
      layoutOrder: 20,
    },
    {
      key: 'orderCode',
      label: '排序代码',
      type: 'number',
      layoutGroup: 'maintenance',
      layoutGroupTitle: '补充与维护',
      layoutOrder: 30,
    },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
      layoutGroup: 'audit',
      layoutGroupOrder: 100,
      layoutGroupTitle: '维护时间',
      layoutOrder: 10,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
      layoutGroup: 'audit',
      layoutGroupOrder: 100,
      layoutGroupTitle: '维护时间',
      layoutOrder: 20,
    },
    {
      key: 'remark',
      label: '备注',
      fullRow: true,
      type: 'textarea',
      layoutGroup: 'maintenance',
      layoutGroupTitle: '补充与维护',
      layoutOrder: 40,
    },
  ],
  formMaxColumns: 2,
  modalWidth: 960,
  rowActions: [
    {
      handler: (record: Record<string, any>) =>
        platformDomainService.publish({ id: record.id }),
      flowFormFields: [],
      label: '发布',
      permission: buildApiMethodPermissions(platformDomainService, 'publish'),
      visible: (record: Record<string, any>) =>
        canFirePlatformDomainEvent(record, '发布'),
    },
    {
      handler: (record: Record<string, any>) =>
        platformDomainService.offline({ id: record.id }),
      flowFormFields: [],
      label: '下线',
      permission: buildApiMethodPermissions(platformDomainService, 'offline'),
      visible: (record: Record<string, any>) =>
        canFirePlatformDomainEvent(record, '下线'),
    },
  ],
  title: '平台领域',
};

function canFirePlatformDomainEvent(
  record: Record<string, any>,
  event: string,
) {
  return (
    Array.isArray(record.supportEventsByCurrentStatus) &&
    record.supportEventsByCurrentStatus.includes(event)
  );
}
