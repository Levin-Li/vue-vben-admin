import { workflowRuntimeService } from '../../api/workflow-runtime-service';

// 页面与运行时控制器四项真实方法对应，上传路由保留各自权限。
export const pageMeta = {
  name: 'WorkflowStart',
  title: '发起流程',
  description: '选择当前有权发起的手动流程和业务记录，查看资格并发起。',
} as const;
export const pageOperations = [
  { opName: 'manualStarts', apiMethods: [workflowRuntimeService.manualStarts] },
  {
    opName: 'businessRecords',
    apiMethods: [workflowRuntimeService.businessRecords],
  },
  { opName: 'eligibility', apiMethods: [workflowRuntimeService.eligibility] },
  { opName: 'start', apiMethods: [workflowRuntimeService.start] },
];
