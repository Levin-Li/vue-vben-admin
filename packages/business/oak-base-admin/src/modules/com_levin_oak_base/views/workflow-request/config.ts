import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

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
  title: pageMeta.title,
  allowDelete: false,
  defaultFormValues: { amount: 0, documentsComplete: false },
  defaultQuery: { pageIndex: 1, pageSize: 10 },
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
