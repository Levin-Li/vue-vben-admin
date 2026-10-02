<script setup lang="ts">
import type {
  WorkflowCondition,
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
const variableField = ref('');
const outcome = ref('Approved');
const outcomeAction = ref('');
const tabs = [
  { key: 'binding', label: '选择业务对象' },
  { key: 'graph', label: '审批步骤' },
  { key: 'start', label: '发起规则' },
  { key: 'outcomes', label: '完成后处理' },
  { key: 'preview', label: '检查流程' },
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
  { key: 'identityField', label: '记录编号' },
  { key: 'titleField', label: '记录名称' },
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
// 同一对象的多个受控方案由设计者明确选择，不按版本号替用户选择。
const selectedBusinessType = ref('');
const businessChoices = computed(() => [
  ...new Map(
    (props.options.businessTypes ?? []).map((item) => [
      item.businessType,
      item,
    ]),
  ).values(),
]);
const selectedObject = computed(
  () =>
    selectedBusinessType.value ||
    props.modelValue.businessBinding?.businessType ||
    (businessChoices.value.length === 1
      ? businessChoices.value[0]?.businessType
      : '') ||
    '',
);
const businessSchemes = computed(() =>
  (props.options.businessTypes ?? []).filter(
    (item) => item.businessType === selectedObject.value,
  ),
);
watch(
  () => props.modelValue.businessBinding?.businessType,
  (value) => {
    if (value) selectedBusinessType.value = value;
  },
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
  Object.entries(business.value?.approverResolvers ?? {}).filter(
    ([, resolver]) => resolver.simulation === true,
  ),
);
const selectedApproverResolver = computed(
  () =>
    approverResolvers.value.find(
      ([key]) => key === selectedNode.value?.approverResolver?.key,
    )?.[1],
);
const simulatableValidators = computed(() =>
  Object.fromEntries(
    Object.entries(business.value?.validators ?? {}).filter(
      ([, validator]) => validator.simulation === true,
    ),
  ),
);
const simulatableActions = computed(() =>
  Object.fromEntries(
    Object.entries(business.value?.actions ?? {}).filter(
      ([, action]) => action.simulation === true,
    ),
  ),
);
const conditionFields = computed(() =>
  fields.value.filter(
    (field) => field.condition && field.sensitivity !== 'secret',
  ),
);
const variableLabels = computed(() =>
  Object.fromEntries(
    Object.entries(props.modelValue.variables ?? {}).map(([key, variable]) => [
      key,
      fields.value.find((field) => variable.source === `business.${field.key}`)
        ?.title ?? '已配置业务字段',
    ]),
  ),
);
const variableOptions = computed(() =>
  Object.fromEntries(
    Object.entries(props.modelValue.variables ?? {}).map(([key, variable]) => [
      key,
      fields.value.find((field) => variable.source === `business.${field.key}`)
        ?.enumValues ?? [],
    ]),
  ),
);
const displayFields = computed(() =>
  fields.value.filter(
    (field) => field.display && field.sensitivity !== 'secret',
  ),
);
const rawValidationMessages = computed(() =>
  validateTreeDefinition(props.modelValue, props.options),
);
const validationMessages = computed(() => {
  // 执行校验不变，主界面把受控键替换为中文业务名称；原文留在实施者区。
  const labels = new Map<string, string>([
    ...fields.value.map(
      (field) => [field.key, field.title] as [string, string],
    ),
    ...Object.entries(variableLabels.value),
    ...nodes.value.map((node) => [node.id, node.name] as [string, string]),
    ...Object.entries(business.value?.actions ?? {}).map(
      ([key, action]) => [key, action.title] as [string, string],
    ),
    ...Object.entries(business.value?.approverResolvers ?? {}).map(
      ([key, resolver]) => [key, resolver.title] as [string, string],
    ),
    ...outcomes.map((item) => [item.value, item.label] as [string, string]),
  ]);
  return rawValidationMessages.value.map((message) =>
    message
      .replace('请填写流程标识。', '流程内部信息未准备好，请联系管理员检查。')
      .replace('请填写业务用途标识。', '流程用途未准备好，请联系管理员检查。')
      .replace(
        '请配置业务主键字段。',
        '记录编号未准备好，请联系管理员补齐业务说明。',
      )
      .replace(
        '请配置业务标题字段。',
        '记录名称未准备好，请联系管理员补齐业务说明。',
      )
      .replace('请选择业务对象并配置字段映射。', '请选择业务对象及适用方案。')
      .replaceAll(
        /「([^」]+)」/g,
        (_, key: string) =>
          `「${labels.get(key) ?? (/^[\w.@:-]+$/.test(key) ? '已配置项' : key)}」`,
      )
      .replaceAll('业务契约', '业务方案')
      .replaceAll('变量', '判断字段')
      .replaceAll(
        '候选用户、候选组或动态审批人',
        '办理人员、角色组织或动态审批人',
      )
      .replaceAll('前置用途标识', '前置流程')
      .replaceAll('节点', '步骤'),
  );
});
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
function selectObject(value: string) {
  if (props.readonly) return;
  selectedBusinessType.value = value;
  const schemes =
    props.options.businessTypes?.filter(
      (item) => item.businessType === value,
    ) ?? [];
  if (schemes.length === 1) {
    const scheme = schemes[0]!;
    selectBusiness(`${scheme.businessType}@${scheme.contractVersion}`);
  } else {
    updateDefinition((draft) => {
      delete draft.businessBinding;
    });
  }
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
      identityField: selected.defaultBinding?.identityField ?? '',
      titleField: selected.defaultBinding?.titleField ?? '',
      ...(selected.defaultBinding?.applicantField
        ? { applicantField: selected.defaultBinding.applicantField }
        : {}),
      ...(selected.defaultBinding?.summaryField
        ? { summaryField: selected.defaultBinding.summaryField }
        : {}),
    };
    // 更换契约保留原有变量供用户明确修正，未知字段在校验中拒绝，不能静默重映射。
  });
}
function updateBinding(key: string, value: string) {
  updateDefinition((draft) => {
    if (!draft.businessBinding) return;
    // 可选字段清空后移除键；必需字段保留空字符串供设计校验提示。
    if (!value && (key === 'applicantField' || key === 'summaryField'))
      delete draft.businessBinding[key];
    else Object.assign(draft.businessBinding, { [key]: value });
  });
}
function updatePolicy(
  patch: Partial<NonNullable<WorkflowTreeVersion['startPolicy']>>,
) {
  updateDefinition((draft) => {
    draft.startPolicy = { mode: 'manual', ...draft.startPolicy, ...patch };
    // 清空条件须删除可选属性，不能把 undefined 留进唯一的 JSON 设计事实。
    if (Object.hasOwn(patch, 'condition') && patch.condition === undefined)
      delete draft.startPolicy.condition;
  });
}
function updateDependencies(condition?: WorkflowCondition) {
  updateDefinition((draft) => {
    // 清空前置流程时删除整个可选节点，避免草稿校验把 undefined 当作非法配置。
    if (condition) draft.dependencies = condition;
    else delete draft.dependencies;
  });
}
function addVariable() {
  const field = conditionFields.value.find(
    (item) => item.key === variableField.value,
  );
  // 变量标识由系统生成；禁止同一字段重复登记，也不把字段键当作变量名。
  if (
    !field ||
    Object.values(props.modelValue.variables ?? {}).some(
      (variable) => variable.source === `business.${field.key}`,
    )
  )
    return;
  let index = 1;
  while (props.modelValue.variables?.[`field_${index}`]) index++;
  const key = `field_${index}`;
  updateDefinition((draft) => {
    draft.variables ??= {};
    draft.variables[key] = {
      source: `business.${field.key}`,
      type: field.type,
      readAt: 'start',
    };
  });
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
  if (!approverResolvers.value.some(([candidate]) => candidate === key)) return;
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
  if (
    !outcomeAction.value ||
    business.value?.actions?.[outcomeAction.value]?.simulation !== true
  )
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
    <!-- 主路径只展示业务名称；稳定键由宿主和后端管理。 -->
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

    <!-- 业务设计者选中文业务对象，字段角色由受控目录预填。 -->
    <div v-if="activeTab === 'binding'" class="panel">
      <h3>这个流程处理什么业务？</h3>

      <label>
        选择业务对象

        <select
          aria-label="选择业务对象"
          :disabled="readonly"
          :value="selectedObject"
          @change="selectObject(text($event))"
        >
          <option value="">请选择业务对象</option>
          <option
            v-for="item in businessChoices"
            :key="item.businessType"
            :value="item.businessType"
          >
            {{ item.title }}
          </option>
        </select>
      </label>
      <label v-if="businessSchemes.length > 1">
        使用哪套业务方案？
        <select
          aria-label="业务方案"
          :disabled="readonly"
          :value="
            business
              ? `${business.businessType}@${business.contractVersion}`
              : ''
          "
          @change="selectBusiness(text($event))"
        >
          <option value="">请选择业务方案</option>
          <option
            v-for="(item, index) in businessSchemes"
            :key="`${item.businessType}@${item.contractVersion}`"
            :value="`${item.businessType}@${item.contractVersion}`"
          >
            {{ item.title }} · 方案 {{ index + 1
            }}{{ item === business ? '（当前流程）' : '' }}
          </option>
        </select>
      </label>
      <p v-if="businessSchemes.length > 1 && !business" class="hint">
        此对象有多套业务方案，请选择适用方案；不能由系统替您决定。
      </p>
      <p v-if="!options.businessTypes?.length" class="hint">
        暂无可配置的业务对象，请联系管理员开通。
      </p>
      <p
        v-if="
          modelValue.businessBinding &&
          (!modelValue.businessBinding.identityField ||
            !modelValue.businessBinding.titleField)
        "
        class="hint"
      >
        此业务对象缺少记录编号或名称的受控说明，请联系管理员补齐后再发布。
      </p>
      <details v-if="modelValue.businessBinding" class="technical-details">
        <summary>字段对应关系（通常由系统填写）</summary>
        <div class="form-grid">
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
              </option>
            </select>
          </label>
        </div>
      </details>
      <h3>可用于判断的业务字段</h3>
      <p class="hint">
        需要按业务数据决定是否发起或走哪条审批路线时，在这里选择字段；权限和归属由系统处理。
      </p>
      <div class="inline-form">
        <label>
          业务字段

          <select v-model="variableField" :disabled="readonly">
            <option value="">选择可判断字段</option>

            <option
              v-for="field in conditionFields"
              :key="field.key"
              :value="field.key"
            >
              {{ field.title }}
            </option>
          </select>
        </label>
        <button
          type="button"
          :disabled="
            readonly ||
            !variableField ||
            Object.values(modelValue.variables ?? {}).some(
              (variable) => variable.source === `business.${variableField}`,
            )
          "
          @click="addVariable"
        >
          添加判断字段
        </button>
      </div>
      <table v-if="Object.keys(modelValue.variables ?? {}).length > 0">
        <thead>
          <tr>
            <th>业务字段</th>
            <th>取值时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(variable, key) in modelValue.variables" :key="key">
            <td>
              {{
                fields.find(
                  (field) => variable.source === `business.${field.key}`,
                )?.title ?? '已配置字段'
              }}
            </td>
            <td>
              <select
                :aria-label="`${variableLabels[key]}取值时间`"
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
                <option value="start">发起时的值</option>

                <option value="node">进入步骤时的值</option>
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
                移除字段
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 启动资格与同轮次用途依赖独立配置，自动模式必须显式选择事件和主体。 -->
    <div v-if="activeTab === 'start'" class="panel">
      <h3>怎样发起这个流程？</h3>
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
      </div>
      <details
        class="technical-details"
        :open="modelValue.startPolicy?.mode === 'event'"
      >
        <summary>高级发起设置（由管理员维护）</summary>
        <label>
          同一事项匹配顺序
          <input
            type="number"
            :disabled="readonly"
            :value="modelValue.startPolicy?.priority ?? 0"
            @input="updatePolicy({ priority: Number(text($event)) })"
          />
        </label>
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
      </details>
      <h3>什么时候允许发起？</h3>
      <WorkflowConditionEditor
        :model-value="modelValue.startPolicy?.condition"
        :validators="simulatableValidators"
        :variables="modelValue.variables"
        :variable-labels="variableLabels"
        :variable-options="variableOptions"
        :readonly="readonly"
        @update:model-value="updatePolicy({ condition: $event })"
      />
      <h3>需要先完成哪些流程？</h3>
      <p class="hint">
        仅同一业务对象、本轮最新有效且业务结果已应用的实例可满足依赖。流程结束不等于通过。
      </p>
      <WorkflowConditionEditor
        :model-value="modelValue.dependencies"
        :validators="simulatableValidators"
        :variables="modelValue.variables"
        :variable-labels="variableLabels"
        :variable-options="variableOptions"
        :readonly="readonly"
        :purpose-options="options.purposeOptions"
        allow-dependencies
        @update:model-value="updateDependencies"
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
          添加审批步骤
        </button>
        <button
          :disabled="readonly"
          type="button"
          @click="createNode('exclusiveGateway')"
        >
          按条件分支
        </button>
        <button
          :disabled="readonly"
          type="button"
          @click="createNode('parallelGateway')"
        >
          同时办理
        </button>
        <button :disabled="readonly" type="button" @click="createOutcomeExit">
          添加结束结果
        </button>
        <button :disabled="readonly" type="button" @click="autoLayout">
          整理画布
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
            >
              <template #properties>
                <aside class="node-properties" aria-label="步骤设置">
                  <template v-if="selectedNode">
                    <h3>{{ selectedNode.name }} · 步骤设置</h3>

                    <label>
                      步骤名称
                      <input
                        :disabled="readonly"
                        :value="selectedNode.name"
                        @input="updateNode({ name: text($event) })"
                      />
                    </label>

                    <details class="technical-details">
                      <summary>位置微调（实施者）</summary>
                      <div class="form-grid">
                        <label>
                          横向位置
                          <input
                            type="number"
                            :disabled="readonly"
                            :value="selectedNode.x"
                            @input="
                              updateNode({
                                x: Math.max(0, Number(text($event))),
                              })
                            "
                          />
                        </label>
                        <label>
                          纵向位置
                          <input
                            type="number"
                            :disabled="readonly"
                            :value="selectedNode.y"
                            @input="
                              updateNode({
                                y: Math.max(0, Number(text($event))),
                              })
                            "
                          />
                        </label>
                      </div>
                    </details>
                    <template v-if="selectedNode.type === 'userTask'">
                      <label>
                        谁来审批

                        <select
                          multiple
                          :disabled="readonly"
                          @change="
                            updateNode({ candidateUsers: values($event) })
                          "
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
                        由哪个角色或组织办理

                        <select
                          multiple
                          :disabled="readonly"
                          @change="
                            updateNode({ candidateGroups: values($event) })
                          "
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
                        此业务对象暂无可选择的动态审批人。
                      </p>
                      <p
                        v-if="
                          selectedNode.approverResolver &&
                          !selectedApproverResolver
                        "
                        class="hint"
                      >
                        已配置的审批人规则暂不可用，请重新选择。
                      </p>
                      <div
                        v-if="
                          selectedNode.approverResolver &&
                          selectedApproverResolver
                        "
                        class="parameter-editor"
                      >
                        <p class="hint">
                          {{
                            selectedApproverResolver.title
                          }}：进入步骤时由系统确定有权办理的人员。
                        </p>
                        <WorkflowParameterEditor
                          :readonly="readonly"
                          :model-value="
                            selectedNode.approverResolver.parameters ?? {}
                          "
                          :parameters="
                            selectedApproverResolver.parameters ?? {}
                          "
                          :variables="modelValue.variables ?? {}"
                          :variable-labels="variableLabels"
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
                          @change="
                            updateNode({ allowSelfApproval: checked($event) })
                          "
                        />
                        允许申请人自审
                      </label>

                      <!-- 常见审批先确定办理人，其它规则按需展开。 -->
                      <details class="technical-details">
                        <summary>
                          更多办理设置（退回、字段、时限及验证）
                        </summary>
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
                              :selected="
                                selectedNode.actions?.includes(action.value)
                              "
                              :value="action.value"
                            >
                              {{ action.label }}
                            </option>
                          </select>
                        </label>

                        <template
                          v-if="
                            selectedNode.actions?.some((action) =>
                              ['transfer', 'delegate', 'add-sign'].includes(
                                action,
                              ),
                            )
                          "
                        >
                          <label>
                            转办 / 委派 / 加签目标用户

                            <select
                              multiple
                              :disabled="readonly"
                              @change="
                                updateNode({
                                  actionCandidateUsers: values($event),
                                })
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
                                updateNode({
                                  actionCandidateGroups: values($event),
                                })
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
                            @change="
                              updateNode({ returnTargets: values($event) })
                            "
                          >
                            <option
                              v-for="node in nodes.filter(
                                (item) =>
                                  item.type === 'userTask' &&
                                  item.id !== selectedNode!.id,
                              )"
                              :key="node.id"
                              :value="node.id"
                              :selected="
                                selectedNode.returnTargets?.includes(node.id)
                              "
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
                            @change="
                              updateNode({ readableFields: values($event) })
                            "
                          >
                            <option
                              v-for="field in displayFields"
                              :key="field.key"
                              :selected="
                                selectedNode.readableFields?.includes(field.key)
                              "
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
                              updateNode({
                                formAction: text($event) || undefined,
                              })
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
                            @change="
                              updateNode({ editableFields: values($event) })
                            "
                          >
                            <option
                              v-for="field in editableFields"
                              :key="field.key"
                              :selected="
                                selectedNode.editableFields?.includes(field.key)
                              "
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
                            @change="
                              updateNode({ requiredFields: values($event) })
                            "
                          >
                            <option
                              v-for="field in displayFields.filter((item) =>
                                selectedNode?.editableFields?.includes(
                                  item.key,
                                ),
                              )"
                              :key="field.key"
                              :value="field.key"
                              :selected="
                                selectedNode.requiredFields?.includes(field.key)
                              "
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
                            @change="
                              updateNode({ stepUpVerifyTypes: values($event) })
                            "
                          >
                            <option
                              v-for="option in workflowVerificationOptions"
                              :key="option.value"
                              :value="option.value"
                              :selected="
                                selectedNode.stepUpVerifyTypes?.includes(
                                  option.value,
                                )
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
                              updateNode({
                                deadlineEscalationUsers: values($event),
                              })
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
                            :value="
                              selectedNode.emptyAssigneePolicy ?? 'REJECT'
                            "
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
                        <label
                          v-if="selectedNode.emptyAssigneePolicy === 'ESCALATE'"
                        >
                          升级处理人

                          <select
                            multiple
                            :disabled="readonly"
                            @change="
                              updateNode({
                                escalationCandidateUsers: values($event),
                              })
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
                        <label
                          v-if="selectedNode.emptyAssigneePolicy === 'ESCALATE'"
                        >
                          升级由哪个角色或组织办理

                          <select
                            multiple
                            :disabled="readonly"
                            :value="
                              selectedNode.escalationCandidateGroups ?? []
                            "
                            @change="
                              updateNode({
                                escalationCandidateGroups: values($event),
                              })
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
                      </details>
                    </template>

                    <label v-if="selectedNode.type === 'parallelGateway'">
                      全部支路办完后进入哪个步骤？

                      <select
                        :disabled="readonly"
                        :value="selectedNode.joinId ?? ''"
                        @change="
                          updateNode({ joinId: text($event) || undefined })
                        "
                      >
                        <option value="">此步骤用于等待全部支路完成</option>

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
                      删除当前步骤
                    </button>
                  </template>
                  <template v-else-if="selectedEdge">
                    <h3>走这条路线的条件</h3>

                    <label v-if="selectedEdgeIsExclusive" class="checkbox">
                      <input
                        type="checkbox"
                        :disabled="readonly"
                        :checked="selectedEdge.default"
                        @change="updateEdge({ default: checked($event) })"
                      />
                      其它条件不满足时走这条路线
                    </label>
                    <WorkflowConditionEditor
                      v-if="!selectedEdge.default && selectedEdgeIsExclusive"
                      :model-value="selectedEdge.condition"
                      :validators="simulatableValidators"
                      :variables="modelValue.variables"
                      :variable-labels="variableLabels"
                      :variable-options="variableOptions"
                      :readonly="readonly"
                      @update:model-value="
                        updateEdge({ condition: $event ?? null })
                      "
                    />
                    <p v-if="!selectedEdgeIsExclusive" class="hint">
                      此连线没有可编辑的路由条件；可选中它插入节点。
                    </p>
                  </template>
                  <p v-else class="hint">
                    选择画布节点或连线配置属性。调整位置不会改变流程执行顺序。
                  </p>
                </aside>
              </template>
            </FlowDesign>
            <p v-else class="graph-error" role="alert">
              {{ lowflowGraph.error }}。请检查节点与连线后再模拟或发布。
            </p>
          </div>
          <h3>审批路线</h3>
          <p class="hint">
            选择路线后可以添加审批步骤或分支，系统会连接好前后顺序。
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
          <h3>步骤清单</h3>
          <div v-for="node in nodes" :key="node.id" class="list-row">
            <button
              type="button"
              :aria-label="`配置节点 ${node.name}`"
              @click="
                selectedNodeId = node.id;
                selectedEdgeId = '';
              "
            >
              {{ node.name }}
            </button>
          </div>
        </div>
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
              v-for="(action, key) in simulatableActions"
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
              {{
                business?.actions?.[action.action]?.title ?? '不可用的业务操作'
              }}
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
            :variable-labels="variableLabels"
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
      <h3>发布前检查</h3>
      <p>业务对象：{{ business?.title || '尚未选择' }}</p>
      <p>
        审批步骤：{{ nodes.filter((node) => node.type === 'userTask').length }}
        个
      </p>
      <p>
        用于判断的业务字段：{{ Object.keys(modelValue.variables ?? {}).length }}
        个
      </p>
      <p>未完善的设置：{{ validationMessages.length }} 项</p>
      <details class="technical-details">
        <summary>实施者查看技术配置</summary>
        <div class="form-grid">
          <label>
            流程内部标识
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
              @input="
                updateDefinition((draft) => {
                  draft.purposeKey = text($event);
                })
              "
            />
          </label>
        </div>
        <pre>{{ JSON.stringify(modelValue, null, 2) }}</pre>
        <ul v-if="rawValidationMessages.length > 0">
          <li v-for="message in rawValidationMessages" :key="message">
            {{ message }}
          </li>
        </ul>
      </details>
    </div>

    <!-- 校验结果按实际配置重新计算，发布资格仍由服务端模拟报告决定。 -->
    <details class="validation" :open="validationMessages.length > 0">
      <summary>
        {{
          validationMessages.length > 0
            ? `还有 ${validationMessages.length} 项设置待完善`
            : '基本设置已完成，发布前仍需检查'
        }}
      </summary>
      <ul>
        <li v-for="(message, index) in validationMessages" :key="index">
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
  grid-template-columns: minmax(0, 1fr);
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
