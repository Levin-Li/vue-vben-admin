<script setup lang="ts">
import type {
  WorkflowCapabilityField,
  WorkflowOperand,
  WorkflowVariable,
} from './types';

// 业务操作和只读校验器共享同一参数契约，始终输出显式 variable/literal 引用。
const props = withDefaults(
  defineProps<{
    modelValue?: Record<string, WorkflowOperand>;
    parameters?: Record<string, WorkflowCapabilityField>;
    readonly?: boolean;
    variables?: Record<string, WorkflowVariable>;
  }>(),
  { modelValue: () => ({}), parameters: () => ({}), variables: () => ({}) },
);
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, WorkflowOperand>];
}>();
function set(key: string, operand?: WorkflowOperand) {
  if (props.readonly) return;
  const next = { ...props.modelValue };
  if (operand) next[key] = operand;
  else delete next[key];
  emit('update:modelValue', next);
}
function mode(key: string) {
  if (!props.modelValue[key]) return '';
  return props.modelValue[key]?.variable === undefined ? 'literal' : 'variable';
}
function changeMode(key: string, value: string) {
  if (!value) return set(key);
  if (value === 'variable') return set(key, { variable: '' });
  const type = props.parameters[key]?.type;
  let literal: unknown = '';
  if (type === 'boolean') literal = false;
  if (type === 'decimal' || type === 'integer') literal = 0;
  if (type === 'stringSet') literal = [];
  set(key, { literal });
}
function changeLiteral(key: string, value: string) {
  const type = props.parameters[key]?.type;
  let literal: unknown = value;
  if (type === 'boolean') literal = value === 'true';
  if (type === 'integer' || type === 'decimal')
    literal = value === '' ? null : Number(value);
  if (type === 'stringSet')
    literal = value.split('\n').filter((item) => item.length > 0);
  set(key, { literal });
}
</script>

<template>
  <div class="parameters">
    <div v-for="(parameter, key) in parameters" :key="key" class="parameter">
      <label>
        {{ parameter.title }}
        {{ parameter.nullable ? '（可选）' : '（必填）' }}
        <select
          :disabled="readonly"
          :value="mode(key)"
          :aria-label="`${parameter.title}参数来源`"
          @change="changeMode(key, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">未设置</option>

          <option value="literal">固定值</option>

          <option value="variable">流程变量</option>
        </select>
      </label>
      <label v-if="mode(key) === 'variable'">
        变量
        <select
          :disabled="readonly"
          :value="modelValue[key]?.variable"
          :aria-label="`${parameter.title}参数变量`"
          @change="
            set(key, { variable: ($event.target as HTMLSelectElement).value })
          "
        >
          <option value="">请选择变量</option>

          <option
            v-for="(variable, name) in variables"
            :key="name"
            :value="name"
            :disabled="variable.type !== parameter.type"
          >
            {{ name }}
            ·
            {{ variable.type }}
          </option>
        </select>
      </label>
      <label v-if="mode(key) === 'literal'">
        值

        <select
          v-if="parameter.type === 'boolean'"
          :disabled="readonly"
          :value="String(modelValue[key]?.literal)"
          :aria-label="`${parameter.title}参数值`"
          @change="
            changeLiteral(key, ($event.target as HTMLSelectElement).value)
          "
        >
          <option value="true">是</option>

          <option value="false">否</option>
        </select>

        <select
          v-else-if="parameter.type === 'enum'"
          :disabled="readonly"
          :value="modelValue[key]?.literal"
          :aria-label="`${parameter.title}参数值`"
          @change="
            changeLiteral(key, ($event.target as HTMLSelectElement).value)
          "
        >
          <option value="">请选择</option>

          <option
            v-for="value in parameter.enumValues"
            :key="value"
            :value="value"
          >
            {{ value }}
          </option>
        </select>

        <textarea
          v-else-if="parameter.type === 'stringSet'"
          :disabled="readonly"
          :value="(modelValue[key]?.literal as string[])?.join('\n')"
          :aria-label="`${parameter.title}参数值`"
          placeholder="每行一个值"
          @input="
            changeLiteral(key, ($event.target as HTMLTextAreaElement).value)
          "
        ></textarea>

        <input
          v-else
          :disabled="readonly"
          :value="modelValue[key]?.literal"
          :aria-label="`${parameter.title}参数值`"
          :type="
            ['decimal', 'integer'].includes(parameter.type)
              ? 'number'
              : parameter.type === 'date'
                ? 'date'
                : parameter.type === 'datetime'
                  ? 'datetime-local'
                  : 'text'
          "
          :step="parameter.type === 'integer' ? '1' : 'any'"
          @input="changeLiteral(key, ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
/* 参数网格保持类型提示与输入紧邻，使用宿主主题。 */
.parameters {
  display: grid;
  gap: 0.75rem;
}
.parameter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.5rem 0;
}
label {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 150px;
}
input,
select,
textarea {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  padding: 0.5rem;
  min-width: 0;
}
</style>
