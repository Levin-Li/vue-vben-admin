<script setup lang="ts">
import type {
  WorkflowBusinessObjectField,
  WorkflowStateValue,
} from './workflow-state-graph';

import { Form, Input, InputNumber, Select } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    fields: WorkflowBusinessObjectField[];
    modelValue?: Record<string, unknown>;
    readonly?: boolean;
    requiredFields?: string[];
  }>(),
  { modelValue: () => ({}), requiredFields: () => [], readonly: false },
);
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
}>();

// 使用与业务字段相同的类型和选项，模拟不会把整数、布尔值转成字符串。
function update(key: string, value: unknown) {
  if (props.readonly) return;
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
function missing(key: string) {
  const value = props.modelValue[key];
  return (
    props.requiredFields.includes(key) &&
    (value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0))
  );
}
function booleanValue(key: string) {
  const value = props.modelValue[key];
  if (typeof value === 'boolean') return String(value);
  return undefined;
}
</script>

<template>
  <div class="simulation-form" aria-label="模拟办理表单">
    <Form.Item
      v-for="field in fields"
      :key="field.key"
      :label="field.title"
      :required="requiredFields.includes(field.key)"
      :validate-status="missing(field.key) ? 'error' : undefined"
      :help="missing(field.key) ? `请填写${field.title}` : field.description"
    >
      <Select
        v-if="field.options?.length"
        :value="modelValue[field.key] as WorkflowStateValue"
        :options="field.options"
        :disabled="readonly"
        :aria-label="`模拟办理 ${field.title}`"
        allow-clear
        @update:value="update(field.key, $event)"
      />
      <Select
        v-else-if="field.type === 'boolean'"
        :value="booleanValue(field.key)"
        :options="[
          { value: 'true', label: '是' },
          { value: 'false', label: '否' },
        ]"
        :disabled="readonly"
        :aria-label="`模拟办理 ${field.title}`"
        allow-clear
        @update:value="
          update(
            field.key,
            $event === undefined ? undefined : $event === 'true',
          )
        "
      />
      <InputNumber
        v-else-if="['integer', 'decimal'].includes(field.type)"
        :value="modelValue[field.key] as number"
        :precision="field.type === 'integer' ? 0 : undefined"
        :disabled="readonly"
        :aria-label="`模拟办理 ${field.title}`"
        @update:value="update(field.key, $event)"
      />
      <Select
        v-else-if="field.type === 'stringSet'"
        mode="tags"
        :value="modelValue[field.key] as string[]"
        :disabled="readonly"
        :aria-label="`模拟办理 ${field.title}`"
        @update:value="update(field.key, $event)"
      />
      <Input
        v-else
        :value="modelValue[field.key] as string"
        :type="
          field.type === 'date'
            ? 'date'
            : field.type === 'datetime'
              ? 'datetime-local'
              : 'text'
        "
        :disabled="readonly"
        :aria-label="`模拟办理 ${field.title}`"
        @update:value="update(field.key, $event)"
      />
    </Form.Item>
  </div>
</template>

<style scoped>
/* 办理输入跟随步骤展示，复用字段标题和必填提示，窄容器保持可读。 */
.simulation-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  grid-column: 1/-1;
}
.simulation-form :deep(.ant-input-number) {
  width: 100%;
}
</style>
