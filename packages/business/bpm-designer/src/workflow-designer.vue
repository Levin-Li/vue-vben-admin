<script setup lang="ts">
import type {
  WorkflowDesignerDefinition,
  WorkflowDesignerOptions,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
} from './types';

import { computed, ref, watch } from 'vue';

import { addNode, removeNode, validateDefinition } from './definition-model';
import WorkflowConditionEditor from './workflow-condition-editor.vue';
import {
  applyGraphLayout,
  graphPosition as position,
  routeGraphEdge,
} from './workflow-graph-layout';
import WorkflowParameterEditor from './workflow-parameter-editor.vue';

// 所有编辑在独立 JSON 副本上进行，避免修改宿主 props 或 Vue 代理克隆失败。
const props = withDefaults(
  defineProps<{
    modelValue: WorkflowDesignerDefinition;
    options?: WorkflowDesignerOptions;
    readonly?: boolean;
  }>(),
  { options: () => ({}) },
);
const emit = defineEmits<{
  'update:modelValue': [value: WorkflowDesignerDefinition];
  validate: [valid: boolean, messages: string[]];
}>();
const activeTab = ref('binding');
const selectedNodeId = ref('');
const selectedEdgeId = ref('');
const edgeSource = ref('');
const edgeTarget = ref('');
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
const nodes = computed(() => props.modelValue.nodes);
const selectedNode = computed(() =>
  nodes.value.find((node) => node.id === selectedNodeId.value),
);
const selectedEdge = computed(() =>
  props.modelValue.edges?.find((edge) => edge.id === selectedEdgeId.value),
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
  validateDefinition(props.modelValue, props.options),
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
const graphBounds = computed(() => {
  const positions = nodes.value.map((node, index) => position(node, index));
  const x = Math.min(0, ...positions.map((point) => point.x - 70));
  const y = Math.min(0, ...positions.map((point) => point.y - 70));
  return {
    x,
    y,
    width: Math.max(880, ...positions.map((point) => point.x + 250)) - x,
    height: Math.max(400, ...positions.map((point) => point.y + 140)) - y,
  };
});
const edgePaths = computed(
  () =>
    new Map(
      (props.modelValue.edges ?? []).map((edge, index) => {
        const points = routeGraphEdge(nodes.value, edge, index);
        return [
          edge.id,
          points
            .map(
              (point, pointIndex) =>
                `${pointIndex === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
            )
            .join(' '),
        ];
      }),
    ),
);
watch(
  validationMessages,
  (messages) => emit('validate', messages.length === 0, messages),
  { immediate: true },
);

function updateDefinition(
  mutator: (draft: WorkflowDesignerDefinition) => void,
) {
  if (props.readonly) return;
  // JSON为本接口唯一值域，序列化副本同时剥离嵌套Vue代理并省略未设置配置。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const draft = JSON.parse(
    JSON.stringify(props.modelValue),
  ) as WorkflowDesignerDefinition;
  mutator(draft);
  draft.schemaVersion = 2;
  emit('update:modelValue', draft);
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
  patch: Partial<NonNullable<WorkflowDesignerDefinition['startPolicy']>>,
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

// 图使用显式连线；节点位置只影响展示，不改变执行语义。
function createNode(type: WorkflowNodeType) {
  updateDefinition((draft) => {
    selectedNodeId.value = addNode(draft, type).id;
  });
  selectedEdgeId.value = '';
}
function deleteSelectedNode() {
  updateDefinition((draft) => removeNode(draft, selectedNodeId.value));
  selectedNodeId.value = '';
}
function updateNode(patch: Partial<WorkflowNode>) {
  updateDefinition((draft) => {
    const node = draft.nodes.find((item) => item.id === selectedNodeId.value);
    if (node) Object.assign(node, patch);
  });
}
function updateEdge(patch: Partial<WorkflowEdge>) {
  updateDefinition((draft) => {
    const edge = draft.edges?.find((item) => item.id === selectedEdgeId.value);
    if (edge) Object.assign(edge, patch);
  });
}
function addEdge() {
  if (
    !edgeSource.value ||
    !edgeTarget.value ||
    edgeSource.value === edgeTarget.value
  )
    return;
  updateDefinition((draft) => {
    draft.edges ??= [];
    let index = 1;
    while (draft.edges.some((edge) => edge.id === `flow_${index}`)) index++;
    const edge = {
      id: `flow_${index}`,
      source: edgeSource.value,
      target: edgeTarget.value,
    };
    draft.edges.push(edge);
    selectedEdgeId.value = edge.id;
    selectedNodeId.value = '';
  });
}
function edgePath(edge: WorkflowEdge) {
  return edgePaths.value.get(edge.id) ?? '';
}
function autoLayout() {
  updateDefinition(applyGraphLayout);
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

    <!-- SVG 图与连线编辑共同提供可访问的流程构建能力。 -->
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
        <button :disabled="readonly" type="button" @click="createNode('end')">
          新增结束节点
        </button>
        <button :disabled="readonly" type="button" @click="autoLayout">
          自动排布
        </button>
      </div>
      <div class="graph-layout">
        <div>
          <div class="canvas-scroll">
            <svg
              class="workflow-canvas"
              role="img"
              aria-label="流程节点与连线图"
              :viewBox="`${graphBounds.x} ${graphBounds.y} ${graphBounds.width} ${graphBounds.height}`"
              :style="{
                minHeight: `${graphBounds.height}px`,
                minWidth: `${Math.max(680, graphBounds.width * 0.7)}px`,
              }"
            >
              <defs>
                <marker
                  id="workflow-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
              </defs>
              <g
                v-for="edge in modelValue.edges"
                :key="edge.id"
                role="button"
                tabindex="0"
                :aria-label="`连线 ${edge.source} 到 ${edge.target}`"
                @click="
                  selectedEdgeId = edge.id;
                  selectedNodeId = '';
                "
                @keydown.enter="
                  selectedEdgeId = edge.id;
                  selectedNodeId = '';
                "
              >
                <path :d="edgePath(edge)" class="edge-hit" />
                <path
                  :d="edgePath(edge)"
                  class="edge"
                  :class="[{ selected: selectedEdgeId === edge.id }]"
                  marker-end="url(#workflow-arrow)"
                />
              </g>
              <g
                v-for="(node, index) in nodes"
                :key="node.id"
                role="button"
                tabindex="0"
                :aria-label="`配置节点 ${node.name}`"
                :transform="`translate(${position(node, index).x}, ${position(node, index).y})`"
                class="graph-node"
                :class="[{ selected: selectedNodeId === node.id }]"
                @click="
                  selectedNodeId = node.id;
                  selectedEdgeId = '';
                "
                @keydown.enter="
                  selectedNodeId = node.id;
                  selectedEdgeId = '';
                "
              >
                <rect
                  width="180"
                  height="64"
                  :rx="node.type === 'start' || node.type === 'end' ? 30 : 8"
                />
                <text x="12" y="25">
                  {{
                    node.name.length > 15
                      ? `${node.name.slice(0, 15)}…`
                      : node.name
                  }}
                </text>
                <text x="12" y="47" class="node-type">
                  {{ node.type }}
                  {{
                    node.multiApprovalMode === 'ALL'
                      ? '会签'
                      : node.multiApprovalMode === 'ANY'
                        ? '或签'
                        : ''
                  }}
                </text>
              </g>
            </svg>
          </div>
          <h3>新增连线</h3>
          <div class="inline-form">
            <label>
              起点

              <select v-model="edgeSource" :disabled="readonly">
                <option value="">选择起点</option>

                <option
                  v-for="node in nodes.filter((item) => item.type !== 'end')"
                  :key="node.id"
                  :value="node.id"
                >
                  {{ node.name }}
                </option>
              </select>
            </label>
            <label>
              终点

              <select v-model="edgeTarget" :disabled="readonly">
                <option value="">选择终点</option>

                <option
                  v-for="node in nodes.filter((item) => item.type !== 'start')"
                  :key="node.id"
                  :value="node.id"
                >
                  {{ node.name }}
                </option>
              </select>
            </label>
            <button
              type="button"
              :disabled="
                readonly ||
                !edgeSource ||
                !edgeTarget ||
                edgeSource === edgeTarget
              "
              @click="addEdge"
            >
              连接节点
            </button>
          </div>
          <div v-for="edge in modelValue.edges" :key="edge.id" class="list-row">
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
            <button
              type="button"
              :disabled="readonly"
              @click="
                updateDefinition((draft) => {
                  draft.edges = draft.edges?.filter(
                    (item) => item.id !== edge.id,
                  );
                })
              "
            >
              删除连线
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
                会签 / 或签需配置至少两名明确用户，不能混用候选组。
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
                    v-for="kind in ['Captcha', 'Hmi', 'Sms', 'Email', 'Mfa']"
                    :key="kind"
                    :value="kind"
                    :selected="selectedNode.stepUpVerifyTypes?.includes(kind)"
                  >
                    {{ kind }}
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

                  <option value="ESCALATE">升级到指定人员</option>
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

            <label class="checkbox">
              <input
                type="checkbox"
                :disabled="readonly"
                :checked="selectedEdge.default"
                @change="
                  updateEdge({
                    default: checked($event),
                    condition: checked($event)
                      ? undefined
                      : selectedEdge.condition,
                  })
                "
              />
              默认分支
            </label>
            <WorkflowConditionEditor
              v-if="!selectedEdge.default"
              :model-value="selectedEdge.condition"
              :validators="business?.validators"
              :variables="modelValue.variables"
              :readonly="readonly"
              @update:model-value="updateEdge({ condition: $event })"
            />
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
.workflow-canvas {
  width: 100%;
  min-width: 680px;
  color: hsl(var(--muted-foreground));
}
.edge {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.edge.selected {
  color: hsl(var(--primary));
  stroke-width: 3;
}
.edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 16;
  cursor: pointer;
}
.graph-node {
  cursor: pointer;
}
.graph-node rect {
  fill: hsl(var(--card));
  stroke: hsl(var(--border));
  stroke-width: 2;
}
.graph-node.selected rect {
  stroke: hsl(var(--primary));
}
.graph-node text {
  fill: hsl(var(--foreground));
  font-size: 14px;
}
.graph-node .node-type {
  fill: hsl(var(--muted-foreground));
  font-size: 11px;
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
