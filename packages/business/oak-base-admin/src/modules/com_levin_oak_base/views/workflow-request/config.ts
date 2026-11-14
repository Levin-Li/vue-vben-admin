import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

import { fixedCrudDataAttrTargets } from '../../api/standard-crud-data-attr-targets';
import { workflowRequestService } from '../../api/workflow-request-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';

export const pageMeta = {
  name: 'WorkflowRequest',
  title: '流程申请样例',
  description: '维护无业务状态字段的申请，并发起、查看各用途流程及办理历史。',
} as const;

export const pageOperations = [
  { opName: 'create', apiMethods: [workflowRequestService.create] },
  { opName: 'update', apiMethods: [workflowRequestService.update] },
  { opName: 'retrieve', apiMethods: [workflowRequestService.retrieve] },
  { opName: 'start', apiMethods: [workflowRuntimeService.start] },
  { opName: 'retry', apiMethods: [workflowRuntimeService.retry] },
  {
    opName: 'newRound',
    apiMethods: [
      workflowRuntimeService.roundState,
      workflowRuntimeService.newRound,
    ],
  },
  {
    opName: 'resubmit',
    apiMethods: [
      workflowRuntimeService.roundState,
      workflowRuntimeService.resubmit,
    ],
  },
  {
    opName: 'history',
    apiMethods: [
      workflowRuntimeService.history,
      workflowRuntimeService.eligibility,
    ],
  },
];

/** 四个业务输入保持平铺，申请人和归属由后端确定；流程结果仅作只读展示。 */
export const workflowRequestPageConfig: CrudPageConfig = {
  apiBase: '/WorkflowRequest',
  apiService: workflowRequestService,
  dataAttrTargets: fixedCrudDataAttrTargets(workflowRequestService, {
    create: { method: 'POST', path: 'create' },
    list: { method: 'GET', path: 'list' },
    retrieve: { method: 'GET', path: 'retrieve' },
    update: { method: 'PUT', path: 'update' },
  }),
  title: pageMeta.title,
  allowDelete: false,
  defaultFormValues: { amount: 0, documentsComplete: false },
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  detailExtraFields: [
    { key: 'tenantName', label: '租户名称', detail: false },
    { key: 'tenantId', label: '租户Id', detail: false },
    { key: 'orgId', label: '组织Id', detail: false },
    {
      key: 'orgName',
      label: '组织名称',
      layoutOrder: -10,
    },
    { key: 'ownerId', label: '申请人标识' },
    { key: 'owner', label: '所有者', detail: false },
    { key: 'domainId', label: '领域标识' },
    { key: 'creator', label: '创建者' },
    {
      key: 'createTime',
      label: '创建时间',
      type: 'datetime',
      layoutOrder: 1000,
    },
    {
      key: 'lastUpdateTime',
      label: '更新时间',
      type: 'datetime',
      layoutOrder: 1010,
    },
    { key: 'orderCode', label: '排序代码' },
    { key: 'enable', label: '是否启用' },
    { key: 'editable', label: '是否可编辑' },
    { key: 'remark', label: '备注' },
  ],
  fields: [
    {
      key: 'id',
      label: '申请编号',
      form: false,
      table: true,
      fixed: 'left',
      width: 180,
    },
    {
      key: 'title',
      label: '申请标题',
      table: true,
      required: true,
      maxLength: 256,
    },
    {
      key: 'category',
      label: '申请类别',
      table: true,
      required: true,
      maxLength: 64,
    },
    {
      key: 'amount',
      label: '申请金额',
      type: 'number',
      table: true,
      required: true,
    },
    {
      key: 'documentsComplete',
      label: '资料齐全',
      type: 'switch',
      table: true,
      required: true,
    },
    {
      key: 'resultSummary',
      label: '处理结果',
      form: false,
      table: true,
      width: 220,
    },
    {
      key: 'optimisticLock',
      label: '数据版本',
      form: false,
      table: false,
      detail: false,
    },
  ],
};
