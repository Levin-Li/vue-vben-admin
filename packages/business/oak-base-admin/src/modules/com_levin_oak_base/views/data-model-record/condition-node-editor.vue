<script setup lang="ts">
import type { DataModelQueryInput } from '../../api/data-model-service';
import type { EditableConditionNode } from './condition-tree';

import { computed } from 'vue';

import { filterCrudLocalSelectOption } from '@levin/admin-framework/framework-commons/shared/crud-local-search';
import { Button, DatePicker, Input, Select, TimePicker } from 'ant-design-vue';

import {
  canAddCondition,
  newCondition,
  resolveConditionOptions,
  resolveConditionOptionValue,
} from './condition-tree';

const props = defineProps<{
  depth: number;
  inputs: DataModelQueryInput[];
  node: EditableConditionNode;
  root: EditableConditionNode;
  scopeOptions?: Record<string, Array<{ label: string; value: string }>>;
}>();
const emit = defineEmits<{
  remove: [];
  update: [node: EditableConditionNode];
}>();
const selected = computed(() => {
  const node = props.node;
  return node.type === 'PARAM'
    ? props.inputs.find((input) => input.key === node.key)
    : undefined;
});
const options = computed(() =>
  resolveConditionOptions(selected.value, props.scopeOptions),
);
const selectOptions = computed(() =>
  options.value.map((option) => ({
    label: option.label,
    value: String(option.value),
  })),
);
const selectedValue = computed(() =>
  props.node.type === 'PARAM' &&
  props.node.value !== null &&
  props.node.value !== undefined
    ? String(props.node.value)
    : undefined,
);
const inputOptions = computed(() =>
  props.inputs.map((input) => ({
    value: input.key,
    label: `${input.title} · ${input.operator}`,
  })),
);
function add(type: EditableConditionNode['type']) {
  if (props.node.type !== 'AND' && props.node.type !== 'OR') return;
  if (!canAddCondition(props.root, props.depth, type)) return;
  emit('update', {
    ...props.node,
    children: [...props.node.children, newCondition(type)],
  });
}
function setGroupType(type: unknown) {
  if (
    (type === 'AND' || type === 'OR') &&
    (props.node.type === 'AND' || props.node.type === 'OR')
  )
    emit('update', { ...props.node, type });
}
function replaceChild(index: number, child?: EditableConditionNode) {
  if (props.node.type !== 'AND' && props.node.type !== 'OR') return;
  const children = [...props.node.children];
  if (child) children[index] = child;
  else children.splice(index, 1);
  emit('update', { ...props.node, children });
}
function replaceNotChild(child: EditableConditionNode) {
  if (props.node.type === 'NOT') emit('update', { type: 'NOT', child });
}
function setKey(key: unknown) {
  if (props.node.type !== 'PARAM' || typeof key !== 'string') return;
  emit('update', { type: 'PARAM', key, value: undefined });
}
function setOption(value: unknown) {
  setValue(resolveConditionOptionValue(value, options.value));
}
function setValue(value: unknown) {
  if (props.node.type === 'PARAM') emit('update', { ...props.node, value });
}
</script>

<template>
  <div class="condition-node rounded border border-gray-200 p-2">
    <!-- 逻辑组只负责布尔组合，新增项仍由已发布参数定义约束。 -->
    <template v-if="node.type === 'AND' || node.type === 'OR'">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <Select
          :value="node.type"
          class="w-28"
          :options="[
            { label: '满足全部（与）', value: 'AND' },
            { label: '满足任一（或）', value: 'OR' },
          ]"
          @update:value="setGroupType"
        />
        <Button
          size="small"
          :disabled="!canAddCondition(root, depth)"
          @click="add('PARAM')"
        >
          加条件
        </Button>
        <Button
          size="small"
          :disabled="depth >= 5 || !canAddCondition(root, depth)"
          @click="add('AND')"
        >
          加与组
        </Button>
        <Button
          size="small"
          :disabled="depth >= 5 || !canAddCondition(root, depth)"
          @click="add('OR')"
        >
          加或组
        </Button>
        <Button
          size="small"
          :disabled="depth >= 5 || !canAddCondition(root, depth)"
          @click="add('NOT')"
        >
          加非
        </Button>
        <Button v-if="depth > 1" size="small" danger @click="emit('remove')">
          删除组
        </Button>
      </div>
      <div class="flex flex-col gap-2 border-l-2 border-gray-200 pl-3">
        <ConditionNodeEditor
          v-for="(child, index) in node.children"
          :key="index"
          :node="child"
          :root="root"
          :depth="depth + 1"
          :inputs="inputs"
          :scope-options="scopeOptions"
          @remove="replaceChild(index)"
          @update="replaceChild(index, $event)"
        />
      </div>
    </template>
    <!-- 非节点只能包裹一项，服务端仍独立约束可信范围。 -->
    <template v-else-if="node.type === 'NOT'">
      <div class="mb-2 flex items-center gap-2">
        <strong>不满足（非）</strong>
        <Button
          v-if="node.child.type === 'PARAM' && depth < 5"
          size="small"
          @click="replaceNotChild({ type: 'AND', children: [node.child] })"
        >
          包裹为与组
        </Button>
        <Button
          v-if="node.child.type === 'PARAM' && depth < 5"
          size="small"
          @click="replaceNotChild({ type: 'OR', children: [node.child] })"
        >
          包裹为或组
        </Button>
        <Button size="small" danger @click="emit('remove')">删除非</Button>
      </div>
      <ConditionNodeEditor
        :node="node.child"
        :root="root"
        :depth="depth + 1"
        :inputs="inputs"
        :scope-options="scopeOptions"
        @remove="replaceNotChild(newCondition('PARAM'))"
        @update="replaceNotChild"
      />
    </template>
    <!-- 叶子仅选择参数键和值，输入控件跟随参数类型与候选。 -->
    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <Select
          class="min-w-52 flex-1"
          :value="node.key || undefined"
          :options="inputOptions"
          placeholder="选择查询参数"
          show-search
          :filter-option="filterCrudLocalSelectOption"
          @update:value="setKey"
        />
        <Select
          v-if="options.length > 0"
          class="min-w-40 flex-1"
          :value="selectedValue"
          :options="selectOptions"
          placeholder="选择值"
          show-search
          :filter-option="filterCrudLocalSelectOption"
          @update:value="setOption"
        />
        <DatePicker
          v-else-if="selected?.type === 'DATE'"
          class="min-w-40 flex-1"
          :value="node.value as string"
          value-format="YYYY-MM-DD"
          @update:value="setValue"
        />
        <TimePicker
          v-else-if="selected?.type === 'TIME'"
          class="min-w-40 flex-1"
          :value="node.value as string"
          value-format="HH:mm:ss"
          @update:value="setValue"
        />
        <DatePicker
          v-else-if="selected?.type === 'DATETIME'"
          class="min-w-48 flex-1"
          :value="node.value as string"
          show-time
          value-format="YYYY-MM-DD HH:mm:ss"
          @update:value="setValue"
        />
        <Input
          v-else
          class="min-w-40 flex-1"
          :value="node.value as string"
          :placeholder="selected ? `输入${selected.title}` : '先选择参数'"
          :disabled="!selected"
          @update:value="setValue"
        />
        <Button size="small" danger @click="emit('remove')">删除</Button>
      </div>
    </template>
  </div>
</template>
