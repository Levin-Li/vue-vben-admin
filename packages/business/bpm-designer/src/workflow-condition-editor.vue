<script setup lang="ts">
import type {
  WorkflowBusinessAction,
  WorkflowCondition,
  WorkflowOperand,
  WorkflowVariable,
} from './types';

import { computed } from 'vue';

import WorkflowParameterEditor from './workflow-parameter-editor.vue';

// 条件编辑器递归表达规则树，不接收或执行脚本字符串。
defineOptions({ name: 'WorkflowConditionEditor' });
const props = withDefaults(
  defineProps<{
    allowDependencies?: boolean;
    depth?: number;
    modelValue?: WorkflowCondition;
    purposeOptions?: { label: string; value: string }[];
    readonly?: boolean;
    validators?: Record<string, WorkflowBusinessAction>;
    variables?: Record<string, WorkflowVariable>;
  }>(),
  {
    depth: 0,
    variables: () => ({}),
    modelValue: undefined,
    purposeOptions: () => [],
    validators: () => ({}),
  },
);
const emit = defineEmits<{
  'update:modelValue': [value: undefined | WorkflowCondition];
}>();
const operators = computed(() => [
  { key: 'all', label: '全部满足 AND' },
  { key: 'any', label: '任一满足 OR' },
  { key: 'not', label: '不满足 NOT' },
  { key: 'eq', label: '等于' },
  { key: 'ne', label: '不等于' },
  { key: 'gt', label: '大于' },
  { key: 'gte', label: '大于等于' },
  { key: 'lt', label: '小于' },
  { key: 'lte', label: '小于等于' },
  { key: 'in', label: '属于集合' },
  { key: 'isNull', label: '为空' },
  { key: 'exists', label: '存在' },
  ...(Object.keys(props.validators ?? {}).length > 0
    ? [{ key: 'validator', label: '业务校验器' }]
    : []),
  ...(props.allowDependencies
    ? [{ key: 'dependency', label: '前置用途结果' }]
    : []),
]);
const operator = computed(() => Object.keys(props.modelValue ?? {})[0] ?? '');
const children = computed(
  () =>
    props.modelValue?.all ??
    props.modelValue?.any ??
    (props.modelValue?.not ? [props.modelValue.not] : []),
);
const operands = computed(
  () =>
    (props.modelValue as Record<string, unknown>)?.[operator.value] as
      | undefined
      | WorkflowOperand
      | WorkflowOperand[],
);
const variable = computed(() =>
  Array.isArray(operands.value)
    ? (operands.value[0]?.variable ?? '')
    : (operands.value?.variable ?? ''),
);
const literal = computed(() =>
  Array.isArray(operands.value) ? operands.value[1]?.literal : undefined,
);
const variableType = computed(
  () => props.variables[variable.value]?.type ?? 'string',
);

// 修改运算符时新建符合形状的节点；比较值保持声明类型，布尔 false 不视作空值。
function changeOperator(value: string) {
  if (!value) return emit('update:modelValue', undefined);
  if (value === 'in')
    return emit('update:modelValue', {
      in: [{ variable: variable.value }, { literal: [] }],
    });
  if (value === 'dependency')
    return emit('update:modelValue', {
      dependency: {
        purposeKey: '',
        outcome: 'Approved',
        round: 'current',
        effects: 'Applied',
      },
    });
  if (value === 'validator')
    return emit('update:modelValue', {
      validator: { key: '', parameters: {} },
    });
  if (value === 'all' || value === 'any')
    return emit('update:modelValue', {
      [value]: [{ eq: [{ variable: '' }, { literal: '' }] }],
    });
  if (value === 'not')
    return emit('update:modelValue', {
      not: { eq: [{ variable: '' }, { literal: '' }] },
    });
  emit('update:modelValue', {
    [value]:
      value === 'exists' || value === 'isNull'
        ? { variable: variable.value }
        : [{ variable: variable.value }, { literal: literal.value ?? '' }],
  });
}
function updateLeaf(key: string, value: unknown) {
  emit('update:modelValue', {
    [operator.value]:
      operator.value === 'exists' || operator.value === 'isNull'
        ? { variable: key }
        : [{ variable: key }, { literal: value }],
  });
}
function updateVariable(key: string) {
  const type = props.variables[key]?.type;
  let value: unknown = '';
  if (type === 'boolean') value = false;
  if (type === 'integer' || type === 'decimal') value = 0;
  if (operator.value === 'in' || type === 'stringSet') value = [];
  updateLeaf(key, value);
}
function updateLiteral(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  let literalValue: unknown = value;
  if (variableType.value === 'boolean') literalValue = value === 'true';
  if (variableType.value === 'integer' || variableType.value === 'decimal')
    literalValue = value === '' ? null : Number(value);
  updateLeaf(variable.value, literalValue);
}
function updateCollection(event: Event) {
  const entries = (event.target as HTMLTextAreaElement).value
    .split('\n')
    .filter((value) => value.length > 0);
  const values = entries.map((value) => {
    if (variableType.value === 'boolean' && value === 'true') return true;
    if (variableType.value === 'boolean' && value === 'false') return false;
    if (variableType.value === 'integer' || variableType.value === 'decimal')
      return Number(value);
    return value;
  });
  updateLeaf(variable.value, values);
}
function updateChild(index: number, value?: WorkflowCondition) {
  const next = [...children.value];
  if (value) next[index] = value;
  else next.splice(index, 1);
  if (operator.value === 'not')
    return emit('update:modelValue', next[0] ? { not: next[0] } : undefined);
  emit('update:modelValue', { [operator.value]: next });
}
function addChild() {
  emit('update:modelValue', {
    [operator.value]: [
      ...children.value,
      { eq: [{ variable: '' }, { literal: '' }] },
    ],
  });
}

// 前置结果始终锁定当前轮次且业务结果已经应用，不允许设计者降低证据要求。
function updateDependency(patch: { outcome?: string; purposeKey?: string }) {
  emit('update:modelValue', {
    dependency: {
      purposeKey: '',
      outcome: 'Approved',
      round: 'current',
      effects: 'Applied',
      ...props.modelValue?.dependency,
      ...patch,
    },
  });
}
</script>

<template>
  <!-- 每层都有明确逻辑名称和删除入口，嵌套深度受界面约束且服务端再次校验。 -->
  <div class="condition-tree">
    <div class="condition-row">
      <select
        aria-label="条件运算符"
        :disabled="readonly"
        :value="operator"
        @change="changeOperator(($event.target as HTMLSelectElement).value)"
      >
        <option value="">不设置条件</option>

        <option
          v-for="item in operators"
          :key="item.key"
          :value="item.key"
          :disabled="depth >= 8 && ['all', 'any', 'not'].includes(item.key)"
        >
          {{ item.label }}
        </option>
      </select>
      <template v-if="operator === 'dependency'">
        <input
          aria-label="前置用途标识"
          :disabled="readonly"
          :value="modelValue?.dependency?.purposeKey"
          placeholder="前置用途标识"
          @input="
            updateDependency({
              purposeKey: ($event.target as HTMLInputElement).value,
            })
          "
        />
        <select
          aria-label="前置流程所需结果"
          :disabled="readonly"
          :value="modelValue?.dependency?.outcome"
          @change="
            updateDependency({
              outcome: ($event.target as HTMLSelectElement).value,
            })
          "
        >
          <option value="Approved">通过</option>

          <option value="Rejected">拒绝</option>

          <option value="Withdrawn">撤回</option>

          <option value="Terminated">终止</option>
        </select>
      </template>
      <select
        v-if="operator === 'validator'"
        aria-label="业务校验器"
        :disabled="readonly"
        :value="modelValue?.validator?.key"
        @change="
          emit('update:modelValue', {
            validator: {
              key: ($event.target as HTMLSelectElement).value,
              parameters: {},
            },
          })
        "
      >
        <option value="">选择只读校验器</option>

        <option v-for="(validator, key) in validators" :key="key" :value="key">
          {{ validator.title }}
        </option>
      </select>
      <template
        v-if="
          operator &&
          !['all', 'any', 'not', 'dependency', 'validator'].includes(operator)
        "
      >
        <select
          aria-label="条件变量"
          :disabled="readonly"
          :value="variable"
          @change="updateVariable(($event.target as HTMLSelectElement).value)"
        >
          <option value="">选择变量</option>

          <option v-for="(item, key) in variables" :key="key" :value="key">
            {{ key }}
            ·
            {{ item.type }}
          </option>
        </select>
        <template v-if="!['exists', 'isNull'].includes(operator)">
          <textarea
            v-if="operator === 'in' || variableType === 'stringSet'"
            aria-label="条件集合值"
            :disabled="readonly"
            :value="Array.isArray(literal) ? literal.join('\n') : ''"
            placeholder="每行一个值；布尔值填写 true 或 false"
            @input="updateCollection"
          ></textarea>
          <select
            v-else-if="variableType === 'boolean'"
            aria-label="条件比较值"
            :disabled="readonly"
            :value="String(literal)"
            @change="updateLiteral"
          >
            <option value="true">是</option>

            <option value="false">否</option>
          </select>
          <input
            v-else
            aria-label="条件比较值"
            :disabled="readonly"
            :type="
              ['integer', 'decimal'].includes(variableType)
                ? 'number'
                : variableType === 'date'
                  ? 'date'
                  : 'text'
            "
            :step="variableType === 'integer' ? '1' : 'any'"
            :value="literal"
            @input="updateLiteral"
          />
        </template>
      </template>
      <button
        v-if="operator"
        :disabled="readonly"
        type="button"
        @click="emit('update:modelValue', undefined)"
      >
        移除条件
      </button>
    </div>
    <div v-if="children.length > 0" class="condition-children">
      <WorkflowConditionEditor
        v-for="(child, index) in children"
        :key="index"
        :model-value="child"
        :variables="variables"
        :readonly="readonly"
        :depth="depth + 1"
        :allow-dependencies="allowDependencies"
        :purpose-options="purposeOptions"
        :validators="validators"
        @update:model-value="updateChild(index, $event)"
      />
    </div>
    <WorkflowParameterEditor
      v-if="operator === 'validator' && modelValue?.validator?.key"
      :model-value="modelValue.validator.parameters"
      :parameters="validators?.[modelValue.validator.key]?.parameters"
      :variables="variables"
      :readonly="readonly"
      @update:model-value="
        emit('update:modelValue', {
          validator: { key: modelValue!.validator!.key, parameters: $event },
        })
      "
    />
    <button
      v-if="['all', 'any'].includes(operator)"
      :disabled="readonly || children.length >= 32"
      type="button"
      @click="addChild"
    >
      添加子条件
    </button>
  </div>
</template>

<style scoped>
/* 条件树沿用宿主主题，缩进仅表达逻辑嵌套。 */
.condition-tree {
  padding: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}
.condition-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.condition-children {
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0 0.75rem 1rem;
}
select,
input,
textarea,
button {
  padding: 0.4rem 0.6rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  min-width: 0;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
