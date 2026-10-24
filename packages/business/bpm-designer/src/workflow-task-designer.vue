<script setup lang="ts">
import type {
  WorkflowDesignerOptions,
  WorkflowNode,
  WorkflowOperand,
  WorkflowVariable,
} from './types';
import type {
  WorkflowTaskEdge,
  WorkflowTaskGraph,
  WorkflowTaskNode,
  WorkflowTaskStep,
} from './workflow-task-graph';

import { computed, ref, watch } from 'vue';

import { UserOrgSelector } from '@levin/admin-framework';
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  CollapsePanel,
  Form,
  Input,
  InputNumber,
  Select,
} from 'ant-design-vue';

import { definitionFingerprint } from './definition-model';
import WorkflowConditionEditor from './workflow-condition-editor.vue';
import WorkflowGraphCanvas from './workflow-graph-canvas.vue';
import WorkflowNotificationEditor from './workflow-notification-editor.vue';
import {
  buildStateVariables,
  renameStateCondition,
} from './workflow-state-variables';
import {
  addParallelBranch,
  addTaskResultBranches,
  cloneTaskGraph,
  connectTaskNodes,
  eligibleTaskReturnTargets,
  insertTaskStep,
  isParallelBranchEdge,
  layoutTaskGraph,
  removeTaskNode,
  taskNodeSummary,
  taskParallelGroup,
  validateTaskGraph,
} from './workflow-task-graph';

const props = withDefaults(
  defineProps<{
    modelValue: WorkflowTaskGraph;
    options?: WorkflowDesignerOptions;
    readonly?: boolean;
  }>(),
  { options: () => ({}), readonly: false },
);
const emit = defineEmits<{
  'update:modelValue': [value: WorkflowTaskGraph];
  validate: [valid: boolean, messages: string[]];
}>();
const selectedNodeId = ref('start');
const selectedEdgeId = ref('');
const insertEdgeId = ref('');
const error = ref('');
const showErrors = ref(false);
const node = computed(() =>
  props.modelValue.nodes.find((item) => item.id === selectedNodeId.value),
);
const edge = computed(() =>
  props.modelValue.edges.find((item) => item.id === selectedEdgeId.value),
);
const returnOptions = computed(() =>
  eligibleTaskReturnTargets(props.modelValue, selectedNodeId.value).map(
    (item) => ({ value: item.id, label: item.name }),
  ),
);
const outgoing = computed(() =>
  props.modelValue.edges.filter((item) => item.source === node.value?.id),
);
const business = computed(() =>
  props.options.stateBusinessObjects?.find(
    (item) =>
      item.entityKey === props.modelValue.businessBinding.businessEntityKey,
  ),
);
const fields = computed(() => business.value?.fields ?? []);
const fieldOptions = computed(() =>
  fields.value.map((field) => ({ label: field.title, value: field.key })),
);
const editableOptions = computed(() =>
  fields.value
    .filter(
      (field) =>
        field.editable === true &&
        field.key !== props.modelValue.businessBinding.stateField,
    )
    .map((field) => ({ label: field.title, value: field.key })),
);
const variablePlan = computed(() =>
  buildStateVariables(
    fields.value.filter((field) => field.conditionAllowed === true),
    props.modelValue.variables,
  ),
);
const variables = computed<Record<string, WorkflowVariable>>(() => ({
  ...variablePlan.value.variables,
  ...Object.fromEntries(
    props.modelValue.nodes
      .filter((item) => item.type === 'userTask')
      .map((item) => [
        `taskResult_${item.id}`,
        {
          source: `taskResult_${item.id}`,
          readAt: 'node' as const,
          type: 'string' as const,
        },
      ]),
  ),
}));
const variableLabels = computed(() =>
  Object.fromEntries(
    Object.entries(variables.value).map(([key, variable]) => [
      key,
      key.startsWith('taskResult_')
        ? `${props.modelValue.nodes.find((item) => `taskResult_${item.id}` === key)?.name ?? key} · 审批结果`
        : (fields.value.find(
            (field) => `business.${field.key}` === variable.source,
          )?.title ?? key),
    ]),
  ),
);
const variableOptions = computed(() =>
  Object.fromEntries(
    Object.entries(variables.value).map(([key, variable]) => [
      key,
      key.startsWith('taskResult_')
        ? [
            { label: '通过', value: 'Approved' },
            { label: '驳回', value: 'Rejected' },
          ]
        : (fields.value.find(
            (field) => `business.${field.key}` === variable.source,
          )?.options ?? []),
    ]),
  ),
);
const errors = computed(() => validateTaskGraph(props.modelValue));
const highlighted = computed(() =>
  taskParallelGroup(props.modelValue, selectedNodeId.value),
);
// 缺省坐标只用于展示；打开只读版本不能触发保存或改变草稿指纹。
const displayGraph = computed(() => {
  if (
    props.modelValue.nodes.every(
      (item) => item.x !== undefined && item.y !== undefined,
    )
  )
    return props.modelValue;
  const graph = layoutTaskGraph(cloneTaskGraph(props.modelValue));
  graph.nodes = graph.nodes.map((item) => {
    const original = props.modelValue.nodes.find((node) => node.id === item.id);
    return { ...item, x: original?.x ?? item.x, y: original?.y ?? item.y };
  });
  return graph;
});
const stateFieldTitle = computed(
  () =>
    fields.value.find(
      (field) => field.key === props.modelValue.businessBinding.stateField,
    )?.title ?? props.modelValue.businessBinding.stateField,
);
function nodeSummary(item: WorkflowTaskNode) {
  const summary = taskNodeSummary(item, props.modelValue);
  if (item.type !== 'serviceTask') return summary;
  return `${stateFieldTitle.value}${summary.slice(props.modelValue.businessBinding.stateField.length)}`;
}
const canvasNodes = computed(() =>
  displayGraph.value.nodes.map((item) => {
    let type:
      | 'endEvent'
      | 'startEvent'
      | Exclude<WorkflowTaskNode['type'], 'end' | 'start'>;
    if (item.type === 'start') type = 'startEvent';
    else if (item.type === 'end') type = 'endEvent';
    else type = item.type;
    return {
      ...item,
      type,
      stateLabel:
        item.type === 'start' && item.startCondition
          ? `启动条件：${conditionSummary(item.startCondition)}`
          : nodeSummary(item),
    };
  }),
);
const canvasEdges = computed(() =>
  props.modelValue.edges.map((item) => {
    let label = item.name || '继续';
    if (item.default) label = `${item.name || '其他情况'} · 默认`;
    else if (item.condition)
      label = `${item.name || '符合条件'} · ${conditionSummary(item.condition)}`;
    return { ...item, label };
  }),
);
const notificationNode = computed<undefined | WorkflowNode>(() =>
  node.value
    ? {
        id: node.value.id,
        name: node.value.name,
        type: 'start',
        notifications: node.value.notifications?.filter(
          (item) =>
            item.event === 'NodeEntered' || item.event === 'NodeCompleted',
        ),
      }
    : undefined,
);
const taskNotificationNode = computed<undefined | WorkflowNode>(() =>
  node.value?.type === 'userTask'
    ? {
        id: node.value.id,
        name: node.value.name,
        type: 'userTask',
        notifications: node.value.notifications?.filter((item) =>
          item.event.startsWith('Task'),
        ),
      }
    : undefined,
);
const stepOptions: { hint: string; kind: WorkflowTaskStep; title: string }[] = [
  { kind: 'userTask', title: '人工办理', hint: '填写资料、审批、会签' },
  { kind: 'serviceTask', title: '自动处理', hint: '明确更新业务状态' },
  {
    kind: 'condition',
    title: '按条件分路',
    hint: '满足条件走一路，其他走默认路线',
  },
  { kind: 'parallel', title: '同时办理', hint: '各路同时开始，全部完成后继续' },
];
const approvalOptions = [
  { value: 'NONE', label: '单人办理：一人领取并完成' },
  { value: 'ALL', label: '会签：所有人通过' },
  { value: 'ANY', label: '或签：任意一人通过' },
  { value: 'SEQUENTIAL', label: '顺签：按人员顺序办理' },
];
watch(errors, (messages) => emit('validate', messages.length === 0, messages), {
  immediate: true,
});

// 路线直接显示业务中文条件，避免只有技术标记而无法读图。
function conditionSummary(value: WorkflowTaskEdge['condition']): string {
  if (!value) return '无附加条件';
  if (value.all)
    return value.all.map((item) => conditionSummary(item)).join(' 且 ');
  if (value.any)
    return value.any.map((item) => conditionSummary(item)).join(' 或 ');
  if (value.not) return `不满足（${conditionSummary(value.not)}）`;
  const labels: Record<string, string> = {
    eq: '＝',
    ne: '≠',
    gt: '＞',
    gte: '≥',
    lt: '＜',
    lte: '≤',
    in: '属于',
  };
  for (const [key, label] of Object.entries(labels)) {
    const operands = (value as Record<string, unknown>)[key] as
      | undefined
      | WorkflowOperand[];
    if (!Array.isArray(operands)) continue;
    const variable = operands[0]?.variable ?? '';
    const options = variableOptions.value[variable] ?? [];
    return operands
      .map((operand) => {
        if (operand.variable)
          return variableLabels.value[operand.variable] ?? operand.variable;
        const option = options.find(
          (item) => typeof item === 'object' && item.value === operand.literal,
        );
        return typeof option === 'object'
          ? option.label
          : String(operand.literal ?? '空');
      })
      .join(` ${label} `);
  }
  if (value.exists)
    return `${variableLabels.value[value.exists.variable ?? ''] ?? '字段'}存在`;
  if (value.isNull)
    return `${variableLabels.value[value.isNull.variable ?? ''] ?? '字段'}为空`;
  return '已配置业务条件';
}
// 选择只改变侧栏，不污染父层草稿或发布版本。
function selectNode(id: string) {
  selectedNodeId.value = id;
  selectedEdgeId.value = '';
  insertEdgeId.value = '';
}
function selectEdge(id: string) {
  selectedEdgeId.value = id;
  selectedNodeId.value = '';
  insertEdgeId.value = '';
}
function commit(value: WorkflowTaskGraph) {
  if (
    props.readonly ||
    definitionFingerprint(value) === definitionFingerprint(props.modelValue)
  )
    return;
  error.value = '';
  emit('update:modelValue', value);
}
function edit(update: (value: WorkflowTaskGraph) => void) {
  if (props.readonly) return;
  const value = cloneTaskGraph(props.modelValue);
  update(value);
  commit(value);
}
function attempt(action: () => void) {
  if (props.readonly) return;
  try {
    action();
  } catch (error_) {
    error.value =
      error_ instanceof Error ? error_.message : '操作未完成，请检查连接。';
  }
}
function patchNode(patch: Partial<WorkflowTaskNode>) {
  edit((graph) => {
    const current = graph.nodes.find((item) => item.id === node.value?.id);
    if (!current) return;
    Object.assign(current, patch);
    if (patch.readableFields)
      current.editableFields = current.editableFields?.filter((field) =>
        patch.readableFields!.includes(field),
      );
    if (patch.readableFields || patch.editableFields) {
      current.requiredFields = current.requiredFields?.filter((field) =>
        current.editableFields?.includes(field),
      );
      for (const form of Object.values(current.actionForms ?? {})) {
        if (form.editableFields)
          form.editableFields = form.editableFields.filter((field) =>
            current.editableFields?.includes(field),
          );
        if (form.requiredFields)
          form.requiredFields = form.requiredFields.filter((field) =>
            (form.editableFields ?? current.editableFields)?.includes(field),
          );
      }
    }
    if (patch.actions && !patch.actions.includes('return'))
      delete current.returnTargets;
    if (patch.actions && current.actionForms)
      current.actionForms = Object.fromEntries(
        Object.entries(current.actionForms).filter(([action]) =>
          patch.actions!.includes(action),
        ),
      );
  });
}
function patchEdge(patch: Partial<WorkflowTaskEdge>) {
  edit((graph) => {
    const current = graph.edges.find((item) => item.id === edge.value?.id);
    if (current) Object.assign(current, patch);
  });
}
function chooseInsertion(id: string) {
  selectNode(id);
  if (outgoing.value.length === 1) insertEdgeId.value = outgoing.value[0]!.id;
  else error.value = '请点击需要插入步骤的流转路线，再选择添加步骤。';
}
function insert(kind: WorkflowTaskStep) {
  attempt(() => {
    const before = new Set(props.modelValue.nodes.map((item) => item.id));
    const graph = insertTaskStep(props.modelValue, insertEdgeId.value, kind);
    commit(graph);
    selectedNodeId.value =
      graph.nodes.find((item) => !before.has(item.id))?.id ?? '';
    selectedEdgeId.value = '';
    insertEdgeId.value = '';
  });
}
function connect(source: string, target: string) {
  attempt(() => {
    const graph = connectTaskNodes(props.modelValue, source, target);
    commit(graph);
    selectEdge(graph.edges.at(-1)!.id);
  });
}
function moveRoute(id: string, direction: number) {
  edit((graph) => {
    const current = graph.edges.findIndex((item) => item.id === id);
    const route = graph.edges[current];
    if (!route) return;
    const siblings = graph.edges
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.source === route.source && !item.default);
    const position = siblings.findIndex(({ item }) => item.id === id);
    const other = siblings[position + direction];
    if (!other) return;
    graph.edges[current] = other.item;
    graph.edges[other.index] = route;
  });
}
function setDefault(checked: boolean) {
  edit((graph) => {
    const current = graph.edges.find((item) => item.id === edge.value?.id);
    if (!current) return;
    if (checked)
      graph.edges
        .filter((item) => item.source === current.source)
        .forEach((item) => {
          item.default = item.id === current.id;
        });
    else current.default = false;
    if (checked) delete current.condition;
  });
}
function condition(value: WorkflowTaskEdge['condition']) {
  edit((graph) => {
    graph.variables = variablePlan.value.variables;
    const current = graph.edges.find((item) => item.id === edge.value?.id);
    if (current) current.condition = value;
  });
}
function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
function normalizedUserId(value: string) {
  return value.startsWith('user:') ? value.slice(5) : value;
}
function userLabel(value: string) {
  return (
    props.options.users?.find(
      (user) =>
        normalizedUserId(user.value || user.id) === normalizedUserId(value),
    )?.label ?? value
  );
}
function selectedRecords(values: string[] = []) {
  return values.flatMap((id) => {
    const label = userLabel(id);
    return label === id
      ? []
      : [{ id: normalizedUserId(id), name: label, kind: 'user' as const }];
  });
}
function updateNotifications(
  value: NonNullable<WorkflowTaskNode['notifications']>,
  tasks = false,
) {
  const retained =
    node.value?.notifications?.filter((item) =>
      tasks ? !item.event.startsWith('Task') : item.event.startsWith('Task'),
    ) ?? [];
  patchNode({ notifications: [...retained, ...value] });
}
function patchCopy(
  index: number,
  patch: Partial<NonNullable<WorkflowTaskNode['copies']>[number]>,
) {
  patchNode({
    copies: node.value?.copies?.map((copy, current) =>
      current === index ? { ...copy, ...patch } : copy,
    ),
  });
}
function actionLabel(action: string) {
  return (
    (
      { approve: '通过 / 提交', reject: '驳回', return: '退回修改' } as Record<
        string,
        string
      >
    )[action] ?? action
  );
}
function startCondition(value: WorkflowTaskNode['startCondition']) {
  edit((graph) => {
    const current = graph.nodes.find(
      (item) => item.id === node.value?.id && item.type === 'start',
    );
    if (!current) return;
    current.startCondition = value;
    graph.variables = variablePlan.value.variables;
  });
}
function actionRequired(action: string, value: unknown) {
  patchNode({
    actionForms: {
      ...node.value?.actionForms,
      [action]: {
        ...node.value?.actionForms?.[action],
        requiredFields: ids(value),
      },
    },
  });
}
function moveUser(index: number, direction: number) {
  const users = [...(node.value?.candidateUsers ?? [])];
  const value = users[index];
  if (
    value === undefined ||
    index + direction < 0 ||
    index + direction >= users.length
  )
    return;
  users.splice(index, 1);
  users.splice(index + direction, 0, value);
  patchNode({ candidateUsers: users });
}
function deleteNode() {
  attempt(() => {
    commit(removeTaskNode(props.modelValue, selectedNodeId.value));
    selectNode('start');
  });
}
</script>

<template>
  <div class="task-designer">
    <!-- 常用结构一键生成，当前对象决定侧栏配置。 -->
    <div class="task-toolbar">
      <div>
        <div class="task-section-title">流程图</div>
        <p class="task-hint">
          点击步骤或路线配置；从连接点拖线可连接已有步骤。
        </p>
      </div>
      <div class="task-toolbar-actions">
        <Button :disabled="readonly" @click="edit(layoutTaskGraph)">
          整理布局
        </Button>
        <Button @click="showErrors = !showErrors">
          检查流程<span v-if="errors.length > 0">（{{ errors.length }}）</span>
        </Button>
      </div>
    </div>
    <Alert
      v-if="error"
      type="warning"
      show-icon
      :message="error"
      closable
      @close="error = ''"
    />
    <Alert
      v-if="showErrors"
      :type="errors.length > 0 ? 'warning' : 'success'"
      :message="
        errors.length > 0
          ? '以下配置需要完善，草稿仍可保存'
          : '图形配置检查通过'
      "
      show-icon
    >
      <template v-if="errors.length > 0" #description>
        <ul class="task-errors">
          <li v-for="message in errors" :key="message">{{ message }}</li>
        </ul>
      </template>
    </Alert>
    <div class="task-body">
      <div class="task-canvas">
        <WorkflowGraphCanvas
          :nodes="canvasNodes"
          :edges="canvasEdges"
          :read-only="readonly"
          allow-selection
          :selected-node-id="selectedNodeId"
          :selected-edge-id="selectedEdgeId"
          :highlight-node-ids="highlighted"
          @node-click="selectNode"
          @edge-click="selectEdge"
          @add-from="chooseInsertion"
          @connect="connect"
          @move-node="
            (id, x, y) =>
              edit((graph) => {
                const current = graph.nodes.find((item) => item.id === id);
                if (current) Object.assign(current, { x, y });
              })
          "
        />
      </div>
      <aside class="task-sidebar">
        <section v-if="insertEdgeId" class="task-insert" aria-label="添加步骤">
          <h3>＋添加下一步</h3>
          <Button
            v-for="step in stepOptions"
            :key="step.kind"
            class="task-step-button"
            :disabled="
              readonly ||
              (step.kind === 'serviceTask' &&
                isParallelBranchEdge(modelValue, insertEdgeId))
            "
            @click="insert(step.kind)"
          >
            <div class="task-section-title">{{ step.title }}</div>
            <div class="task-hint">{{ step.hint }}</div>
          </Button>
          <p
            v-if="isParallelBranchEdge(modelValue, insertEdgeId)"
            class="task-hint"
          >
            状态更新请放在并行汇合之后，避免各路互相覆盖。
          </p>
          <Button type="link" @click="insertEdgeId = ''">返回配置</Button>
        </section>
        <Form v-else-if="node" layout="vertical">
          <h3>
            {{
              node.type === 'userTask'
                ? '人工办理'
                : node.type === 'serviceTask'
                  ? '自动处理'
                  : node.name
            }}
          </h3>
          <Form.Item label="名称">
            <Input
              :value="node.name"
              :disabled="readonly"
              @update:value="patchNode({ name: $event })"
            />
          </Form.Item>
          <p class="task-explanation">
            {{ nodeSummary(node) }}
          </p>
          <section v-if="node.type === 'start'" class="task-settings">
            <h4>启动条件</h4>
            <p class="task-hint">
              可选；发起时按业务字段判断，只有满足条件才能启动。当前尚未发生审批，不能用任务审批结果作为启动条件。
            </p>
            <WorkflowConditionEditor
              :model-value="
                renameStateCondition(
                  node.startCondition,
                  variablePlan.renamedAliases,
                )
              "
              :variables="variablePlan.variables"
              :variable-labels="variableLabels"
              :variable-options="variableOptions"
              :readonly="readonly"
              @update:model-value="startCondition"
            />
          </section>
          <template v-if="node.type === 'userTask'">
            <Form.Item label="办理人">
              <UserOrgSelector
                :model-value="node.candidateUsers ?? []"
                :selected-records="selectedRecords(node.candidateUsers)"
                :selectable-types="['user']"
                multiple
                :disabled="readonly"
                placeholder="选择办理人"
                @update:model-value="patchNode({ candidateUsers: ids($event) })"
              />
            </Form.Item>
            <Form.Item label="办理角色">
              <Select
                mode="multiple"
                :value="node.candidateGroups"
                :disabled="readonly"
                :options="
                  options.groups?.map((group) => ({
                    label: group.label,
                    value: group.value || group.id,
                  }))
                "
                placeholder="可选择有权办理的角色"
                @update:value="patchNode({ candidateGroups: ids($event) })"
              />
            </Form.Item>
            <Form.Item label="审批方式">
              <Select
                :value="node.multiApprovalMode"
                :disabled="readonly"
                :options="approvalOptions"
                @update:value="
                  patchNode({
                    multiApprovalMode:
                      $event as WorkflowTaskNode['multiApprovalMode'],
                  })
                "
              />
            </Form.Item>
            <p v-if="node.multiApprovalMode === 'ALL'" class="task-hint">
              每人分别收到待办，全部通过才完成此任务；一人驳回产生驳回结果。后续路线可按审批结果分路。
            </p>
            <p v-if="node.multiApprovalMode === 'ANY'" class="task-hint">
              任意一人通过即可完成；其余人的待办随之结束。
            </p>
            <div
              v-if="node.multiApprovalMode === 'SEQUENTIAL'"
              class="task-sequence"
            >
              <div v-for="(user, index) in node.candidateUsers" :key="user">
                <div class="task-sequence-name">
                  {{ index + 1 }}. {{ userLabel(user) }}
                </div>
                <Button
                  size="small"
                  :disabled="readonly || index === 0"
                  @click="moveUser(index, -1)"
                >
                  上移
                </Button>
                <Button
                  size="small"
                  :disabled="
                    readonly || index === (node.candidateUsers?.length ?? 0) - 1
                  "
                  @click="moveUser(index, 1)"
                >
                  下移
                </Button>
              </div>
            </div>
            <Checkbox
              :checked="node.allowSelfApproval"
              :disabled="readonly"
              @change="patchNode({ allowSelfApproval: $event.target.checked })"
            >
              允许申请人办理此步骤
            </Checkbox>
            <div v-if="node.actions?.includes('reject')" class="task-settings">
              <p class="task-hint">
                驳回必须配置结果分路，避免继续走通过路线。可以先生成通过 /
                驳回两路，再调整目标。
              </p>
              <Button
                :disabled="readonly"
                @click="
                  attempt(() =>
                    commit(addTaskResultBranches(modelValue, node!.id)),
                  )
                "
              >
                生成通过 / 驳回分路
              </Button>
            </div>
            <Collapse class="task-settings">
              <CollapsePanel key="form" header="办理表单与操作">
                <Form.Item label="可查看字段">
                  <Select
                    mode="multiple"
                    :value="node.readableFields"
                    :options="fieldOptions"
                    :disabled="readonly"
                    @update:value="patchNode({ readableFields: ids($event) })"
                  />
                </Form.Item>
                <Form.Item label="可填写字段">
                  <Select
                    mode="multiple"
                    :value="node.editableFields"
                    :options="editableOptions"
                    :disabled="readonly"
                    @update:value="patchNode({ editableFields: ids($event) })"
                  />
                </Form.Item>
                <Form.Item label="办理操作">
                  <Select
                    mode="multiple"
                    :value="node.actions"
                    :disabled="readonly"
                    :options="[
                      { value: 'approve', label: '通过 / 提交' },
                      { value: 'reject', label: '驳回（产生审批结果）' },
                      { value: 'return', label: '退回修改（回到前面办理）' },
                    ]"
                    @update:value="patchNode({ actions: ids($event) })"
                  />
                </Form.Item>
                <template v-if="node.actions?.includes('return')">
                  <Form.Item label="允许退回到">
                    <Select
                      mode="multiple"
                      :value="node.returnTargets ?? []"
                      :options="returnOptions"
                      :disabled="readonly"
                      placeholder="选择必经的前置办理步骤"
                      @update:value="patchNode({ returnTargets: ids($event) })"
                    />
                  </Form.Item>
                  <p class="task-hint">
                    退回会重新产生所选前置步骤的待办，填写完成后按原路线继续。只允许单人任务退回到必经的前置单人任务，不能跨并行范围；退回本身不修改业务状态。驳回是另一个操作，只产生驳回结果并按路线继续。
                  </p>
                  <p v-if="returnOptions.length === 0" class="task-hint">
                    当前没有可退回目标：请确认前面有必经单人办理步骤，且两者之间没有并行分支或汇合。
                  </p>
                </template>
                <div v-for="action in node.actions" :key="action">
                  <Form.Item :label="`${actionLabel(action)}时填写`">
                    <Select
                      mode="multiple"
                      :value="
                        node.actionForms?.[action]?.editableFields ??
                        node.editableFields
                      "
                      :options="
                        editableOptions.filter((field) =>
                          node?.editableFields?.includes(field.value),
                        )
                      "
                      :disabled="readonly"
                      @update:value="
                        patchNode({
                          actionForms: {
                            ...node?.actionForms,
                            [action]: {
                              editableFields: ids($event),
                              requiredFields:
                                node?.actionForms?.[
                                  action
                                ]?.requiredFields?.filter((field) =>
                                  ids($event).includes(field),
                                ) ?? [],
                            },
                          },
                        })
                      "
                    />
                  </Form.Item>
                  <Form.Item :label="`${actionLabel(action)}时必填`">
                    <Select
                      mode="multiple"
                      :value="node.actionForms?.[action]?.requiredFields"
                      :options="
                        editableOptions.filter((field) =>
                          (
                            node?.actionForms?.[action]?.editableFields ??
                            node?.editableFields
                          )?.includes(field.value),
                        )
                      "
                      :disabled="readonly"
                      @update:value="actionRequired(action, $event)"
                    />
                  </Form.Item>
                </div>
                <p class="task-hint">
                  保存只保留填写内容，不完成任务。通过与驳回分别校验所选必填项。
                </p>
              </CollapsePanel>
            </Collapse>
          </template>
          <template v-if="node.type === 'serviceTask'">
            <Form.Item :label="`将 ${stateFieldTitle} 更新为`">
              <Select
                :value="node.targetState"
                :disabled="readonly"
                :options="modelValue.businessBinding.stateMapping"
                @update:value="
                  patchNode({ targetState: $event as number | string })
                "
              />
            </Form.Item>
            <p class="task-hint">
              执行到这一步才修改业务状态；其他任务不会隐含改变状态。
            </p>
          </template>
          <template v-if="node.type === 'exclusiveGateway'">
            <p class="task-hint">
              {{
                outgoing.length > 1
                  ? '按路线顺序判断，选择首条满足条件的路线；均不满足时走其他情况。点击下方路线设置条件。'
                  : '选中的一路到达后直接继续，不等待其他路线。'
              }}
            </p>
          </template>
          <template v-if="node.type === 'parallelGateway'">
            <p class="task-hint">
              {{
                node.joinId
                  ? '所有分支同时开始，各自可包含多个办理步骤。'
                  : '等待配对分支全部到达，再继续下一步；这与单个任务内部的多人会签不同。'
              }}
            </p>
            <Button
              v-if="node.joinId"
              :disabled="readonly"
              @click="
                attempt(() => commit(addParallelBranch(modelValue, node!.id)))
              "
            >
              ＋增加一路
            </Button>
          </template>
          <Form.Item v-if="node.type === 'end'" label="结束结果">
            <Select
              :value="node.outcome"
              :disabled="readonly"
              :options="[
                { value: 'Approved', label: '通过' },
                { value: 'Rejected', label: '驳回' },
                { value: 'Withdrawn', label: '撤回' },
                { value: 'Terminated', label: '终止' },
              ]"
              @update:value="
                patchNode({ outcome: $event as WorkflowTaskNode['outcome'] })
              "
            />
          </Form.Item>
          <Collapse
            v-if="
              ['start', 'end', 'userTask', 'serviceTask'].includes(node.type)
            "
            class="task-settings"
          >
            <CollapsePanel key="copies" header="进入 / 完成抄送">
              <section
                v-for="(copy, index) in node.copies"
                :key="index"
                class="task-settings"
              >
                <Form.Item label="抄送时机">
                  <Select
                    :value="copy.event"
                    :disabled="readonly"
                    :options="[
                      { value: 'NodeEntered', label: '进入此步骤时' },
                      { value: 'NodeCompleted', label: '完成此步骤时' },
                    ]"
                    @update:value="
                      patchCopy(index, {
                        event: $event as 'NodeEntered' | 'NodeCompleted',
                      })
                    "
                  />
                </Form.Item>
                <Form.Item label="抄送用户">
                  <UserOrgSelector
                    :model-value="copy.candidateUsers"
                    :selected-records="selectedRecords(copy.candidateUsers)"
                    :selectable-types="['user']"
                    multiple
                    :disabled="readonly"
                    @update:model-value="
                      patchCopy(index, { candidateUsers: ids($event) })
                    "
                  />
                </Form.Item>
                <Form.Item label="抄送角色">
                  <Select
                    mode="multiple"
                    :value="copy.candidateGroups"
                    :disabled="readonly"
                    :options="
                      options.groups?.map((group) => ({
                        label: group.label,
                        value: group.value || group.id,
                      }))
                    "
                    @update:value="
                      patchCopy(index, { candidateGroups: ids($event) })
                    "
                  />
                </Form.Item>
                <Button
                  danger
                  type="link"
                  :disabled="readonly"
                  @click="
                    patchNode({
                      copies: node?.copies?.filter(
                        (_, current) => current !== index,
                      ),
                    })
                  "
                >
                  删除抄送
                </Button>
              </section>
              <Button
                :disabled="readonly"
                @click="
                  patchNode({
                    copies: [
                      ...(node?.copies ?? []),
                      {
                        event: 'NodeEntered',
                        candidateUsers: [],
                        candidateGroups: [],
                      },
                    ],
                  })
                "
              >
                ＋添加抄送
              </Button>
            </CollapsePanel>
          </Collapse>
          <Collapse
            v-if="
              notificationNode &&
              ['start', 'end', 'userTask', 'serviceTask'].includes(node.type)
            "
            class="task-settings"
          >
            <CollapsePanel key="notifications" header="进入 / 完成通知">
              <WorkflowNotificationEditor
                :node="notificationNode"
                :process-name="modelValue.name"
                :readonly="readonly"
                @change="updateNotifications($event)"
              />
            </CollapsePanel>
          </Collapse>
          <Collapse v-if="taskNotificationNode" class="task-settings">
            <CollapsePanel key="task-notifications" header="待办通知与提醒">
              <Form.Item label="提醒间隔（分钟）">
                <InputNumber
                  :value="node.reminderMinutes"
                  :min="1"
                  :max="525600"
                  :disabled="readonly"
                  @update:value="
                    patchNode({
                      reminderMinutes:
                        $event == null ? undefined : Number($event),
                    })
                  "
                />
              </Form.Item>
              <Form.Item label="办理时限（分钟）">
                <InputNumber
                  :value="node.deadlineMinutes"
                  :min="1"
                  :max="525600"
                  :disabled="readonly"
                  @update:value="
                    patchNode({
                      deadlineMinutes:
                        $event == null ? undefined : Number($event),
                    })
                  "
                />
              </Form.Item>
              <WorkflowNotificationEditor
                :node="taskNotificationNode"
                :process-name="modelValue.name"
                :readonly="readonly"
                @change="updateNotifications($event, true)"
              />
            </CollapsePanel>
          </Collapse>
          <div v-if="outgoing.length > 0" class="task-routes">
            <h4>下一步路线</h4>
            <div
              v-for="(route, index) in outgoing"
              :key="route.id"
              class="task-route-row"
            >
              <Button block @click="selectEdge(route.id)">
                {{ route.default ? '其他情况' : route.name || '继续' }} →
                {{
                  modelValue.nodes.find((item) => item.id === route.target)
                    ?.name
                }}
              </Button>
              <template
                v-if="
                  node.type === 'exclusiveGateway' &&
                  outgoing.length > 1 &&
                  !route.default
                "
              >
                <Button
                  size="small"
                  :disabled="readonly || index === 0"
                  @click="moveRoute(route.id, -1)"
                >
                  上移
                </Button>
                <Button
                  size="small"
                  :disabled="
                    readonly ||
                    index >= outgoing.filter((item) => !item.default).length - 1
                  "
                  @click="moveRoute(route.id, 1)"
                >
                  下移
                </Button>
              </template>
            </div>
          </div>
          <Button
            v-if="node.type !== 'end'"
            type="primary"
            block
            :disabled="readonly"
            @click="chooseInsertion(node.id)"
          >
            ＋添加下一步
          </Button>
          <Button
            v-if="['userTask', 'serviceTask'].includes(node.type)"
            danger
            type="link"
            :disabled="readonly"
            @click="deleteNode"
          >
            删除此步骤并接回后续
          </Button>
        </Form>
        <Form v-else-if="edge" layout="vertical">
          <h3>流转路线</h3>
          <p class="task-hint">
            {{
              modelValue.nodes.find((item) => item.id === edge!.source)?.name
            }}
            →
            {{
              modelValue.nodes.find((item) => item.id === edge!.target)?.name
            }}
          </p>
          <Form.Item label="路线名称">
            <Input
              :value="edge.name"
              :disabled="readonly"
              placeholder="例如：审批通过、金额超过一万元"
              @update:value="patchEdge({ name: $event })"
            />
          </Form.Item>
          <template
            v-if="
              modelValue.nodes.find((item) => item.id === edge!.source)
                ?.type === 'exclusiveGateway'
            "
          >
            <Checkbox
              :checked="edge.default"
              :disabled="readonly"
              @change="setDefault(!!$event.target.checked)"
            >
              其他情况（默认路线）
            </Checkbox>
          </template>
          <div v-if="!edge.default" class="task-settings">
            <h4>进入条件</h4>
            <WorkflowConditionEditor
              :model-value="
                renameStateCondition(
                  edge.condition,
                  variablePlan.renamedAliases,
                )
              "
              :variables="variables"
              :variable-labels="variableLabels"
              :variable-options="variableOptions"
              :readonly="readonly"
              @update:model-value="condition"
            />
          </div>
          <p class="task-hint">
            路线负责选择下一步；需要修改业务状态时，请插入自动处理步骤。
          </p>
          <Button
            type="primary"
            block
            :disabled="readonly"
            @click="insertEdgeId = edge.id"
          >
            ＋在此路线添加步骤
          </Button>
          <Button
            danger
            type="link"
            :disabled="readonly"
            @click="
              edit((graph) => {
                graph.edges = graph.edges.filter(
                  (item) => item.id !== edge!.id,
                );
              });
              selectedEdgeId = '';
            "
          >
            删除路线
          </Button>
        </Form>
        <div v-else class="task-hint">点击图中的步骤或路线查看配置。</div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* 画布与上下文侧栏共享高度，窄屏自动上下排列。 */
.task-designer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.task-toolbar,
.task-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.task-toolbar {
  justify-content: space-between;
}
.task-section-title {
  font-weight: 600;
}
.task-toolbar strong {
  margin-right: 12px;
}
.task-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  min-height: 540px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
}
.task-canvas {
  min-width: 0;
  overflow: auto;
  background: hsl(var(--muted) / 30%);
}
.task-sidebar {
  padding: 18px;
  border-left: 1px solid hsl(var(--border));
  max-height: 72vh;
  overflow: auto;
  background: hsl(var(--background));
}
.task-sidebar h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}
.task-hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.7;
}
.task-explanation {
  border-radius: 6px;
  padding: 10px;
  background: hsl(var(--primary) / 8%);
  font-size: 12px;
}
.task-step-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  height: auto;
  padding: 12px;
  margin-bottom: 10px;
  text-align: left;
  white-space: normal;
}
.task-step-button small {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
.task-settings {
  margin: 16px 0;
}
.task-routes {
  margin: 16px 0;
}
.task-route-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.task-routes button {
  margin-bottom: 8px;
  text-align: left;
  height: auto;
  white-space: normal;
}
.task-sequence > div {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.task-sequence-name {
  flex: 1;
}
.task-errors {
  margin: 0;
  padding-left: 20px;
  max-height: 150px;
  overflow: auto;
}
@media (max-width: 960px) {
  .task-body {
    grid-template-columns: 1fr;
  }
  .task-sidebar {
    border-left: 0;
    border-top: 1px solid hsl(var(--border));
    max-height: none;
  }
}
</style>
