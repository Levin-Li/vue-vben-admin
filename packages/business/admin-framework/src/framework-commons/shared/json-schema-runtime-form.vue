<script lang="ts" setup>
import { computed, reactive } from 'vue';

import { Button, Form, Input, InputNumber, Select, Switch } from 'ant-design-vue';

import {
  getJsonSchemaPathValue,
  setJsonSchemaPathValue,
} from './json-schema-form';
import {
  buildJsonSchemaFormNodes,
  planJsonSchemaColumns,
  type JsonSchemaFormNode,
} from './json-schema-form-layout';

const props = withDefaults(defineProps<{
  disabled?: boolean;
  modelValue?: Record<string, any>;
  schema?: Record<string, any>;
}>(), {
  disabled: false,
  modelValue: () => ({}),
  schema: () => ({}),
});

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, any>] }>();

const nodes = computed(() => buildJsonSchemaFormNodes(props.schema));
const columnCount = computed(() => planJsonSchemaColumns(nodes.value));
const branchSelections = reactive<Record<string, number>>({});

function valueAt(path: string[]) {
  return getJsonSchemaPathValue(props.modelValue, path);
}

function updateAt(path: string[], value: any) {
  emit('update:modelValue', setJsonSchemaPathValue(props.modelValue || {}, path, value));
}

function isFullWidth(node: JsonSchemaFormNode) {
  return node.kind === 'group' || node.kind === 'collection' || node.kind === 'branch'
    || node.kind === 'json' || node.kind === 'textarea';
}

function addCollectionItem(node: Extract<JsonSchemaFormNode, { kind: 'collection' }>) {
  const nextItems = Array.isArray(valueAt(node.path)) ? [...valueAt(node.path)] : [];
  nextItems.push({});
  updateAt(node.path, nextItems);
}

function removeCollectionItem(node: Extract<JsonSchemaFormNode, { kind: 'collection' }>, index: number) {
  const nextItems = Array.isArray(valueAt(node.path)) ? [...valueAt(node.path)] : [];
  nextItems.splice(index, 1);
  updateAt(node.path, nextItems);
}

function updateCollectionItem(node: Extract<JsonSchemaFormNode, { kind: 'collection' }>, index: number, value: Record<string, any>) {
  const nextItems = Array.isArray(valueAt(node.path)) ? [...valueAt(node.path)] : [];
  nextItems[index] = value;
  updateAt(node.path, nextItems);
}

function selectedBranch(node: Extract<JsonSchemaFormNode, { kind: 'branch' }>) {
  return branchSelections[node.pathKey] || 0;
}

function selectBranch(node: Extract<JsonSchemaFormNode, { kind: 'branch' }>, index: number) {
  branchSelections[node.pathKey] = index;
  const branch = node.branches[index];
  if (branch?.schema.const !== undefined) updateAt(node.path, branch.schema.const);
}

function activeBranchSchema(node: Extract<JsonSchemaFormNode, { kind: 'branch' }>) {
  return node.branches[selectedBranch(node)]?.schema;
}
</script>

<template>
  <Form layout="vertical">
    <div class="runtime-schema-grid" :style="{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }">
      <template v-for="node in nodes" :key="node.pathKey">
        <section v-if="node.kind === 'group'" class="runtime-schema-group">
          <div class="runtime-schema-group__title">{{ node.label }}</div>
          <p v-if="node.description" class="runtime-schema-group__description">{{ node.description }}</p>
          <JsonSchemaRuntimeForm
            :disabled="disabled"
            :model-value="valueAt(node.path) || {}"
            :schema="node.schema"
            @update:model-value="updateAt(node.path, $event)"
          />
        </section>

        <section v-else-if="node.kind === 'collection'" class="runtime-schema-group">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="runtime-schema-group__title">{{ node.label }}</div>
              <p v-if="node.description" class="runtime-schema-group__description">{{ node.description }}</p>
            </div>
            <Button :disabled="disabled || node.schema.readOnly" size="small" type="dashed" @click="addCollectionItem(node)">新增一项</Button>
          </div>
          <div v-if="Array.isArray(valueAt(node.path)) && valueAt(node.path).length" class="runtime-schema-collection">
            <div v-for="(item, index) in valueAt(node.path)" :key="index" class="runtime-schema-collection__item">
              <div class="flex justify-end"><Button :disabled="disabled || node.schema.readOnly" danger size="small" type="link" @click="removeCollectionItem(node, Number(index))">删除</Button></div>
              <JsonSchemaRuntimeForm :disabled="disabled" :model-value="item || {}" :schema="node.itemSchema" @update:model-value="updateCollectionItem(node, Number(index), $event)" />
            </div>
          </div>
        </section>

        <section v-else-if="node.kind === 'branch'" class="runtime-schema-group">
          <div class="runtime-schema-group__title">{{ node.label }}</div>
          <Select :disabled="disabled || node.schema.readOnly" :options="node.branches.map((branch, index) => ({ label: branch.label, value: index }))" :value="selectedBranch(node)" class="mt-2 w-full" @update:value="selectBranch(node, Number($event))" />
          <JsonSchemaRuntimeForm v-if="activeBranchSchema(node)?.properties" :disabled="disabled" :model-value="valueAt(node.path) || {}" :schema="activeBranchSchema(node)" @update:model-value="updateAt(node.path, $event)" />
        </section>

        <Form.Item v-else :class="{ 'runtime-schema-full': isFullWidth(node) }" :extra="node.description" :label="node.label" :required="node.required">
          <Select v-if="node.kind === 'select'" :disabled="disabled || node.readOnly" :options="node.options" :value="valueAt(node.path)" allow-clear @update:value="updateAt(node.path, $event)" />
          <Switch v-else-if="node.kind === 'boolean'" :checked="!!valueAt(node.path)" :disabled="disabled || node.readOnly" @update:checked="updateAt(node.path, $event)" />
          <InputNumber v-else-if="node.kind === 'number'" :disabled="disabled || node.readOnly" :value="valueAt(node.path)" class="w-full" @update:value="updateAt(node.path, $event)" />
          <Input.TextArea v-else-if="node.kind === 'json' || node.kind === 'textarea'" :disabled="disabled || node.readOnly" :value="typeof valueAt(node.path) === 'string' ? valueAt(node.path) : JSON.stringify(valueAt(node.path) ?? {}, null, 2)" :auto-size="{ minRows: 3, maxRows: 8 }" @update:value="updateAt(node.path, $event)" />
          <Input.Password v-else-if="node.kind === 'password'" :disabled="disabled || node.readOnly" :value="valueAt(node.path)" @update:value="updateAt(node.path, $event)" />
          <Input v-else :disabled="disabled || node.readOnly" :value="valueAt(node.path)" @update:value="updateAt(node.path, $event)" />
        </Form.Item>
      </template>
    </div>
  </Form>
</template>

<style scoped>
.runtime-schema-grid { display: grid; column-gap: 16px; }
.runtime-schema-full, .runtime-schema-group { grid-column: 1 / -1; }
.runtime-schema-group { border: 1px solid hsl(var(--border)); border-radius: 8px; margin-bottom: 16px; padding: 16px; }
.runtime-schema-group__title { font-weight: 600; }
.runtime-schema-group__description { color: hsl(var(--muted-foreground)); font-size: 12px; margin: 4px 0 12px; }
.runtime-schema-collection { display: grid; gap: 12px; margin-top: 12px; }
.runtime-schema-collection__item { border: 1px dashed hsl(var(--border)); border-radius: 6px; padding: 12px; }
</style>
