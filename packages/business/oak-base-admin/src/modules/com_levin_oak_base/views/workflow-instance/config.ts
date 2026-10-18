import { workflowManagementService } from '../../api/workflow-management-service';
import { workflowRuntimeService } from '../../api/workflow-runtime-service';

// 管理入口分别登记查询、详情及受控运行命令，不提供引擎维护入口。
export const pageMeta = {
  name: 'WorkflowInstance',
  title: '工作流实例管理',
  description: '按授权业务范围查看流程运行实例、固定版本流程图和实际轨迹。',
} as const;

export const pageOperations = [
  { opName: 'terminate', apiMethods: [workflowRuntimeService.terminate] },
  { opName: 'recover', apiMethods: [workflowRuntimeService.recover] },
  { opName: 'instances', apiMethods: [workflowManagementService.instances] },
  { opName: 'instance', apiMethods: [workflowManagementService.instance] },
];
