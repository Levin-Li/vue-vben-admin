<script setup lang="ts">
import type {
  WorkflowDesignerOptions,
  WorkflowNotification,
  WorkflowVariable,
} from './types';
import type {
  WorkflowStateEdge,
  WorkflowStateGraph,
  WorkflowStateNode,
} from './workflow-state-graph';

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
  Space,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import { definitionFingerprint } from './definition-model';
import WorkflowConditionEditor from './workflow-condition-editor.vue';
import WorkflowGraphCanvas from './workflow-graph-canvas.vue';
import { graphLayout } from './workflow-graph-layout';
import WorkflowNotificationEditor from './workflow-notification-editor.vue';
import { sameState, validateStateGraph } from './workflow-state-graph';
import {
  buildStateVariables,
  renameStateCondition,
} from './workflow-state-variables';

const props = withDefaults(
  defineProps<{
    modelValue: WorkflowStateGraph;
    options?: WorkflowDesignerOptions;
    readonly?: boolean;
  }>(),
  { options: () => ({}), readonly: false },
);
const emit = defineEmits<{
  'update:modelValue': [value: WorkflowStateGraph];
  validate: [valid: boolean, messages: string[]];
}>();
const selectedNodeId = ref('');
const selectedEdgeId = ref('');
const tab = ref('node');
const editError = ref('');
const newEventTitle = ref('');
const newEventTrigger = ref<'auto' | 'manual' | 'message' | 'task' | 'timer'>(
  'manual',
);
const newStateIndex = ref<number>();
const eventDelayMinutes = ref(60);
const node = computed(() =>
  props.modelValue.nodes.find((item) => item.id === selectedNodeId.value),
);
const edge = computed(() =>
  props.modelValue.edges.find((item) => item.id === selectedEdgeId.value),
);
const business = computed(() =>
  props.options.stateBusinessObjects?.find(
    (item) =>
      item.entityKey === props.modelValue.businessBinding.businessEntityKey,
  ),
);
const fields = computed(() => business.value?.fields ?? []);
const conditionFields = computed(() =>
  fields.value.filter((field) => field.conditionAllowed === true),
);
const variablePlan = computed(() =>
  buildStateVariables(conditionFields.value, props.modelValue.variables),
);
const variables = computed<Record<string, WorkflowVariable>>(
  () => variablePlan.value.variables,
);
function displayCondition(condition: WorkflowStateEdge['condition']) {
  return renameStateCondition(condition, variablePlan.value.renamedAliases);
}
const variableLabels = computed(() =>
  Object.fromEntries(
    Object.entries(variables.value).map(([key, variable]) => [
      key,
      fields.value.find((field) => `business.${field.key}` === variable.source)
        ?.title ?? key,
    ]),
  ),
);
const variableOptions = computed(() =>
  Object.fromEntries(
    Object.entries(variables.value).map(([key, variable]) => [
      key,
      fields.value.find((field) => `business.${field.key}` === variable.source)
        ?.options ?? [],
    ]),
  ),
);
const nodeOptions = computed(() =>
  props.modelValue.nodes.map((item) => ({ label: item.name, value: item.id })),
);
const eventOptions = computed(() =>
  props.modelValue.events.map((item) => ({
    label: item.title,
    value: item.id,
  })),
);
const taskEventOptions = computed(() =>
  props.modelValue.events
    .filter((item) => item.trigger === 'task')
    .map((item) => ({ label: item.title, value: item.id })),
);
const availableStates = computed(() =>
  props.modelValue.businessBinding.stateMapping.map((state, index) => ({
    label: state.label,
    value: index,
    disabled: props.modelValue.nodes.some((item) =>
      sameState(item.stateValue, state.value),
    ),
  })),
);
const incoming = computed(() =>
  props.modelValue.edges.filter((item) => item.target === node.value?.id),
);
const notificationNode = computed(() =>
  node.value ? { ...node.value, type: 'start' as const } : undefined,
);
const errors = computed(() => validateStateGraph(props.modelValue));
watch(errors, (messages) => emit('validate', messages.length === 0, messages), {
  immediate: true,
});
watch(
  () => props.modelValue.processKey,
  () => {
    selectedNodeId.value = props.modelValue.startNodeId;
    selectedEdgeId.value = '';
  },
  { immediate: true },
);

// 每次提交完整图副本；不让拖拽或侧栏编辑修改父层固定版本对象。
function change(update: (graph: WorkflowStateGraph) => void) {
  if (props.readonly) return;
  // Vue 代理不能直接 structuredClone，协议只包含 JSON 值。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const graph: WorkflowStateGraph = JSON.parse(
    JSON.stringify(props.modelValue),
  );
  update(graph);
  if (definitionFingerprint(graph) === definitionFingerprint(props.modelValue))
    return;
  const renamed = variablePlan.value.renamedAliases;
  if (Object.keys(renamed).length > 0) {
    if (graph.variables)
      graph.variables = Object.fromEntries(
        Object.entries(graph.variables).map(([key, value]) => [
          renamed[key] ?? key,
          value,
        ]),
      );
    for (const item of graph.nodes)
      if (item.startCondition)
        item.startCondition = renameStateCondition(
          item.startCondition,
          renamed,
        );
    for (const item of graph.edges)
      if (item.condition)
        item.condition = renameStateCondition(item.condition, renamed);
    for (const sample of graph.simulationPolicy?.cases ?? [])
      sample.variables = Object.fromEntries(
        Object.entries(sample.variables).map(([key, value]) => [
          renamed[key] ?? key,
          value,
        ]),
      );
  }
  editError.value = '';
  emit('update:modelValue', graph);
}
function chooseNode(id: string) {
  selectedNodeId.value = id;
  selectedEdgeId.value = '';
  tab.value = 'node';
}
function chooseEdge(id: string) {
  selectedEdgeId.value = id;
  selectedNodeId.value = '';
  tab.value = 'edge';
}
function patchNode(patch: Partial<WorkflowStateNode>) {
  const id = node.value?.id;
  if (id)
    change((graph) =>
      Object.assign(graph.nodes.find((item) => item.id === id)!, patch),
    );
}
function patchEdge(patch: Partial<WorkflowStateEdge>) {
  const id = edge.value?.id;
  if (id)
    change((graph) =>
      Object.assign(graph.edges.find((item) => item.id === id)!, patch),
    );
}
function unique(prefix: string, ids: string[]) {
  let index = 1;
  while (ids.includes(`${prefix}_${index}`)) index++;
  return `${prefix}_${index}`;
}
function addNode() {
  const state =
    props.modelValue.businessBinding.stateMapping[newStateIndex.value ?? -1];
  if (!state || availableStates.value[newStateIndex.value!]?.disabled) return;
  const id = unique(
    'state',
    props.modelValue.nodes.map((item) => item.id),
  );
  change((graph) =>
    graph.nodes.push({
      id,
      name: state.label,
      stateValue: state.value,
      x: 60,
      y: 100 + graph.nodes.length * 100,
    }),
  );
  newStateIndex.value = undefined;
  chooseNode(id);
}
function addEdge(source = node.value?.id ?? props.modelValue.startNodeId) {
  if (
    !source ||
    props.modelValue.nodes.find((item) => item.id === source)?.terminal
  )
    return;
  const id = unique(
    'route',
    props.modelValue.edges.map((item) => item.id),
  );
  change((graph) =>
    graph.edges.push({
      id,
      source,
      target: graph.nodes.find((item) => item.id !== source)?.id ?? source,
      event: graph.events[0]?.id ?? '',
    }),
  );
  chooseEdge(id);
}
function removeNode() {
  if (!node.value) return;
  if (node.value.id === props.modelValue.startNodeId) {
    editError.value = '请先把开始状态改为其它节点，再删除。';
    return;
  }
  const id = node.value.id;
  change((graph) => {
    graph.nodes = graph.nodes.filter((item) => item.id !== id);
    graph.edges = graph.edges.filter(
      (item) => item.source !== id && item.target !== id,
    );
  });
  selectedNodeId.value = '';
}
function addEvent() {
  if (!newEventTitle.value.trim()) return;
  const id = unique(
    'event',
    props.modelValue.events.map((item) => item.id),
  );
  change((graph) =>
    graph.events.push({
      id,
      title: newEventTitle.value.trim(),
      trigger: newEventTrigger.value,
      ...(newEventTrigger.value === 'timer'
        ? { delayMinutes: eventDelayMinutes.value }
        : {}),
    }),
  );
  newEventTitle.value = '';
  if (edge.value && !edge.value.event) patchEdge({ event: id });
}
function removeEvent(id: string) {
  if (
    props.modelValue.edges.some((item) => item.event === id) ||
    props.modelValue.nodes.some(
      (item) =>
        item.approval?.completionEvent === id ||
        item.approval?.rejectionEvent === id,
    )
  ) {
    editError.value = '该事件已被路线或审批规则引用，请先修改引用。';
    return;
  }
  change((graph) => {
    graph.events = graph.events.filter((item) => item.id !== id);
  });
}
function approval(patch: Partial<NonNullable<WorkflowStateNode['approval']>>) {
  patchNode({
    approval: {
      mode: 'NONE',
      candidateUsers: [],
      candidateGroups: [],
      ...node.value?.approval,
      ...patch,
    },
  });
}
// 工作流保存值可能带 user: 前缀；仅按真实候选匹配名称，不改写定义中的身份值。
function normalizedUserId(value: string) {
  return value.startsWith('user:') ? value.slice('user:'.length) : value;
}
function directoryUser(value: string) {
  const id = normalizedUserId(value);
  return props.options.users?.find(
    (user) =>
      normalizedUserId(user.id) === id ||
      (user.value && normalizedUserId(user.value) === id),
  );
}
function selectedUserRecords(ids: string[]) {
  return ids.flatMap((value) => {
    const user = directoryUser(value);
    return user?.label?.trim()
      ? [
          {
            id: normalizedUserId(value),
            kind: 'user' as const,
            name: user.label,
          },
        ]
      : [];
  });
}
function userLabel(value: string) {
  return directoryUser(value)?.label || value;
}
function userIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (item && typeof item === 'object' && 'id' in item)
      return [String(item.id)];
    return [];
  });
}
function updateFields(
  key: 'editableFields' | 'readableFields' | 'requiredFields',
  values: string[],
) {
  if (key === 'readableFields')
    patchNode({
      readableFields: values,
      editableFields: node.value?.editableFields?.filter((field) =>
        values.includes(field),
      ),
      requiredFields: node.value?.requiredFields?.filter((field) =>
        values.includes(field),
      ),
    });
  else if (key === 'editableFields')
    patchNode({
      editableFields: values,
      requiredFields: node.value?.requiredFields?.filter((field) =>
        values.includes(field),
      ),
    });
  else patchNode({ requiredFields: values });
}
function moveApprover(index: number, direction: number) {
  const users = [...(node.value?.approval?.candidateUsers ?? [])];
  const value = users[index];
  if (
    value === undefined ||
    index + direction < 0 ||
    index + direction >= users.length
  )
    return;
  users.splice(index, 1);
  users.splice(index + direction, 0, value);
  approval({ candidateUsers: users });
}
function setCopy(
  index: number,
  patch: Partial<NonNullable<WorkflowStateNode['copies']>[number]>,
) {
  patchNode({
    copies: node.value?.copies?.map((copy, current) =>
      current === index ? { ...copy, ...patch } : copy,
    ),
  });
}
function addCopy() {
  patchNode({
    copies: [
      ...(node.value?.copies ?? []),
      { event: 'NodeEntered', candidateUsers: [], candidateGroups: [] },
    ],
  });
}
function arrange() {
  change((graph) => {
    const layout = graphLayout({
      name: graph.name,
      processKey: graph.processKey,
      nodes: graph.nodes.map((item) => ({ ...item, type: 'userTask' })),
      edges: graph.edges,
    });
    for (const item of graph.nodes) Object.assign(item, layout.get(item.id));
  });
}
function conditionChange(value: WorkflowStateEdge['condition']) {
  change((graph) => {
    graph.variables = variables.value;
    if (edge.value)
      graph.edges.find((item) => item.id === edge.value!.id)!.condition = value;
  });
}
</script>

<template>
  <section class="state-designer">
    <!-- 已保存绑定放在摘要中，所有图内状态只能选择其值集合。 -->
    <div class="binding-summary">
      <strong>
        {{ business?.title || modelValue.businessBinding.businessEntityKey }}
      </strong>
      <span>
        状态字段：{{
          fields.find(
            (field) => field.key === modelValue.businessBinding.stateField,
          )?.title || modelValue.businessBinding.stateField
        }}
      </span>
      <span>点击状态或路线，在右侧配置；节点旁 ＋ 可连接已有状态。</span>
    </div>
    <Alert
      v-if="editError"
      :message="editError"
      type="warning"
      show-icon
      class="mb-3"
    />
    <div class="designer-grid">
      <WorkflowGraphCanvas
        :nodes="
          modelValue.nodes.map((item) => ({
            ...item,
            stateLabel: modelValue.businessBinding.stateMapping.find((state) =>
              sameState(state.value, item.stateValue),
            )?.label,
          }))
        "
        :edges="
          modelValue.edges.map((item) => ({
            ...item,
            label:
              modelValue.events.find((event) => event.id === item.event)
                ?.title || '请选择事件',
          }))
        "
        :read-only="readonly"
        :allow-selection="true"
        :selected-node-id="selectedNodeId"
        :selected-edge-id="selectedEdgeId"
        @node-click="chooseNode"
        @edge-click="chooseEdge"
        @add-from="addEdge"
        @move-node="
          (id, x, y) =>
            change((graph) =>
              Object.assign(graph.nodes.find((item) => item.id === id)!, {
                x,
                y,
              }),
            )
        "
      >
        <Select
          v-model:value="newStateIndex"
          aria-label="待添加状态"
          placeholder="选择已定义状态"
          :options="availableStates"
          :disabled="readonly"
          class="state-picker"
        />
        <Button
          :disabled="readonly || newStateIndex === undefined"
          @click="addNode"
        >
          添加状态
        </Button>
        <Button :disabled="readonly" @click="arrange">整理画布</Button>
      </WorkflowGraphCanvas>
      <aside class="properties" aria-label="流程属性">
        <Tabs v-model:active-key="tab" size="small">
          <TabPane key="node" tab="状态">
            <Form
              v-if="node"
              layout="vertical"
              data-form-id="workflow-state-node"
              data-form-name="流程状态配置"
            >
              <Form.Item label="节点名称">
                <Input
                  :value="node.name"
                  :disabled="readonly"
                  @update:value="patchNode({ name: $event })"
                />
              </Form.Item>
              <Form.Item label="业务状态">
                <Select
                  :value="
                    modelValue.businessBinding.stateMapping.findIndex((state) =>
                      sameState(state.value, node!.stateValue),
                    )
                  "
                  :options="
                    modelValue.businessBinding.stateMapping.map(
                      (state, index) => ({
                        label: `${state.label}（${state.value}）`,
                        value: index,
                        disabled: modelValue.nodes.some(
                          (item) =>
                            item.id !== node!.id &&
                            sameState(item.stateValue, state.value),
                        ),
                      }),
                    )
                  "
                  :disabled="readonly"
                  @update:value="
                    patchNode({
                      stateValue:
                        modelValue.businessBinding.stateMapping[Number($event)]!
                          .value,
                    })
                  "
                />
              </Form.Item>
              <Space>
                <Checkbox
                  :checked="modelValue.startNodeId === node.id"
                  :disabled="readonly || modelValue.startNodeId === node.id"
                  @change="
                    change((graph) => {
                      const old = graph.nodes.find(
                        (item) => item.id === graph.startNodeId,
                      );
                      if (old) delete old.startCondition;
                      graph.startNodeId = node!.id;
                    })
                  "
                >
                  开始状态
                </Checkbox>
                <Checkbox
                  :checked="node.terminal"
                  :disabled="readonly"
                  @change="
                    patchNode({
                      terminal: $event.target.checked,
                      outcome: $event.target.checked
                        ? (node?.outcome ?? 'Approved')
                        : undefined,
                    })
                  "
                >
                  结束状态
                </Checkbox>
              </Space>
              <Form.Item v-if="node.terminal" label="结束结果" required>
                <Select
                  :value="node.outcome"
                  :disabled="readonly"
                  :options="[
                    { value: 'Approved', label: '通过' },
                    { value: 'Rejected', label: '拒绝' },
                    { value: 'Withdrawn', label: '撤回 / 取消' },
                    { value: 'Terminated', label: '终止' },
                  ]"
                  @update:value="
                    patchNode({
                      outcome: $event as WorkflowStateNode['outcome'],
                    })
                  "
                />
              </Form.Item>
              <Collapse class="mt-3" :default-active-key="['approval']">
                <CollapsePanel
                  v-if="modelValue.startNodeId === node.id"
                  key="start"
                  header="启动条件"
                >
                  <WorkflowConditionEditor
                    :model-value="displayCondition(node.startCondition)"
                    :variables="variables"
                    :variable-labels="variableLabels"
                    :variable-options="variableOptions"
                    :readonly="readonly"
                    @update:model-value="
                      (value) =>
                        change((graph) => {
                          graph.variables = variables;
                          graph.nodes.find(
                            (item) => item.id === node!.id,
                          )!.startCondition = value;
                        })
                    "
                  />
                </CollapsePanel>
                <CollapsePanel
                  v-if="!node.terminal"
                  key="approval"
                  header="办理人和审批方式"
                >
                  <Form.Item label="审批方式">
                    <Select
                      :value="node.approval?.mode || 'AUTO'"
                      :disabled="readonly"
                      :options="[
                        { value: 'AUTO', label: '无需人工办理' },
                        { value: 'NONE', label: '单人办理' },
                        { value: 'ALL', label: '会签：全部通过' },
                        { value: 'ANY', label: '或签：任一通过' },
                        { value: 'SEQUENTIAL', label: '顺签：按人员顺序办理' },
                      ]"
                      @update:value="
                        (value) =>
                          value === 'AUTO'
                            ? patchNode({ approval: undefined })
                            : approval({
                                mode: value as NonNullable<
                                  WorkflowStateNode['approval']
                                >['mode'],
                              })
                      "
                    />
                  </Form.Item>
                  <template v-if="node.approval">
                    <Form.Item label="办理人">
                      <UserOrgSelector
                        :model-value="node.approval.candidateUsers"
                        :selected-records="
                          selectedUserRecords(node.approval.candidateUsers)
                        "
                        :selectable-types="['user']"
                        multiple
                        :disabled="readonly"
                        placeholder="选择办理人"
                        @update:model-value="
                          approval({ candidateUsers: userIds($event) })
                        "
                      />
                    </Form.Item>
                    <div
                      v-if="node.approval.mode === 'SEQUENTIAL'"
                      class="sequential-list"
                    >
                      <p class="hint">
                        按下列人员顺序办理；角色由服务端解析实际人员及顺序。
                      </p>
                      <div
                        v-for="(userId, index) in node.approval.candidateUsers"
                        :key="userId"
                        class="sequential-item"
                      >
                        <span>
                          {{ index + 1 }}.
                          {{ userLabel(userId) }}
                        </span>
                        <Button
                          size="small"
                          :disabled="readonly || index === 0"
                          @click="moveApprover(index, -1)"
                        >
                          上移
                        </Button>
                        <Button
                          size="small"
                          :disabled="
                            readonly ||
                            index === node.approval.candidateUsers.length - 1
                          "
                          @click="moveApprover(index, 1)"
                        >
                          下移
                        </Button>
                      </div>
                    </div>
                    <Checkbox
                      :checked="node.allowSelfApproval"
                      :disabled="readonly"
                      @change="
                        patchNode({ allowSelfApproval: $event.target.checked })
                      "
                    >
                      允许业务申请人办理本步骤
                    </Checkbox>
                    <Form.Item label="办理角色 / 组织">
                      <Select
                        mode="multiple"
                        :value="node.approval.candidateGroups"
                        :disabled="readonly"
                        :options="
                          options.groups?.map((group) => ({
                            label: group.label,
                            value: group.value || group.id,
                          }))
                        "
                        @update:value="
                          approval({ candidateGroups: userIds($event) })
                        "
                      />
                    </Form.Item>
                    <Form.Item label="全部办理完成后触发">
                      <Select
                        :value="node.approval.completionEvent"
                        :disabled="readonly"
                        :options="taskEventOptions"
                        placeholder="在事件页添加办理事件"
                        @update:value="
                          approval({ completionEvent: String($event) })
                        "
                      />
                    </Form.Item>
                    <Form.Item label="拒绝时触发（可选）">
                      <Select
                        :value="node.approval.rejectionEvent"
                        :disabled="readonly"
                        :options="taskEventOptions"
                        allow-clear
                        @update:value="
                          approval({
                            rejectionEvent:
                              $event == null ? undefined : String($event),
                          })
                        "
                      />
                    </Form.Item>
                  </template>
                </CollapsePanel>
                <CollapsePanel key="fields" header="表单权限">
                  <Form.Item label="可见字段">
                    <Select
                      mode="multiple"
                      :disabled="readonly"
                      :value="node.readableFields"
                      :options="
                        fields.map((field) => ({
                          label: field.title,
                          value: field.key,
                        }))
                      "
                      @update:value="
                        updateFields('readableFields', userIds($event))
                      "
                    />
                  </Form.Item>
                  <Form.Item label="可编辑字段">
                    <Select
                      mode="multiple"
                      :disabled="readonly"
                      :value="node.editableFields"
                      :options="
                        fields
                          .filter(
                            (field) =>
                              node!.readableFields?.includes(field.key) &&
                              field.key !==
                                modelValue.businessBinding.stateField &&
                              field.editable !== false,
                          )
                          .map((field) => ({
                            label: field.title,
                            value: field.key,
                          }))
                      "
                      @update:value="
                        updateFields('editableFields', userIds($event))
                      "
                    />
                  </Form.Item>
                  <Form.Item label="必填字段">
                    <Select
                      mode="multiple"
                      :disabled="readonly"
                      :value="node.requiredFields"
                      :options="
                        fields
                          .filter((field) =>
                            node!.editableFields?.includes(field.key),
                          )
                          .map((field) => ({
                            label: field.title,
                            value: field.key,
                          }))
                      "
                      @update:value="
                        updateFields('requiredFields', userIds($event))
                      "
                    />
                  </Form.Item>
                </CollapsePanel>
                <CollapsePanel key="notify" header="进入 / 离开通知">
                  <WorkflowNotificationEditor
                    v-if="notificationNode"
                    :node="notificationNode"
                    :process-name="modelValue.name"
                    :readonly="readonly"
                    @change="
                      (notifications: WorkflowNotification[]) =>
                        patchNode({ notifications })
                    "
                  />
                </CollapsePanel>
                <CollapsePanel key="copies" header="抄送（只知会，不阻塞审批）">
                  <div
                    v-for="(copy, index) in node.copies"
                    :key="index"
                    class="copy-rule"
                  >
                    <Select
                      :value="copy.event"
                      :disabled="readonly"
                      :options="[
                        { value: 'NodeEntered', label: '进入状态时' },
                        { value: 'NodeCompleted', label: '离开状态时' },
                      ]"
                      @update:value="
                        setCopy(index, {
                          event: $event as 'NodeEntered' | 'NodeCompleted',
                        })
                      "
                    />
                    <UserOrgSelector
                      :model-value="copy.candidateUsers"
                      :selected-records="
                        selectedUserRecords(copy.candidateUsers)
                      "
                      :selectable-types="['user']"
                      multiple
                      :disabled="readonly"
                      placeholder="选择抄送人"
                      @update:model-value="
                        setCopy(index, { candidateUsers: userIds($event) })
                      "
                    />
                    <Select
                      mode="multiple"
                      :value="copy.candidateGroups"
                      :disabled="readonly"
                      placeholder="抄送角色 / 组织"
                      :options="
                        options.groups?.map((group) => ({
                          label: group.label,
                          value: group.value || group.id,
                        }))
                      "
                      @update:value="
                        setCopy(index, { candidateGroups: userIds($event) })
                      "
                    />
                    <Button
                      :disabled="readonly"
                      danger
                      @click="
                        patchNode({
                          copies: node?.copies?.filter(
                            (_, current) => current !== index,
                          ),
                        })
                      "
                    >
                      移除
                    </Button>
                  </div>
                  <Button :disabled="readonly" @click="addCopy">
                    添加抄送
                  </Button>
                </CollapsePanel>
                <CollapsePanel
                  key="incoming"
                  :header="`进入路线（${incoming.length}）`"
                >
                  <p v-if="incoming.length === 0" class="hint">
                    暂无进入路线。
                  </p>
                  <Button
                    v-for="route in incoming"
                    :key="route.id"
                    type="link"
                    @click="chooseEdge(route.id)"
                  >
                    {{
                      modelValue.nodes.find((item) => item.id === route.source)
                        ?.name
                    }}
                    →
                    {{
                      modelValue.events.find(
                        (event) => event.id === route.event,
                      )?.title || '未选事件'
                    }}
                  </Button>
                </CollapsePanel>
              </Collapse>
              <Space class="mt-3">
                <Button
                  :disabled="readonly || node.terminal"
                  @click="addEdge()"
                >
                  添加离开路线
                </Button>
                <Button
                  :disabled="readonly || node.id === modelValue.startNodeId"
                  danger
                  @click="removeNode"
                >
                  删除状态
                </Button>
              </Space>
            </Form>
            <p v-else class="hint">
              点击图中状态，设置办理人、表单、通知和抄送。
            </p>
          </TabPane>
          <TabPane key="edge" tab="路线">
            <Form
              v-if="edge"
              layout="vertical"
              data-form-id="workflow-state-route"
              data-form-name="流程路线配置"
            >
              <Form.Item label="来源状态">
                <Select
                  :value="edge.source"
                  :disabled="readonly"
                  :options="nodeOptions"
                  @update:value="patchEdge({ source: String($event) })"
                />
              </Form.Item>
              <Form.Item label="触发事件">
                <Select
                  :value="edge.event || undefined"
                  :disabled="readonly"
                  :options="eventOptions"
                  placeholder="选择事件；可在事件页添加"
                  @update:value="patchEdge({ event: String($event) })"
                />
              </Form.Item>
              <Form.Item label="目标状态">
                <Select
                  :value="edge.target"
                  :disabled="readonly"
                  :options="nodeOptions"
                  @update:value="patchEdge({ target: String($event) })"
                />
              </Form.Item>
              <Form.Item label="流转条件">
                <WorkflowConditionEditor
                  :model-value="displayCondition(edge.condition)"
                  :variables="variables"
                  :variable-labels="variableLabels"
                  :variable-options="variableOptions"
                  :readonly="readonly"
                  @update:model-value="conditionChange"
                />
              </Form.Item>
              <p class="hint">
                事件发生且条件满足才进入目标状态。同一事件没有符合路线时保持原状，多条同时符合时拒绝转移。
              </p>
              <Button
                :disabled="readonly"
                danger
                @click="
                  change((graph) => {
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
            <p v-else class="hint">
              点击图中的路线设置事件和条件，或点击状态旁 ＋ 添加路线。
            </p>
          </TabPane>
          <TabPane key="events" tab="事件">
            <p class="hint">
              人工点击、审批完成和自动判断均通过事件选择下一条路线。
            </p>
            <div
              v-for="event in modelValue.events"
              :key="event.id"
              class="event-rule"
            >
              <Input
                :value="event.title"
                :disabled="readonly"
                :aria-label="`事件名称 ${event.id}`"
                @update:value="
                  (value) =>
                    change((graph) => {
                      graph.events.find((item) => item.id === event.id)!.title =
                        value;
                    })
                "
              />
              <span>
                {{
                  {
                    manual: '人工点击',
                    task: '审批完成',
                    auto: '自动判断',
                    message: '业务事件',
                    timer: '定时触发',
                  }[event.trigger]
                }}
              </span>
              <Button
                :disabled="readonly"
                size="small"
                danger
                @click="removeEvent(event.id)"
              >
                移除
              </Button>
            </div>
            <Form
              layout="vertical"
              data-form-id="workflow-state-event"
              data-form-name="流程事件配置"
            >
              <Form.Item label="事件名称">
                <Input
                  v-model:value="newEventTitle"
                  :disabled="readonly"
                  placeholder="例如：提交、同意、取消"
                />
              </Form.Item>
              <Form.Item label="触发方式">
                <Select
                  v-model:value="newEventTrigger"
                  :disabled="readonly"
                  :options="[
                    { value: 'manual', label: '人工点击' },
                    { value: 'task', label: '审批完成' },
                    { value: 'auto', label: '自动判断' },
                    { value: 'message', label: '业务事件' },
                    { value: 'timer', label: '定时触发' },
                  ]"
                />
              </Form.Item>
              <Form.Item
                v-if="newEventTrigger === 'timer'"
                label="进入状态后等待分钟数"
              >
                <InputNumber
                  v-model:value="eventDelayMinutes"
                  :min="1"
                  :max="525600"
                  :disabled="readonly"
                />
              </Form.Item>
              <p v-if="newEventTrigger === 'message'" class="hint">
                由已接入的可信业务事件触发，发布后由服务端接收和验证。
              </p>
              <Button
                :disabled="readonly || !newEventTitle.trim()"
                @click="addEvent"
              >
                添加事件
              </Button>
            </Form>
          </TabPane>
        </Tabs>
      </aside>
    </div>
  </section>
</template>

<style scoped>
/* 画布是核心操作区，属性栏固定可读宽度；窄屏自然回落，不挤压或遮住操作。 */
.binding-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  padding: 12px 0;
  font-size: 13px;
}
.binding-summary span:last-child,
.hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.7;
}
.designer-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  gap: 12px;
  align-items: start;
}
.properties {
  min-width: 0;
  padding: 0 14px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  max-height: 78vh;
  overflow: auto;
  background: hsl(var(--card));
}
.state-picker {
  min-width: 150px;
}
.sequential-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.sequential-item span {
  flex: 1;
  overflow-wrap: anywhere;
}
.copy-rule {
  display: grid;
  gap: 8px;
  border-bottom: 1px solid hsl(var(--border));
  padding: 8px 0 12px;
  margin-bottom: 12px;
}
.event-rule {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.event-rule span {
  white-space: nowrap;
  font-size: 12px;
}
@media (max-width: 1000px) {
  .designer-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .properties {
    max-height: none;
  }
}
</style>
