import type {
  CrudApiService,
  CrudPageConfig,
} from '@levin/admin-framework/framework-commons/shared/types';

import { buildApiMethodPermissions } from '@levin/admin-framework/framework-commons/shared/crud-permissions';

import { OAK_BASE_API_MODULE } from '../../api/_module';
import { workflowDefinitionService } from '../../api/workflow-definition-service';
import { workflowDefinitionVersionService } from '../../api/workflow-definition-version-service';
import { workflowManagementService } from '../../api/workflow-management-service';

export const pageMeta = {
  name: 'WorkflowDefinition',
  title: '流程设计',
  description:
    '创建流程定义和草稿，配置业务适配、节点与结果，并模拟验证后发布。',
} as const;

export const pageOperations = [
  { opName: 'instances', apiMethods: [workflowManagementService.instances] },
  ...(['retire', 'restore', 'finishRetire', 'archive'] as const).map(
    (method) => ({
      opName: method,
      apiMethods: [workflowDefinitionVersionService[method]],
    }),
  ),
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

/** 定义列表复用公共查询与表格，绑定新增和版本设计保持专用交互。 */
export function createWorkflowDefinitionCrudConfig(options: {
  apiService: CrudApiService;
  businessOptions: Array<{ label: string; value: string }>;
}): CrudPageConfig {
  return {
    title: pageMeta.title,
    apiBase: '/WorkflowDefinition',
    apiModuleBase: OAK_BASE_API_MODULE,
    apiService: options.apiService,
    queryPermission: buildApiMethodPermissions(
      workflowDefinitionService,
      'list',
    ),
    dataAttrTargets: {
      list: {
        method: 'GET',
        path: `${OAK_BASE_API_MODULE}/WorkflowDefinition/list`,
      },
    },
    // 选择器值明确映射至实体键或旧版类型，不作为业务赋值字段。
    dataAttrConditionKeys: ['businessObject'],
    allowCreate: false,
    allowEdit: false,
    allowDelete: false,
    allowRetrieve: false,
    // 真实列表未提供独立导出授权，保留刷新、列设置等公共工具。
    allowExport: false,
    listOperations: [
      { key: 'workflow:create', label: '新建流程', placement: 'left' },
    ],
    fields: [
      {
        key: 'containsName',
        label: '流程名称',
        placeholder: '按流程名称查询',
        search: true,
        table: false,
        form: false,
        detail: false,
      },
      {
        key: 'businessObject',
        label: '业务对象',
        type: 'select',
        placeholder: '全部业务对象',
        options: options.businessOptions,
        search: true,
        table: false,
        form: false,
        detail: false,
      },
      {
        key: 'name',
        label: '流程名称',
        table: true,
        form: false,
        sortable: false,
        width: 220,
      },
      {
        key: 'businessType',
        label: '业务对象',
        table: true,
        form: false,
        sortable: false,
        width: 240,
      },
      {
        key: 'tenantName',
        label: '归属',
        table: true,
        form: false,
        sortable: false,
        width: 180,
      },
      {
        key: 'processKey',
        label: '版本状态',
        table: true,
        form: false,
        sortable: false,
        width: 180,
      },
    ],
  };
}
