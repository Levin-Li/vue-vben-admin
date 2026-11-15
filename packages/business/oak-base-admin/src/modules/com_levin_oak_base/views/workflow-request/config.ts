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
  createSubmitKeys: [
    'title',
    'category',
    'amount',
    'documentsComplete',
    'tenantId',
    'orgId',
  ],
  defaultFormValues: { amount: 0, documentsComplete: false },
  defaultQuery: { pageIndex: 1, pageSize: 10 },
  detailExtraFields: [
    { key: 'tenantName', label: '租户名称', detail: false },
    {
      key: 'tenantId',
      label: '归属租户',
      detail: true,
      visibleForPlatformUser: true,
      layoutOrder: -30,
    },
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
    // 新增草稿可另选授权范围，编辑使用原业务范围。
    {
      key: 'tenantId',
      label: '归属租户',
      layoutOrder: -30,
      type: 'select',
      visibleForPlatformUser: true,
      table: false,
      search: false,
      disabledOnEdit: true,
      omitOnEdit: true,
    },
    {
      key: 'orgId',
      label: '业务组织',
      layoutOrder: -20,
      type: 'org-tree-select',
      visibleForPlatformUser: true,
      table: false,
      search: false,
      formEdit: false,
      required: true,
    },
    // 平台表格回显行所属租户，查询仍由页面授权范围决定。
    {
      key: '__tenant',
      label: '归属租户',
      type: 'tenant',
      table: true,
      form: false,
      detail: false,
      visibleForPlatformUser: true,
      width: 180,
    },
    {
      key: 'orgName',
      label: '业务组织',
      table: true,
      form: false,
      tableValue: (record) => record.orgName || record.orgId,
      sortable: false,
      width: 180,
    },
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
