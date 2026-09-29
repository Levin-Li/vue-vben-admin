import { workflowExpenseService } from '../../api/workflow-expense-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';

export const pageMeta = {
  name: 'MyWorkflow',
  title: '我的流程',
  description: '查看并办理当前用户的流程待办、已办和发起记录。',
} as const;

export const pageOperations = [
  { opName: 'todo', apiMethods: [workflowRuntimeService.todo] },
  { opName: 'done', apiMethods: [workflowRuntimeService.done] },
  { opName: 'started', apiMethods: [workflowRuntimeService.started] },
  { opName: 'complete', apiMethods: [workflowRuntimeService.complete] },
  { opName: 'retry', apiMethods: [workflowRuntimeService.retry] },
  {
    opName: 'viewExpenseDetail',
    apiMethods: [workflowExpenseService.retrieve],
  },
  {
    opName: 'prepareStepUpAuth',
    apiMethods: [workflowRuntimeService.prepareStepUpAuth],
  },
];
