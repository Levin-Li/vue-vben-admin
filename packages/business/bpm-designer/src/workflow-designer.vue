<script setup lang="ts">
import type {
  WorkflowDesignerOptions,
  WorkflowNode,
  WorkflowNodeType,
} from './types';
import type { WorkflowTreeVersion } from './workflow-tree-version';

import { computed, ref, watch } from 'vue';

import FlowDesign from '../third-party/lowflow-design/src/views/flowDesign/index.vue';
import { validateTreeDefinition } from './definition-model';
import { toLowflowCanvasTree } from './lowflow-model';
import WorkflowConditionEditor from './workflow-condition-editor.vue';
import { applyGraphLayout } from './workflow-graph-layout';
import { workflowVerificationOptions } from './workflow-labels';
import WorkflowParameterEditor from './workflow-parameter-editor.vue';
import {
  insertExclusiveOutcomesOnTreeEdge,
  insertGatewayOnTreeEdge,
  insertUserTaskOnTreeEdge,
  patchWorkflowTreeEdge,
  patchWorkflowTreeNode,
  removeTreeUserTask,
} from './workflow-tree-edit';
import { projectDraftV3ToV2 } from './workflow-tree-version';

// 所有编辑在独立 JSON 副本上进行，避免修改宿主 props 或 Vue 代理克隆失败。
const props = withDefaults(
  defineProps<{
    modelValue: WorkflowTreeVersion;
    options?: WorkflowDesignerOptions;
    readonly?: boolean;
  }>(),
  { options: () => ({}) },
);
const emit = defineEmits<{
  'update:modelValue': [value: WorkflowTreeVersion];
  validate: [valid: boolean, messages: string[]];
}>();
const activeTab = ref('binding');
const selectedNodeId = ref('');
const selectedEdgeId = ref('');
const graphEditError = ref('');
const variableName = ref('');
const variableField = ref('');
const outcome = ref('Approved');
const outcomeAction = ref('');
const tabs = [
  { key: 'binding', label: '业务适配' },
  { key: 'start', label: '启动与依赖' },
  { key: 'graph', label: '节点与流转' },
  { key: 'outcomes', label: '结果处理' },
  { key: 'preview', label: '配置预览' },
];
const outcomes = [
  { value: 'Approved', label: '通过' },
  { value: 'Rejected', label: '拒绝' },
  { value: 'Withdrawn', label: '撤回' },
  { value: 'Terminated', label: '终止' },
];
const actionOptions = [
  { value: 'approve', label: '通过' },
  { value: 'reject', label: '拒绝' },
  { value: 'return', label: '退回' },
  { value: 'transfer', label: '转办' },
  { value: 'delegate', label: '委派' },
  { value: 'add-sign', label: '加签' },
];
const mappingFields = [
  { key: 'identityField', label: '业务主键' },
  { key: 'titleField', label: '业务标题' },
  { key: 'applicantField', label: '申请人（可选）' },
  { key: 'summaryField', label: '摘要（可选）' },
] as const;
const graph = computed(() => {
  try {
    return projectDraftV3ToV2(props.modelValue);
  } catch {
    return undefined;
  }
});
const nodes = computed(() => graph.value?.nodes ?? []);
const selectedNode = computed(() =>
  nodes.value.find((node) => node.id === selectedNodeId.value),
);
const selectedEdge = computed(() =>
  graph.value?.edges?.find((edge) => edge.id === selectedEdgeId.value),
);
const selectedEdgeIsExclusive = computed(
  () =>
    nodes.value.find((node) => node.id === selectedEdge.value?.source)?.type ===
    'exclusiveGateway',
);
const business = computed(() =>
  props.options.businessTypes?.find(
    (item) =>
      item.businessType === props.modelValue.businessBinding?.businessType &&
      String(item.contractVersion) ===
        String(props.modelValue.businessBinding?.contractVersion),
  ),
);
const availableEvents = computed(() => [
  ...new Set([
    'workflow.result.applied',
    ...(business.value?.eventTypes ?? []),
  ]),
]);
const fields = computed(() =>
  Object.entries(business.value?.fields ?? {}).map(([key, field]) => ({
    ...field,
    key,
  })),
);
const approverResolvers = computed(() =>
  Object.entries(business.value?.approverResolvers ?? {}),
);
const selectedApproverResolver = computed(
  () =>
    business.value?.approverResolvers?.[
      selectedNode.value?.approverResolver?.key ?? ''
    ],
);
const conditionFields = computed(() =>
  fields.value.filter(
    (field) => field.condition && field.sensitivity !== 'secret',
  ),
);
const displayFields = computed(() =>
  fields.value.filter(
    (field) => field.display && field.sensitivity !== 'secret',
  ),
);
const validationMessages = computed(() =>
  validateTreeDefinition(props.modelValue, props.options),
);
const formActions = computed(() =>
  Object.entries(business.value?.actions ?? {}).filter(
    ([, action]) => action.writableFields?.length,
  ),
);
const editableFields = computed(() => {
  const action =
    business.value?.actions?.[selectedNode.value?.formAction ?? ''];
  return displayFields.value.filter(
    (field) =>
      field.editable &&
      action?.writableFields?.includes(field.key) &&
      action.parameters?.[field.key]?.type === field.type &&
      selectedNode.value?.readableFields?.includes(field.key),
  );
});
// 草稿编辑可展示暂时单入单出的网关；丢节点或丢边时明确报错，不回退旧画布。
const lowflowGraph = computed(() => {
  try {
    if (props.modelValue.schemaVersion !== 3)
      throw new Error('只接受 schemaVersion=3 的流程定义');
    return {
      tree: toLowflowCanvasTree(projectDraftV3ToV2(props.modelValue), {
        allowDraft: true,
      }),
      error: '',
    };
  } catch (error) {
    return {
      tree: null,
      error: error instanceof Error ? error.message : '流程图暂时无法展示',
    };
  }
});
watch(
  validationMessages,
  (messages) => emit('validate', messages.length === 0, messages),
  { immediate: true },
);

function updateDefinition(mutator: (draft: WorkflowTreeVersion) => void) {
  if (props.readonly) return;
  // JSON为本接口唯一值域，序列化副本同时剥离嵌套Vue代理并省略未设置配置。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const draft = JSON.parse(
    JSON.stringify(props.modelValue),
  ) as WorkflowTreeVersion;
  mutator(draft);
  try {
    projectDraftV3ToV2(draft);
    graphEditError.value = '';
    emit('update:modelValue', draft);
  } catch (error) {
    graphEditError.value =
      error instanceof Error ? error.message : '流程树修改失败。';
  }
}
function text(event: Event) {
  return (event.target as HTMLInputElement).value;
}
function checked(event: Event) {
  return (event.target as HTMLInputElement).checked;
}
function values(event: Event) {
  return Array.from(
    (event.target as HTMLSelectElement).selectedOptions,
    (option) => option.value,
  );
}
function selectBusiness(value: string) {
  const selected = props.options.businessTypes?.find(
    (item) => `${item.businessType}@${item.contractVersion}` === value,
  );
  if (!selected) return;
  updateDefinition((draft) => {
    draft.businessBinding = {
      businessType: selected.businessType,
      contractVersion: selected.contractVersion,
      identityField: '',
      titleField: '',
    };
    // 更换契约保留原有变量供用户明确修正，未知字段在校验中拒绝，不能静默重映射。
  });
}
function updateBinding(key: string, value: string) {
  updateDefinition((draft) => {
    if (draft.businessBinding)
      Object.assign(draft.businessBinding, { [key]: value || undefined });
  });
}
function updatePolicy(
  patch: Partial<NonNullable<WorkflowTreeVersion['startPolicy']>>,
) {
  updateDefinition((draft) => {
    draft.startPolicy = { mode: 'manual', ...draft.startPolicy, ...patch };
  });
}
function addVariable() {
  const field = conditionFields.value.find(
    (item) => item.key === variableField.value,
  );
  const key = variableName.value.trim();
  if (!field || !key || props.modelValue.variables?.[key]) return;
  updateDefinition((draft) => {
    draft.variables ??= {};
    draft.variables[key] = {
      source: `business.${field.key}`,
      type: field.type,
      readAt: 'start',
    };
  });
  variableName.value = '';
  variableField.value = '';
}

// 结构编辑仅在选中的真实树边执行；不会将投影图写回定义。
function createNode(type: WorkflowNodeType) {
  // 版本切换或外部更新可能使选择过期；必须明确阻断，不把节点插入另一条分支。
  if (selectedEdgeId.value && !selectedEdge.value) {
    graphEditError.value = `选中的连线「${selectedEdgeId.value}」已不存在，请重新选择插入位置。`;
    selectedEdgeId.value = '';
    return;
  }

  if (!selectedEdgeId.value) {
    graphEditError.value = '请先选择需要插入节点的连线。';
    return;
  }
  if (type === 'end' || type === 'start') {
    graphEditError.value = '请使用树内原子操作创建开始或结束结构。';
    return;
  }
  try {
    const result =
      type === 'userTask'
        ? insertUserTaskOnTreeEdge(props.modelValue, selectedEdgeId.value)
        : insertGatewayOnTreeEdge(props.modelValue, selectedEdgeId.value, type);
    emit('update:modelValue', result.definition);
    selectedNodeId.value = 'node' in result ? result.node.id : result.fork.id;
    selectedEdgeId.value = '';
    graphEditError.value = '';
  } catch (error) {
    graphEditError.value =
      error instanceof Error ? error.message : '无法插入审批节点。';
  }
}
function createOutcomeExit() {
  if (props.readonly) return;
  if (!selectedEdgeId.value) {
    graphEditError.value = '请先选择通向唯一入边结束节点的连线。';
    return;
  }
  try {
    const result = insertExclusiveOutcomesOnTreeEdge(
      props.modelValue,
      selectedEdgeId.value,
    );
    emit('update:modelValue', result.definition);
    selectedNodeId.value = result.rejectedEnd.id;
    selectedEdgeId.value = '';
    graphEditError.value = '';
  } catch (error) {
    graphEditError.value =
      error instanceof Error ? error.message : '无法新增不同结果出口。';
  }
}
function deleteSelectedNode() {
  if (props.readonly) return;
  if (selectedNode.value?.type !== 'userTask') {
    graphEditError.value =
      '仅单入单出审批任务可直接删除；网关及结束节点需要成组结构调整。';
    return;
  }
  try {
    emit(
      'update:modelValue',
      removeTreeUserTask(props.modelValue, selectedNode.value.id),
    );
    selectedNodeId.value = '';
    graphEditError.value = '';
  } catch (error) {
    graphEditError.value =
      error instanceof Error ? error.message : '无法删除当前审批节点。';
  }
}
function updateNode(patch: Partial<WorkflowNode>) {
  if (props.readonly) return;
  try {
    emit(
      'update:modelValue',
      patchWorkflowTreeNode(props.modelValue, selectedNodeId.value, patch),
    );
    graphEditError.value = '';
  } catch (error) {
    graphEditError.value =
      error instanceof Error ? error.message : '节点属性修改失败。';
  }
}
function selectApproverResolver(key: string) {
  if (!key) return updateNode({ approverResolver: undefined });
  if (!business.value?.approverResolvers?.[key]) return;
  updateNode({ approverResolver: { key, parameters: {} } });
}
function updateEdge(patch: {
  condition?: import('./types').WorkflowCondition | null;
  default?: boolean;
}) {
  if (props.readonly) return;
  try {
    emit(
      'update:modelValue',
      patchWorkflowTreeEdge(props.modelValue, selectedEdgeId.value, patch),
    );
    graphEditError.value = '';
  } catch (error) {
    graphEditError.value =
      error instanceof Error ? error.message : '连线属性修改失败。';
  }
}
function autoLayout() {
  if (props.readonly || !graph.value) return;
  const layout = structuredClone(graph.value);
  applyGraphLayout(layout);
  try {
    let updated = props.modelValue;
    for (const node of layout.nodes)
      updated = patchWorkflowTreeNode(updated, node.id, {
        x: node.x,
        y: node.y,
      });
    emit('update:modelValue', updated);
    graphEditError.value = '';
  } catch (error) {
    graphEditError.value =
      error instanceof Error ? error.message : '自动排布失败。';
  }
}

// 结果动作只可来自已公开的业务目录，参数按目录类型输入。
function addOutcomeAction() {
  if (!outcomeAction.value || !business.value?.actions?.[outcomeAction.value])
    return;
  updateDefinition((draft) => {
    draft.outcomeActions ??= {};
    draft.outcomeActions[outcome.value] ??= [];
    draft.outcomeActions[outcome.value]!.push({
      action: outcomeAction.value,
      parameters: {},
    });
  });
}
</script>

<template>
  <section class="workflow-designer" aria-label="流程设计器">
    <!-- 基本信息与步骤导航在所有配置区持续可见。 -->
    <div class="definition-header">
      <label>
        流程名称
        <input
          :disabled="readonly"
          :value="modelValue.name"
          @input="
            updateDefinition((draft) => {
              draft.name = text($event);
            })
          "
        />
      </label>

      <label>
        流程标识
        <input
          :disabled="readonly"
          :value="modelValue.processKey"
          @input="
            updateDefinition((draft) => {
              draft.processKey = text($event);
            })
          "
        />
      </label>

      <label>
        业务用途标识
        <input
          :disabled="readonly"
          :value="modelValue.purposeKey"
          placeholder="例如 contract.review"
          @input="
            updateDefinition((draft) => {
              draft.purposeKey = text($event);
            })
          "
        />
      </label>
    </div>
    <nav class="designer-tabs" aria-label="流程配置步骤">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :aria-current="activeTab === tab.key ? 'step' : undefined"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- 业务对象及字段映射从能力目录选择，不假定任何状态字段。 -->
    <div v-if="activeTab === 'binding'" class="panel">
      <h3>业务对象与字段映射</h3>

      <label>
        适配业务对象

        <select
          :disabled="readonly"
          :value="
            modelValue.businessBinding
              ? `${modelValue.businessBinding.businessType}@${modelValue.businessBinding.contractVersion}`
              : ''
          "
          @change="selectBusiness(text($event))"
        >
          <option value="">请选择业务对象</option>

          <option
            v-for="item in options.businessTypes"
            :key="`${item.businessType}@${item.contractVersion}`"
            :value="`${item.businessType}@${item.contractVersion}`"
          >
            {{ item.title }}
            ·
            {{ item.businessType }}
            · v
            {{ item.contractVersion }}
          </option>
        </select>
      </label>

      <p v-if="!options.businessTypes?.length" class="hint">
        暂无可用业务类型，请检查能力目录权限或由业务模块注册接入契约。
      </p>
      <div v-if="modelValue.businessBinding" class="form-grid">
        <label v-for="mapping in mappingFields" :key="mapping.key">
          {{ mapping.label }}

          <select
            :disabled="readonly"
            :value="modelValue.businessBinding[mapping.key] ?? ''"
            @change="updateBinding(mapping.key, text($event))"
          >
            <option value="">请选择字段</option>

            <option
              v-for="field in fields.filter(
                (item) => item.sensitivity !== 'secret',
              )"
              :key="field.key"
              :value="field.key"
            >
              {{ field.title }}
              ·
              {{ field.key }}
              (
              {{ field.type }}
              )
            </option>
          </select>
        </label>
      </div>
      <h3>流程变量</h3>
      <p class="hint">
        启动条件读取当前业务数据；流程分支默认使用提交快照。租户、组织和身份始终由服务端确定。
      </p>
      <div class="inline-form">
        <label>
          变量名称
          <input v-model="variableName" :disabled="readonly" />
        </label>
        <label>
          来源业务字段

          <select v-model="variableField" :disabled="readonly">
            <option value="">选择可判断字段</option>

            <option
              v-for="field in conditionFields"
              :key="field.key"
              :value="field.key"
            >
              {{ field.title }}
              ·
              {{ field.type }}
            </option>
          </select>
        </label>
        <button
          type="button"
          :disabled="
            readonly ||
            !variableName.trim() ||
            !variableField ||
            !!modelValue.variables?.[variableName.trim()]
          "
          @click="addVariable"
        >
          添加变量
        </button>
      </div>
      <table v-if="Object.keys(modelValue.variables ?? {}).length > 0">
        <thead>
          <tr>
            <th>变量</th>
            <th>来源</th>
            <th>类型</th>
            <th>读取时点</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(variable, key) in modelValue.variables" :key="key">
            <td>{{ key }}</td>
            <td>{{ variable.source }}</td>
            <td>{{ variable.type }}</td>
            <td>
              <select
                :aria-label="`${key} 读取时点`"
                :disabled="readonly"
                :value="variable.readAt"
                @change="
                  updateDefinition((draft) => {
                    draft.variables![key]!.readAt = text($event) as
                      | 'start'
                      | 'node';
                  })
                "
              >
                <option value="start">提交快照</option>

                <option value="node">节点进入时</option>
              </select>
            </td>
            <td>
              <button
                type="button"
                :disabled="readonly"
                @click="
                  updateDefinition((draft) => {
                    delete draft.variables![key];
                  })
                "
              >
                删除变量
                {{ key }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 启动资格与同轮次用途依赖独立配置，自动模式必须显式选择事件和主体。 -->
    <div v-if="activeTab === 'start'" class="panel">
      <h3>启动规则</h3>
      <div class="form-grid">
        <label>
          启动方式

          <select
            :disabled="readonly"
            :value="modelValue.startPolicy?.mode ?? 'manual'"
            @change="updatePolicy({ mode: text($event) as 'manual' | 'event' })"
          >
            <option value="manual">手动发起</option>

            <option value="event">事件自动发起</option>
          </select>
        </label>
        <label>
          匹配优先级
          <input
            type="number"
            :disabled="readonly"
            :value="modelValue.startPolicy?.priority ?? 0"
            @input="updatePolicy({ priority: Number(text($event)) })"
          />
        </label>
      </div>
      <div v-if="modelValue.startPolicy?.mode === 'event'" class="form-grid">
        <label>
          触发事件

          <select
            :disabled="readonly"
            multiple
            @change="updatePolicy({ events: values($event) })"
          >
            <option value="">选择业务事件</option>

            <option
              v-for="event in availableEvents"
              :key="event"
              :selected="modelValue.startPolicy.events?.includes(event)"
              :value="event"
            >
              {{
                event === 'workflow.result.applied'
                  ? '前置流程结果已应用'
                  : event
              }}
            </option>
          </select>
        </label>
        <label>
          受限执行主体

          <select
            :disabled="readonly"
            :value="modelValue.startPolicy.servicePrincipal"
            @change="updatePolicy({ servicePrincipal: text($event) })"
          >
            <option value="">请选择执行主体</option>

            <option
              v-for="user in options.users"
              :key="user.id"
              :value="user.value ?? user.id"
            >
              {{ user.label }}
            </option>
          </select>
        </label>
      </div>
      <p v-if="modelValue.startPolicy?.mode === 'event'" class="hint">
        自动执行账户必须是类型为 workflow-service
        的非管理员账户，并已授予受限数据范围。发布者需具有
        workflow.runtime.delegate 权限；系统不会自动使用当前登录账户。
      </p>
      <h3>业务启动条件</h3>
      <WorkflowConditionEditor
        :model-value="modelValue.startPolicy?.condition"
        :validators="business?.validators"
        :variables="modelValue.variables"
        :readonly="readonly"
        allow-dependencies
        @update:model-value="updatePolicy({ condition: $event })"
      />
      <h3>前置用途依赖</h3>
      <p class="hint">
        仅同一业务对象、本轮最新有效且业务结果已应用的实例可满足依赖。流程结束不等于通过。
      </p>
      <WorkflowConditionEditor
        :model-value="modelValue.dependencies"
        :validators="business?.validators"
        :variables="modelValue.variables"
        :readonly="readonly"
        :purpose-options="options.purposeOptions"
        allow-dependencies
        @update:model-value="
          updateDefinition((draft) => {
            draft.dependencies = $event;
          })
        "
      />
    </div>

    <!-- 直接使用适配后的 lowflow-design 画布；发布验证仍以服务端为准。 -->
    <div v-if="activeTab === 'graph'" class="panel">
      <div class="toolbar">
        <button
          :disabled="readonly"
          type="button"
          @click="createNode('userTask')"
        >
          新增审批节点
        </button>
        <button
          :disabled="readonly"
          type="button"
          @click="createNode('exclusiveGateway')"
        >
          新增条件分支
        </button>
        <button
          :disabled="readonly"
          type="button"
          @click="createNode('parallelGateway')"
        >
          新增并行网关
        </button>
        <button :disabled="readonly" type="button" @click="createOutcomeExit">
          新增不同结果出口
        </button>
        <button :disabled="readonly" type="button" @click="autoLayout">
          自动排布
        </button>
      </div>
      <p v-if="graphEditError" class="graph-error" role="alert">
        {{ graphEditError }}
      </p>
      <div class="graph-layout">
        <div>
          <div class="canvas-scroll">
            <FlowDesign
              v-if="lowflowGraph.tree"
              :process="lowflowGraph.tree"
              :read-only="readonly"
              :selected-node-id="selectedNodeId"
              :selected-edge-id="selectedEdgeId"
              @node-click="
                (id) => {
                  graphEditError = '';
                  selectedNodeId = id;
                  selectedEdgeId = '';
                }
              "
              @edge-click="
                (id) => {
                  graphEditError = '';
                  selectedEdgeId = id;
                  selectedNodeId = '';
                }
              "
            />
            <p v-else class="graph-error" role="alert">
              {{ lowflowGraph.error }}。请检查节点与连线后再模拟或发布。
            </p>
          </div>
          <h3>树内连线</h3>
          <p class="hint">
            新增连接须选择现有连线或分支，由树内结构操作原子完成；不允许创建游离边。
          </p>
          <div v-for="edge in graph?.edges" :key="edge.id" class="list-row">
            <button
              type="button"
              @click="
                selectedEdgeId = edge.id;
                selectedNodeId = '';
              "
            >
              {{
                nodes.find((node) => node.id === edge.source)?.name ??
                edge.source
              }}

              →

              {{
                nodes.find((node) => node.id === edge.target)?.name ??
                edge.target
              }}

              {{
                edge.default ? '（默认）' : edge.condition ? '（有条件）' : ''
              }}
            </button>
          </div>
          <h3>节点清单</h3>
          <div v-for="node in nodes" :key="node.id" class="list-row">
            <button
              type="button"
              :aria-label="`配置节点 ${node.name}`"
              @click="
                selectedNodeId = node.id;
                selectedEdgeId = '';
              "
            >
              {{ node.name }} · {{ node.id }}
            </button>
          </div>
        </div>
        <aside class="node-properties" aria-label="节点属性">
          <template v-if="selectedNode">
            <h3>节点属性 · {{ selectedNode.id }}</h3>

            <label>
              节点名称
              <input
                :disabled="readonly"
                :value="selectedNode.name"
                @input="updateNode({ name: text($event) })"
              />
            </label>

            <div class="form-grid">
              <label>
                横向位置
                <input
                  type="number"
                  :disabled="readonly"
                  :value="selectedNode.x"
                  @input="updateNode({ x: Math.max(0, Number(text($event))) })"
                />
              </label>
              <label>
                纵向位置
                <input
                  type="number"
                  :disabled="readonly"
                  :value="selectedNode.y"
                  @input="updateNode({ y: Math.max(0, Number(text($event))) })"
                />
              </label>
            </div>
            <template v-if="selectedNode.type === 'userTask'">
              <label>
                候选用户

                <select
                  multiple
                  :disabled="readonly"
                  @change="updateNode({ candidateUsers: values($event) })"
                >
                  <option
                    v-for="user in options.users"
                    :key="user.id"
                    :selected="
                      selectedNode.candidateUsers?.includes(
                        user.value ?? user.id,
                      )
                    "
                    :value="user.value ?? user.id"
                  >
                    {{ user.label }}
                  </option>
                </select>
              </label>
              <label>
                候选角色 / 组织

                <select
                  multiple
                  :disabled="readonly"
                  @change="updateNode({ candidateGroups: values($event) })"
                >
                  <option
                    v-for="group in options.groups"
                    :key="group.id"
                    :selected="
                      selectedNode.candidateGroups?.includes(
                        group.value ?? group.id,
                      )
                    "
                    :value="group.value ?? group.id"
                  >
                    {{ group.label }}
                  </option>
                </select>
              </label>
              <label>
                动态审批人
                <select
                  aria-label="动态审批人解析器"
                  :disabled="readonly || !business"
                  :value="selectedNode.approverResolver?.key ?? ''"
                  @change="selectApproverResolver(text($event))"
                >
                  <option value="">不使用动态审批人</option>
                  <option
                    v-for="[key, resolver] in approverResolvers"
                    :key="key"
                    :value="key"
                  >
                    {{ resolver.title }}
                  </option>
                </select>
              </label>
              <p v-if="approverResolvers.length === 0" class="hint">
                当前业务契约未公开可用的动态审批人能力。
              </p>
              <p
                v-if="
                  selectedNode.approverResolver && !selectedApproverResolver
                "
                class="hint"
              >
                已配置的动态审批人不在当前授权目录中，请重新选择业务契约或解析器。
              </p>
              <div
                v-if="selectedNode.approverResolver && selectedApproverResolver"
                class="parameter-editor"
              >
                <p class="hint">
                  {{
                    selectedApproverResolver.title
                  }}：进入节点时由服务端解析并校验实际候选人。
                </p>
                <WorkflowParameterEditor
                  :readonly="readonly"
                  :model-value="selectedNode.approverResolver.parameters ?? {}"
                  :parameters="selectedApproverResolver.parameters ?? {}"
                  :variables="modelValue.variables ?? {}"
                  @update:model-value="
                    updateNode({
                      approverResolver: {
                        key: selectedNode!.approverResolver!.key,
                        parameters: $event,
                      },
                    })
                  "
                />
              </div>
              <label>
                多人审批方式

                <select
                  :disabled="readonly"
                  :value="selectedNode.multiApprovalMode ?? 'NONE'"
                  @change="
                    updateNode({
                      multiApprovalMode: text(
                        $event,
                      ) as WorkflowNode['multiApprovalMode'],
                    })
                  "
                >
                  <option value="NONE">单人受理</option>

                  <option value="ALL">会签：全部通过</option>

                  <option value="ANY">或签：任一通过</option>
                </select>
              </label>

              <p class="hint">
                会签 /
                或签需配置至少两名明确用户或受控动态审批人，不能混用候选组；进入节点时按实际名单计算席位。
              </p>

              <label class="checkbox">
                <input
                  type="checkbox"
                  :disabled="readonly"
                  :checked="selectedNode.allowSelfApproval"
                  @change="updateNode({ allowSelfApproval: checked($event) })"
                />
                允许申请人自审
              </label>

              <label>
                允许动作

                <select
                  multiple
                  :disabled="readonly"
                  @change="updateNode({ actions: values($event) })"
                >
                  <option
                    v-for="action in actionOptions"
                    :key="action.value"
                    :selected="selectedNode.actions?.includes(action.value)"
                    :value="action.value"
                  >
                    {{ action.label }}
                  </option>
                </select>
              </label>

              <template
                v-if="
                  selectedNode.actions?.some((action) =>
                    ['transfer', 'delegate', 'add-sign'].includes(action),
                  )
                "
              >
                <label>
                  转办 / 委派 / 加签目标用户

                  <select
                    multiple
                    :disabled="readonly"
                    @change="
                      updateNode({ actionCandidateUsers: values($event) })
                    "
                  >
                    <option
                      v-for="user in options.users"
                      :key="user.id"
                      :selected="
                        selectedNode.actionCandidateUsers?.includes(
                          user.value ?? user.id,
                        )
                      "
                      :value="user.value ?? user.id"
                    >
                      {{ user.label }}
                    </option>
                  </select>
                </label>

                <label>
                  目标人员角色 / 组织

                  <select
                    multiple
                    :disabled="readonly"
                    @change="
                      updateNode({ actionCandidateGroups: values($event) })
                    "
                  >
                    <option
                      v-for="group in options.groups"
                      :key="group.id"
                      :selected="
                        selectedNode.actionCandidateGroups?.includes(
                          group.value ?? group.id,
                        )
                      "
                      :value="group.value ?? group.id"
                    >
                      {{ group.label }}
                    </option>
                  </select>
                </label>

                <p class="hint">
                  未单独配置时使用节点候选范围；运行时仍须校验目标人员资格。加签前置
                  / 后置由执行动作选择。
                </p>
              </template>

              <label v-if="selectedNode.actions?.includes('return')">
                允许退回节点

                <select
                  multiple
                  :disabled="readonly"
                  @change="updateNode({ returnTargets: values($event) })"
                >
                  <option
                    v-for="node in nodes.filter(
                      (item) =>
                        item.type === 'userTask' &&
                        item.id !== selectedNode!.id,
                    )"
                    :key="node.id"
                    :value="node.id"
                    :selected="selectedNode.returnTargets?.includes(node.id)"
                  >
                    {{ node.name }}
                  </option>
                </select>
              </label>

              <label>
                可读业务字段

                <select
                  multiple
                  :disabled="readonly"
                  @change="updateNode({ readableFields: values($event) })"
                >
                  <option
                    v-for="field in displayFields"
                    :key="field.key"
                    :selected="selectedNode.readableFields?.includes(field.key)"
                    :value="field.key"
                  >
                    {{ field.title }}
                  </option>
                </select>
              </label>
              <label>
                表单保存业务操作
                <select
                  :disabled="readonly"
                  :value="selectedNode.formAction ?? ''"
                  @change="
                    updateNode({ formAction: text($event) || undefined })
                  "
                >
                  <option value="">不写入业务字段</option>
                  <option
                    v-for="[key, action] in formActions"
                    :key="key"
                    :value="key"
                  >
                    {{ action.title }}
                  </option>
                </select>
              </label>
              <label>
                可编辑业务字段

                <select
                  multiple
                  :disabled="readonly"
                  @change="updateNode({ editableFields: values($event) })"
                >
                  <option
                    v-for="field in editableFields"
                    :key="field.key"
                    :selected="selectedNode.editableFields?.includes(field.key)"
                    :value="field.key"
                  >
                    {{ field.title }}
                  </option>
                </select>
              </label>
              <label>
                必填业务字段

                <select
                  multiple
                  :disabled="readonly"
                  @change="updateNode({ requiredFields: values($event) })"
                >
                  <option
                    v-for="field in displayFields.filter((item) =>
                      selectedNode?.editableFields?.includes(item.key),
                    )"
                    :key="field.key"
                    :value="field.key"
                    :selected="selectedNode.requiredFields?.includes(field.key)"
                  >
                    {{ field.title }}
                  </option>
                </select>
              </label>

              <label>
                二次验证

                <select
                  multiple
                  :disabled="readonly"
                  @change="updateNode({ stepUpVerifyTypes: values($event) })"
                >
                  <option
                    v-for="option in workflowVerificationOptions"
                    :key="option.value"
                    :value="option.value"
                    :selected="
                      selectedNode.stepUpVerifyTypes?.includes(option.value)
                    "
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <div class="form-grid">
                <label>
                  节点时限（分钟）
                  <input
                    type="number"
                    min="1"
                    step="1"
                    :disabled="readonly"
                    :value="selectedNode.deadlineMinutes"
                    @input="
                      updateNode({
                        deadlineMinutes: text($event)
                          ? Number(text($event))
                          : undefined,
                      })
                    "
                  />
                </label>
                <label>
                  提前催办（分钟）
                  <input
                    type="number"
                    min="1"
                    step="1"
                    :disabled="readonly"
                    :value="selectedNode.reminderMinutes"
                    @input="
                      updateNode({
                        reminderMinutes: text($event)
                          ? Number(text($event))
                          : undefined,
                      })
                    "
                  />
                </label>
              </div>
              <label v-if="selectedNode.deadlineMinutes">
                超时升级人员
                <select
                  multiple
                  :disabled="readonly"
                  @change="
                    updateNode({ deadlineEscalationUsers: values($event) })
                  "
                >
                  <option
                    v-for="user in options.users"
                    :key="user.id"
                    :selected="
                      selectedNode.deadlineEscalationUsers?.includes(
                        user.value ?? user.id,
                      )
                    "
                    :value="user.value ?? user.id"
                  >
                    {{ user.label }}
                  </option>
                </select>
              </label>
              <label>
                空审批人策略

                <select
                  :disabled="readonly"
                  :value="selectedNode.emptyAssigneePolicy ?? 'REJECT'"
                  @change="
                    updateNode({
                      emptyAssigneePolicy: text($event) as
                        | 'REJECT'
                        | 'ESCALATE',
                    })
                  "
                >
                  <option value="REJECT">阻断并提示</option>

                  <option value="ESCALATE">升级到指定人员或组</option>
                </select>
              </label>
              <label v-if="selectedNode.emptyAssigneePolicy === 'ESCALATE'">
                升级处理人

                <select
                  multiple
                  :disabled="readonly"
                  @change="
                    updateNode({ escalationCandidateUsers: values($event) })
                  "
                >
                  <option
                    v-for="user in options.users"
                    :key="user.id"
                    :selected="
                      selectedNode.escalationCandidateUsers?.includes(
                        user.value ?? user.id,
                      )
                    "
                    :value="user.value ?? user.id"
                  >
                    {{ user.label }}
                  </option>
                </select>
              </label>
              <label v-if="selectedNode.emptyAssigneePolicy === 'ESCALATE'">
                升级候选角色 / 组织

                <select
                  multiple
                  :disabled="readonly"
                  :value="selectedNode.escalationCandidateGroups ?? []"
                  @change="
                    updateNode({ escalationCandidateGroups: values($event) })
                  "
                >
                  <option
                    v-for="group in options.groups"
                    :key="group.id"
                    :value="group.value ?? group.id"
                  >
                    {{ group.label }}
                  </option>
                </select>
              </label>
            </template>

            <label v-if="selectedNode.type === 'parallelGateway'">
              对应汇聚网关（分叉节点必填）

              <select
                :disabled="readonly"
                :value="selectedNode.joinId ?? ''"
                @change="updateNode({ joinId: text($event) || undefined })"
              >
                <option value="">此节点为汇聚</option>

                <option
                  v-for="node in nodes.filter(
                    (item) =>
                      item.type === 'parallelGateway' &&
                      item.id !== selectedNode!.id,
                  )"
                  :key="node.id"
                  :value="node.id"
                >
                  {{ node.name }}
                </option>
              </select>
            </label>

            <label v-if="selectedNode.type === 'end'">
              流程最终结果

              <select
                :disabled="readonly"
                :value="selectedNode.outcome"
                @change="updateNode({ outcome: text($event) })"
              >
                <option
                  v-for="result in outcomes"
                  :key="result.value"
                  :value="result.value"
                >
                  {{ result.label }}
                </option>
              </select>
            </label>

            <button
              v-if="selectedNode.type !== 'start'"
              type="button"
              :disabled="readonly"
              class="danger"
              @click="deleteSelectedNode"
            >
              删除当前节点
            </button>
          </template>
          <template v-else-if="selectedEdge">
            <h3>连线条件 · {{ selectedEdge.id }}</h3>

            <label v-if="selectedEdgeIsExclusive" class="checkbox">
              <input
                type="checkbox"
                :disabled="readonly"
                :checked="selectedEdge.default"
                @change="updateEdge({ default: checked($event) })"
              />
              默认分支
            </label>
            <WorkflowConditionEditor
              v-if="!selectedEdge.default && selectedEdgeIsExclusive"
              :model-value="selectedEdge.condition"
              :validators="business?.validators"
              :variables="modelValue.variables"
              :readonly="readonly"
              @update:model-value="updateEdge({ condition: $event ?? null })"
            />
            <p v-if="!selectedEdgeIsExclusive" class="hint">
              此连线没有可编辑的路由条件；可选中它插入节点。
            </p>
          </template>
          <p v-else class="hint">
            选择画布节点或连线配置属性。调整位置不会改变流程执行顺序。
          </p>
        </aside>
      </div>
    </div>

    <!-- 最终结果动作与节点动作分开配置，允许仅记录结果而不写业务字段。 -->
    <div v-if="activeTab === 'outcomes'" class="panel">
      <h3>最终结果处理</h3>
      <p class="hint">
        可只记录流程结果。需要回写业务时，选择业务目录公开的动作；全部必要动作成功后才解锁后续流程。
      </p>
      <div class="inline-form">
        <label>
          最终结果

          <select v-model="outcome" :disabled="readonly">
            <option
              v-for="result in outcomes"
              :key="result.value"
              :value="result.value"
            >
              {{ result.label }}
            </option>
          </select>
        </label>
        <label>
          业务操作

          <select v-model="outcomeAction" :disabled="readonly">
            <option value="">选择公开操作</option>

            <option
              v-for="(action, key) in business?.actions"
              :key="key"
              :value="key"
            >
              {{ action.title }}
            </option>
          </select>
        </label>
        <button
          type="button"
          :disabled="readonly || !outcomeAction"
          @click="addOutcomeAction"
        >
          添加结果操作
        </button>
      </div>
      <section
        v-for="(actions, result) in modelValue.outcomeActions"
        :key="result"
      >
        <h4>
          {{ outcomes.find((item) => item.value === result)?.label ?? result }}
        </h4>
        <div
          v-for="(action, index) in actions"
          :key="index"
          class="action-card"
        >
          <div class="list-row">
            <strong>
              {{ index + 1 }}.
              {{ business?.actions?.[action.action]?.title ?? action.action }}
            </strong>
            <button
              type="button"
              :disabled="readonly"
              @click="
                updateDefinition((draft) => {
                  draft.outcomeActions![result]!.splice(index, 1);
                })
              "
            >
              移除结果操作
            </button>
          </div>
          <WorkflowParameterEditor
            :model-value="action.parameters"
            :parameters="business?.actions?.[action.action]?.parameters"
            :variables="modelValue.variables"
            :readonly="readonly"
            @update:model-value="
              updateDefinition((draft) => {
                draft.outcomeActions![result]![index]!.parameters = $event;
              })
            "
          />
        </div>
      </section>
    </div>
    <div v-if="activeTab === 'preview'" class="panel">
      <h3>只读配置预览</h3>
      <pre>{{ JSON.stringify(modelValue, null, 2) }}</pre>
    </div>

    <!-- 校验结果按实际配置重新计算，发布资格仍由服务端模拟报告决定。 -->
    <details class="validation" :open="validationMessages.length > 0">
      <summary>
        {{
          validationMessages.length > 0
            ? `设计校验：${validationMessages.length} 项待完善`
            : '本地结构校验通过'
        }}
      </summary>
      <ul>
        <li v-for="message in validationMessages" :key="message">
          {{ message }}
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
/* 所有颜色跟随框架语义变量，表单在窄屏自然折行。 */
.workflow-designer {
  color: hsl(var(--foreground));
}
.definition-header,
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
}
.definition-header,
.panel,
.validation {
  padding: 1rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  min-width: 0;
}
input,
select,
button {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  padding: 0.5rem 0.65rem;
  min-width: 0;
}
select[multiple] {
  min-height: 6rem;
}
button {
  cursor: pointer;
}
button:disabled,
input:disabled,
select:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
button:hover:not(:disabled) {
  border-color: hsl(var(--primary));
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
.designer-tabs,
.toolbar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}
.designer-tabs .active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}
h3 {
  font-weight: 600;
  margin: 0.5rem 0 1rem;
}
h4 {
  font-weight: 600;
  margin: 1rem 0;
}
.hint {
  color: hsl(var(--muted-foreground));
  margin: 0.5rem 0 1rem;
}
.inline-form {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  flex-wrap: wrap;
  margin: 1rem 0;
}
.inline-form label {
  flex: 1;
  min-width: 150px;
  margin: 0;
}
.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid hsl(var(--border));
}
.graph-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  gap: 1rem;
}
.canvas-scroll {
  overflow: auto;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}
.graph-error {
  color: hsl(var(--destructive));
  padding: 1rem;
}
.node-properties {
  padding: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}
.checkbox {
  flex-direction: row;
  align-items: center;
}
.danger {
  color: hsl(var(--destructive));
}
.action-card {
  padding: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
}
.validation {
  margin-top: 1rem;
}
.validation ul {
  margin: 0.75rem 0 0 1.25rem;
  list-style: disc;
}
table {
  width: 100%;
  text-align: left;
}
td,
th {
  padding: 0.5rem;
  border-bottom: 1px solid hsl(var(--border));
}
pre {
  overflow: auto;
  max-height: 36rem;
  white-space: pre;
}
@media (max-width: 1000px) {
  .graph-layout {
    grid-template-columns: 1fr;
  }
}
</style>
