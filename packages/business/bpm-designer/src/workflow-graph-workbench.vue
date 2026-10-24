<script setup lang="ts">
import type {
  WorkflowDefinitionVersion,
  WorkflowDesignerOptions,
} from './types';
import type { WorkflowStateGraph } from './workflow-state-graph';
import type { WorkflowTaskGraph } from './workflow-task-graph';

import { computed, ref, toRaw } from 'vue';

import {
  Alert,
  Button,
  Collapse,
  CollapsePanel,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
} from 'ant-design-vue';

import { definitionFingerprint } from './definition-model';
import { WorkflowDesignerService } from './workflow-designer-service';
import WorkflowGraphDesigner from './workflow-graph-designer.vue';
import WorkflowSimulationForm from './workflow-simulation-form.vue';
import { validateStateGraph } from './workflow-state-graph';
import WorkflowTaskDesigner from './workflow-task-designer.vue';
import { validateTaskGraph } from './workflow-task-graph';

type EditableGraph = WorkflowStateGraph | WorkflowTaskGraph;

const props = withDefaults(
  defineProps<{
    definition: EditableGraph;
    options?: WorkflowDesignerOptions;
    permissions?: {
      deleteSimulation?: boolean;
      publish?: boolean;
      save?: boolean;
      simulate?: boolean;
      viewSimulation?: boolean;
    };
    service?: WorkflowDesignerService;
    version: WorkflowDefinitionVersion;
  }>(),
  { options: () => ({}), permissions: () => ({}), service: undefined },
);
const emit = defineEmits<{
  refreshed: [value: WorkflowDefinitionVersion];
  'update:definition': [value: EditableGraph];
}>();
const service = computed(() => props.service ?? new WorkflowDesignerService());
const busy = ref(false);
const actionError = ref('');
const actionMessage = ref('');
const valid = ref(false);
const errors = ref<string[]>([]);
const dirty = computed(
  () =>
    definitionFingerprint(props.definition) !==
    definitionFingerprint(props.version.lowflowDefinition),
);
const editable = computed(
  () =>
    ['Draft', 'Testing'].includes(props.version.lifecycle) &&
    props.permissions.save !== false,
);
const canSimulate = computed(
  () =>
    editable.value &&
    valid.value &&
    simulationFormErrors.value.length === 0 &&
    !dirty.value &&
    props.permissions.simulate !== false &&
    (props.definition.simulationPolicy?.cases.length ?? 0) > 0,
);
const canPublish = computed(
  () =>
    props.permissions.publish !== false &&
    props.version.lifecycle === 'Testing' &&
    props.version.simulationReport?.successful &&
    !dirty.value &&
    valid.value,
);
const cases = computed(() => props.definition.simulationPolicy?.cases ?? []);
const simulationFields = computed(() =>
  Object.entries(props.definition.variables ?? {}).map(([key, variable]) => ({
    key,
    type: variable.type,
    title:
      props.options.stateBusinessObjects
        ?.find(
          (item) =>
            item.entityKey ===
            props.definition.businessBinding.businessEntityKey,
        )
        ?.fields.find((field) => variable.source === `business.${field.key}`)
        ?.title ?? key,
  })),
);
const eventOptions = computed(() =>
  (props.definition.schemaVersion === 4 ? props.definition.events : [])
    .filter((event) => !['task', 'timer'].includes(event.trigger))
    .map((event) => ({ label: event.title, value: event.id })),
);
const nodeOptions = computed(() =>
  props.definition.nodes.map((node) => ({ label: node.name, value: node.id })),
);
// 每个人工步骤明确其办理节点；表单字段来自该节点许可及绑定目录。
const approvalNodeOptions = computed(() =>
  props.definition.nodes
    .filter(
      (node) =>
        ('approval' in node && node.approval) ||
        ('type' in node && node.type === 'userTask'),
    )
    .map((node) => ({ label: node.name, value: node.id })),
);
const businessFields = computed(
  () =>
    props.options.stateBusinessObjects?.find(
      (item) =>
        item.entityKey === props.definition.businessBinding.businessEntityKey,
    )?.fields ?? [],
);
function stepNode(nodeId?: string) {
  return props.definition.nodes.find((node) => node.id === nodeId);
}
function stepForm(nodeId?: string, action?: string) {
  const node = stepNode(nodeId);
  if (!node) return undefined;
  return action && 'actionForms' in node
    ? node.actionForms?.[action]
    : undefined;
}
function stepRequired(nodeId?: string, action?: string) {
  return (
    stepForm(nodeId, action)?.requiredFields ??
    stepNode(nodeId)?.requiredFields ??
    []
  );
}
function stepFields(nodeId?: string, action?: string) {
  const editable =
    stepForm(nodeId, action)?.editableFields ??
    stepNode(nodeId)?.editableFields ??
    [];
  return businessFields.value.filter((field) => editable.includes(field.key));
}
const simulationFormErrors = computed(() =>
  cases.value.flatMap((sample, index) =>
    sample.steps.flatMap((step, stepIndex) => {
      if (!step.action) return [];
      const node = stepNode(step.nodeId);
      if (
        !node ||
        !(
          ('approval' in node && node.approval) ||
          ('type' in node && node.type === 'userTask')
        )
      ) {
        if (!step.nodeId && Object.keys(step.formData ?? {}).length === 0)
          return [];
        return [`用例 ${index + 1} 第 ${stepIndex + 1} 步请选择办理状态。`];
      }
      const actionForm =
        'actionForms' in node ? node.actionForms?.[step.action] : undefined;
      return (actionForm?.requiredFields ?? node.requiredFields ?? [])
        .filter((key) => {
          const value = step.formData?.[key];
          return (
            value === undefined ||
            value === null ||
            (typeof value === 'string' && value.trim() === '') ||
            (Array.isArray(value) && value.length === 0)
          );
        })
        .map(
          (key) =>
            `用例 ${index + 1} 第 ${stepIndex + 1} 步请填写${businessFields.value.find((field) => field.key === key)?.title ?? key}。`,
        );
    }),
  ),
);
function setStepNode(index: number, stepIndex: number, nodeId: unknown) {
  changeCases((graph) => {
    const step = graph.simulationPolicy?.cases[index]?.steps[stepIndex];
    if (step) {
      step.nodeId = typeof nodeId === 'string' && nodeId ? nodeId : undefined;
      step.formData = {};
    }
  });
}
function setStepForm(
  index: number,
  stepIndex: number,
  formData: Record<string, unknown>,
) {
  changeCases((graph) => {
    const step = graph.simulationPolicy?.cases[index]?.steps[stepIndex];
    if (step) step.formData = formData;
  });
}
function changeCases(update: (graph: EditableGraph) => void) {
  if (!editable.value || busy.value) return;
  // Vue 代理不能直接 structuredClone，协议只包含 JSON 值。
  // eslint-disable-next-line unicorn/prefer-structured-clone
  const graph: EditableGraph = JSON.parse(JSON.stringify(props.definition));
  graph.simulationPolicy ??= { cases: [] };
  update(graph);
  emit('update:definition', graph);
}
function addCase() {
  changeCases((graph) =>
    graph.simulationPolicy!.cases.push({
      name: `用例 ${cases.value.length + 1}`,
      variables: {},
      steps: [],
    }),
  );
}
function variableValue(index: number, key: string, value: unknown) {
  changeCases((graph) => {
    graph.simulationPolicy!.cases[index]!.variables[key] = value;
  });
}
function selectStep(index: number, stepIndex: number, value: unknown) {
  changeCases((graph) => {
    const steps = graph.simulationPolicy?.cases[index]?.steps;
    if (!steps) return;
    switch (value) {
      case 'advance': {
        steps[stepIndex] = { advanceMinutes: 1 };
        break;
      }
      case 'approve':
      case 'reject': {
        steps[stepIndex] = {
          action: value,
          formData: {},
        };
        break;
      }
      case 'event': {
        steps[stepIndex] = { event: eventOptions.value[0]?.value ?? '' };
        break;
      }
    }
  });
}
async function run(
  action: () => Promise<WorkflowDefinitionVersion>,
  message: string,
) {
  if (busy.value) return;
  busy.value = true;
  actionError.value = '';
  actionMessage.value = '';
  try {
    const value = await action();
    if (
      value.lowflowDefinition?.schemaVersion !==
        props.definition.schemaVersion ||
      ![4, 5].includes(value.lowflowDefinition?.schemaVersion ?? 0)
    )
      throw new Error('服务端返回的设计格式不匹配，当前设计已保留。');
    const graph = value.lowflowDefinition as EditableGraph;
    const messages =
      graph.schemaVersion === 5
        ? validateTaskGraph(graph, true)
        : validateStateGraph(graph, true);
    if (messages.length > 0) throw new Error(messages.join('；'));
    emit('refreshed', value);
    // 编辑缓冲与已通过检查的固定版本快照分开，真实后续编辑不能污染证明基线。
    emit('update:definition', structuredClone(toRaw(graph)));
    actionMessage.value = message;
  } catch (error) {
    // 请求层可能抛出结构化业务错误；只展示已脱敏的消息，不展开响应正文。
    if (error instanceof Error) actionError.value = error.message;
    else if (typeof error === 'string') actionError.value = error;
    else if (
      error &&
      typeof error === 'object' &&
      'msg' in error &&
      typeof error.msg === 'string'
    )
      actionError.value = error.msg;
    else actionError.value = '操作失败，请重试。';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="state-workbench">
    <!-- 发布与模拟使用服务端真实版本生命周期，任何编辑都撤销旧证明资格。 -->
    <div class="workbench-toolbar">
      <Space wrap>
        <Button
          v-if="permissions.save !== false"
          :loading="busy"
          :disabled="!editable || !dirty"
          @click="
            run(
              () =>
                service.saveDraft(
                  version.id,
                  definition,
                  version.optimisticLock,
                ),
              '草稿已保存，完成设计后执行检查。',
            )
          "
        >
          保存草稿
        </Button>
        <Button
          v-if="permissions.simulate !== false"
          :loading="busy"
          :disabled="!canSimulate"
          type="primary"
          @click="
            run(
              () => service.startSimulation(version.id),
              '检查已执行，请查看服务端报告。',
            )
          "
        >
          执行检查
        </Button>
        <Popconfirm
          v-if="permissions.publish !== false"
          title="发布已通过模拟检查的流程版本？"
          :disabled="!canPublish || busy"
          @confirm="
            run(
              () => service.publishAfterSimulation(version.id),
              '版本已发布。',
            )
          "
        >
          <Button type="primary" :disabled="!canPublish || busy">发布</Button>
        </Popconfirm>
      </Space>
      <span>修改设计 → 保存草稿 → 执行检查 → 发布</span>
    </div>
    <Alert
      v-if="actionError"
      :message="actionError"
      type="error"
      show-icon
      class="mb-3"
    />
    <Alert
      v-if="actionMessage"
      :message="actionMessage"
      type="success"
      show-icon
      class="mb-3"
    />
    <Alert
      v-if="!editable"
      message="当前版本为只读。如需调整，请新建草稿版本。"
      type="info"
      show-icon
      class="mb-3"
    />
    <WorkflowTaskDesigner
      v-if="definition.schemaVersion === 5"
      :model-value="definition"
      :options="options"
      :readonly="!editable || busy"
      @update:model-value="emit('update:definition', $event)"
      @validate="
        (value, messages) => {
          valid = value;
          errors = messages;
        }
      "
    />
    <WorkflowGraphDesigner
      v-else
      :model-value="definition"
      :options="options"
      :readonly="!editable || busy"
      @update:model-value="emit('update:definition', $event)"
      @validate="
        (value, messages) => {
          valid = value;
          errors = messages;
        }
      "
    />
    <Collapse class="mt-4">
      <CollapsePanel key="cases" header="检查用例：验证办理与流转路线">
        <p>
          为每条路线配置业务条件值和操作步骤。检查使用服务端隔离引擎，不写正式业务或发送通知。
        </p>
        <article
          v-for="(item, index) in cases"
          :key="index"
          class="simulation-case"
        >
          <Form
            layout="vertical"
            :data-form-id="`workflow-simulation-${index}`"
            data-form-name="流程模拟用例"
          >
            <Form.Item label="用例名称">
              <Input
                :value="item.name"
                :disabled="!editable || busy"
                @update:value="
                  (value) =>
                    changeCases((graph) => {
                      graph.simulationPolicy!.cases[index]!.name = value;
                    })
                "
              />
            </Form.Item>
            <div class="simulation-variables">
              <Form.Item
                v-for="field in simulationFields"
                :key="field.key"
                :label="field.title"
              >
                <Switch
                  v-if="field.type === 'boolean'"
                  :checked="Boolean(item.variables[field.key])"
                  :disabled="!editable || busy"
                  @update:checked="variableValue(index, field.key, $event)"
                />
                <InputNumber
                  v-else-if="['integer', 'decimal'].includes(field.type)"
                  :value="item.variables[field.key] as number"
                  :disabled="!editable || busy"
                  @update:value="variableValue(index, field.key, $event)"
                />
                <Input
                  v-else
                  :value="item.variables[field.key] as string"
                  :disabled="!editable || busy"
                  @update:value="variableValue(index, field.key, $event)"
                />
              </Form.Item>
            </div>
            <div
              v-for="(step, stepIndex) in item.steps"
              :key="stepIndex"
              class="simulation-step"
            >
              <Select
                :value="
                  step.action ||
                  (step.advanceMinutes === undefined ? 'event' : 'advance')
                "
                :disabled="!editable || busy"
                placeholder="选择操作"
                :options="[
                  ...(definition.schemaVersion === 4
                    ? [
                        { value: 'event', label: '触发事件' },
                        { value: 'advance', label: '等待定时器' },
                      ]
                    : []),
                  { value: 'approve', label: '人工同意' },
                  { value: 'reject', label: '人工拒绝' },
                ]"
                @update:value="selectStep(index, stepIndex, $event)"
              />
              <Select
                v-if="!step.action && step.advanceMinutes === undefined"
                :value="step.event"
                :disabled="!editable || busy"
                placeholder="选择事件"
                :options="eventOptions"
                @update:value="
                  (value) =>
                    changeCases((graph) => {
                      graph.simulationPolicy!.cases[index]!.steps[
                        stepIndex
                      ]!.event = value == null ? undefined : String(value);
                    })
                "
              />
              <InputNumber
                v-else-if="step.advanceMinutes !== undefined"
                :value="step.advanceMinutes"
                :min="1"
                :disabled="!editable || busy"
                placeholder="等待分钟数"
                @update:value="
                  (value) =>
                    changeCases((graph) => {
                      graph.simulationPolicy!.cases[index]!.steps[
                        stepIndex
                      ]!.advanceMinutes = Number(value);
                    })
                "
              />
              <Select
                v-else
                :value="step.userId"
                :disabled="!editable || busy"
                placeholder="办理人"
                :options="
                  options.users?.map((user) => ({
                    label: user.label,
                    value: user.id,
                  }))
                "
                @update:value="
                  (value) =>
                    changeCases((graph) => {
                      graph.simulationPolicy!.cases[index]!.steps[
                        stepIndex
                      ]!.userId = value == null ? undefined : String(value);
                    })
                "
              />
              <Select
                v-if="step.action"
                :value="step.nodeId"
                :disabled="!editable || busy"
                placeholder="选择办理任务"
                allow-clear
                aria-label="模拟办理任务"
                :options="approvalNodeOptions"
                @update:value="setStepNode(index, stepIndex, $event)"
              />
              <Select
                :value="step.expectNodeId"
                :disabled="!editable || busy"
                allow-clear
                placeholder="期望到达步骤（可选）"
                :options="nodeOptions"
                @update:value="
                  (value) =>
                    changeCases((graph) => {
                      graph.simulationPolicy!.cases[index]!.steps[
                        stepIndex
                      ]!.expectNodeId =
                        value == null ? undefined : String(value);
                    })
                "
              />
              <Button
                :disabled="!editable || busy"
                danger
                @click="
                  changeCases((graph) => {
                    graph.simulationPolicy!.cases[index]!.steps.splice(
                      stepIndex,
                      1,
                    );
                  })
                "
              >
                移除步骤
              </Button>
              <WorkflowSimulationForm
                v-if="step.action && step.nodeId"
                :fields="stepFields(step.nodeId, step.action)"
                :model-value="step.formData"
                :required-fields="stepRequired(step.nodeId, step.action)"
                :readonly="!editable || busy"
                @update:model-value="setStepForm(index, stepIndex, $event)"
              />
            </div>
            <Space class="mt-2">
              <Button
                :disabled="!editable || busy"
                @click="
                  changeCases((graph) =>
                    graph.simulationPolicy!.cases[index]!.steps.push({
                      ...(definition.schemaVersion === 5
                        ? { action: 'approve', formData: {} }
                        : { event: eventOptions[0]?.value ?? '' }),
                    }),
                  )
                "
              >
                添加步骤
              </Button>
              <Button
                danger
                :disabled="!editable || busy"
                @click="
                  changeCases((graph) => {
                    graph.simulationPolicy!.cases.splice(index, 1);
                  })
                "
              >
                删除用例
              </Button>
            </Space>
          </Form>
        </article>
        <Alert
          v-if="simulationFormErrors.length > 0"
          class="mb-3"
          type="warning"
          :message="simulationFormErrors.join('；')"
        />
        <Button :disabled="!editable || busy" @click="addCase">
          添加检查用例
        </Button>
      </CollapsePanel>
      <CollapsePanel
        key="checks"
        :header="`设计检查（${errors.length} 项待处理）`"
      >
        <ul>
          <li v-for="error in errors" :key="error">{{ error }}</li>
        </ul>
        <p v-if="errors.length === 0">
          图形设计校验通过，请保存并执行真实引擎检查。
        </p>
      </CollapsePanel>
    </Collapse>
    <Alert
      v-if="version.simulationReport"
      class="mt-4"
      :type="version.simulationReport.successful ? 'success' : 'warning'"
      :message="
        version.simulationReport.successful ? '模拟检查通过' : '模拟检查未通过'
      "
      :description="
        version.simulationReport.message ||
        `覆盖路线 ${version.simulationReport.coveredBranches?.length ?? 0} 条；未覆盖 ${version.simulationReport.uncoveredBranches?.length ?? 0} 条。`
      "
      show-icon
    />
  </section>
</template>

<style scoped>
/* 主要动作始终在图前，检查用例为结构化编辑，不要求业务人员填写原始 JSON。 */
.workbench-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.workbench-toolbar > span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
.simulation-case {
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 14px;
  margin: 12px 0;
}
.simulation-step,
.simulation-variables {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}
</style>
