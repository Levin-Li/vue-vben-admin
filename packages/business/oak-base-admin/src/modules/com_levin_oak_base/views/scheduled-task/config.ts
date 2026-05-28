import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { scheduledTaskService } from '../../api/scheduled-task-service';
import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';
import {
  DEFAULT_CRUD_MODAL_WIDTH,
  buildEnumOptionsLoader,
  tenantOptionsLoader,
} from '../api-module';

const executionContentTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.ScheduledTask$ExecutionContentType',
);
const supportedExecutionContentTypeOptionsLoader = async (keyword?: string) => {
  const options = await executionContentTypeOptionsLoader(keyword);
  return options.filter((option) => option.value !== 'BeanShellScript');
};
const schedulerTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.ScheduledTask$SchedulerType',
);
const misfirePolicyOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.ScheduledTask$MisfirePolicy',
);

type ScheduledTaskActionMethod =
  | 'stopScheduler'
  | 'syncScheduler'
  | 'triggerOnce';

function buildScheduledTaskAction(methodName: ScheduledTaskActionMethod) {
  return async (record: Record<string, any>) =>
    scheduledTaskService[methodName]({
      id: record.id,
    });
}

function buildScheduledTaskActionPermission(
  methodName: ScheduledTaskActionMethod,
) {
  return buildApiMethodPermissions(scheduledTaskService, methodName);
}

export const scheduledTaskPageCrudConfig: CrudPageConfig = {
  apiBase: '/ScheduledTask',
  apiService: scheduledTaskService,
  defaultFormValues: {
    cron: '0 0/5 * * * *',
    editable: true,
    enable: true,
    executionContentType: 'GroovyScript',
    executionCount: 0,
    misfirePolicy: 'FireOnce',
    orderCode: 100,
    parallelExecution: false,
    retryCount: 0,
    retryIntervalSeconds: 60,
    schedulerType: 'Redis',
    taskVersion: 1,
    triggerTimeoutSeconds: 300,
  },
  defaultQuery: {
    pageIndex: 1,
    pageSize: 10,
  },
  fields: [
    {
      key: 'tenantId',
      label: '归属租户',
      loadOptions: tenantOptionsLoader,
      remoteSearch: true,
      search: true,
      type: 'select',
      visibleForSaasUser: true,
    },
    {
      key: '__tenant',
      label: '归属租户',
      fixed: 'left',
      form: false,
      table: true,
      type: 'tenant',
      visibleForSaasUser: true,
      width: 180,
    },
    {
      key: 'id',
      label: '任务ID',
      fixed: 'left',
      form: false,
      search: true,
      table: true,
      width: 180,
    },
    {
      key: 'name',
      label: '名称',
      required: true,
      search: true,
      table: true,
      width: 180,
    },
    { key: 'timeZone', label: '时区', table: true, width: 140 },
    {
      key: 'inSchedulerType',
      label: '调度器',
      form: false,
      loadOptions: schedulerTypeOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'schedulerType',
      label: '调度器',
      loadOptions: schedulerTypeOptionsLoader,
      required: true,
      search: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'schedulerAppName',
      label: '执行器应用',
      search: true,
      table: true,
      width: 150,
    },
    {
      key: 'schedulerJobId',
      label: '外部任务ID',
      search: true,
      table: true,
      width: 150,
    },
    {
      key: 'handlerName',
      label: '处理器名称',
      table: true,
      width: 180,
    },
    {
      key: 'category',
      label: '任务分类',
      search: true,
      table: true,
      width: 140,
    },
    { key: 'containsGroupName', label: '任务组', form: false, search: true },
    { key: 'groupName', label: '任务组', table: true, width: 160 },
    {
      key: 'executionContentType',
      label: '执行内容类型',
      loadOptions: supportedExecutionContentTypeOptionsLoader,
      table: true,
      type: 'select',
      width: 140,
    },
    {
      key: 'cron',
      label: '调度表达式',
      layoutNewRow: true,
      placeholder: '例如 0 0/5 * * * *',
      required: true,
      table: true,
      type: 'cron',
      width: 180,
    },
    {
      key: 'triggerTimeoutSeconds',
      label: '触发宽限秒',
      table: true,
      type: 'number',
      valueType: 'number',
      width: 120,
    },
    {
      key: 'misfirePolicy',
      label: '错过策略',
      loadOptions: misfirePolicyOptionsLoader,
      search: true,
      table: true,
      type: 'select',
      width: 120,
    },
    {
      key: 'timeoutSeconds',
      label: '执行超时秒',
      table: true,
      type: 'number',
      valueType: 'number',
      width: 120,
    },
    {
      key: 'inExecutionContentType',
      label: '执行内容类型',
      form: false,
      loadOptions: supportedExecutionContentTypeOptionsLoader,
      multiple: true,
      search: true,
      type: 'select',
    },
    {
      key: 'executionContent',
      label: '执行内容',
      fullRow: true,
      type: 'textarea',
    },
    {
      key: 'schedulerConfig',
      label: '调度器配置',
      type: 'json',
    },
    {
      key: 'runParams',
      label: '执行参数',
      type: 'json',
    },
    {
      key: 'bizType',
      label: '业务类型',
      search: true,
      table: true,
      width: 140,
    },
    {
      key: 'bizId',
      label: '业务ID',
      search: true,
      table: true,
      width: 180,
    },
    { key: 'bizName', label: '业务名称', table: true, width: 180 },
    { key: 'bizKey', label: '业务键', table: true, width: 180 },
    {
      key: 'parallelExecution',
      label: '允许并发执行',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 120,
    },
    {
      key: 'retryCount',
      label: '重试次数',
      table: true,
      type: 'number',
      valueType: 'number',
      width: 100,
    },
    {
      key: 'retryIntervalSeconds',
      label: '重试间隔秒',
      table: true,
      type: 'number',
      valueType: 'number',
      width: 120,
    },
    {
      key: 'taskVersion',
      label: '配置版本',
      table: true,
      type: 'number',
      valueType: 'number',
      width: 100,
    },
    {
      key: 'executionCount',
      label: '执行累计次数',
      table: true,
      type: 'number',
      width: 120,
    },
    {
      key: 'gteCreateTime',
      label: '创建时间开始',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lteCreateTime',
      label: '创建时间结束',
      form: false,
      search: true,
      type: 'datetime',
    },
    {
      key: 'lastScheduledExecutionTime',
      label: '最后调度时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastActualExecutionTime',
      label: '最后实际执行时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastCompletionTime',
      label: '最后完成时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'nextExecutionTime',
      label: '下一次执行时间',
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'enable',
      label: '是否启用',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 100,
    },
    {
      key: 'editable',
      label: '是否可编辑',
      search: true,
      table: true,
      type: 'switch',
      valueType: 'boolean',
      width: 110,
    },
    { key: 'remark', label: '备注', type: 'textarea' },
    {
      key: 'createTime',
      label: '创建时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      form: false,
      table: true,
      type: 'datetime',
      width: 180,
    },
  ],
  modalWidth: DEFAULT_CRUD_MODAL_WIDTH,
  rowActions: [
    {
      handler: buildScheduledTaskAction('triggerOnce'),
      label: '单次触发',
      permission: buildScheduledTaskActionPermission('triggerOnce'),
    },
    {
      handler: buildScheduledTaskAction('syncScheduler'),
      label: '同步调度器',
      permission: buildScheduledTaskActionPermission('syncScheduler'),
    },
    {
      confirmText: '停止后将关闭任务启用状态，并取消后续调度触发。',
      danger: true,
      handler: buildScheduledTaskAction('stopScheduler'),
      label: '停止调度',
      permission: buildScheduledTaskActionPermission('stopScheduler'),
      visibleOn: 'enable == true',
    },
  ],
  title: '定时任务管理',
};
