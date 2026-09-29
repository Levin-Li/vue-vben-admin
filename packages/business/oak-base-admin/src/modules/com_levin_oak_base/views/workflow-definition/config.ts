import { workflowDefinitionService } from '../../api/workflow-definition-service';
import { workflowDefinitionVersionService } from '../../api/workflow-definition-version-service';

export const pageMeta = {
  name: 'WorkflowDefinition',
  title: '流程设计',
  description:
    '创建流程定义和草稿，配置业务适配、节点与结果，并模拟验证后发布。',
} as const;

export const pageOperations = [
  { opName: 'create', apiMethods: [workflowDefinitionService.create] },
  {
    opName: 'createVersion',
    apiMethods: [workflowDefinitionVersionService.create],
  },
  {
    opName: 'saveDraft',
    apiMethods: [workflowDefinitionVersionService.saveDraft],
  },
  {
    opName: 'startSimulation',
    apiMethods: [workflowDefinitionVersionService.startSimulation],
  },
  {
    opName: 'publishAfterSimulation',
    apiMethods: [workflowDefinitionVersionService.publishAfterSimulation],
  },
];

// 宿主下拉与工作台提示消费同一个公开生命周期标签目录。
export { workflowLifecycleLabels as lifecycleLabels } from '@levin/bpm-designer';
