<script setup lang="ts">
import type { DataModelQueryInput } from '../../api/data-model-service';
import type { EditableConditionNode } from './condition-tree';

import { computed } from 'vue';

import { filterCrudLocalSelectOption } from '@levin/admin-framework/framework-commons/shared/crud-local-search';
import { Button, Select } from 'ant-design-vue';

import { canAddCondition, newCondition } from './condition-tree';

const props = defineProps<{
  depth: number;
  inputs: DataModelQueryInput[];
  node: EditableConditionNode;
  root: EditableConditionNode;
}>();
const emit = defineEmits<{
  remove: [];
  update: [node: EditableConditionNode];
}>();
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
  emit('update', { type: 'PARAM', key });
}
</script>

<template>
  <div class="condition-node rounded border border-gray-200 p-2">
    <!-- 逻辑组只保存接口定义中的参数关系。 -->
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
        @remove="replaceNotChild(newCondition('PARAM'))"
        @update="replaceNotChild"
      />
    </template>
    <!-- 叶子只选择参数键，运行时才输入参数值。 -->
    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <Select
          class="min-w-52 flex-1"
          :value="node.type === 'PARAM' ? node.key || undefined : undefined"
          :options="inputOptions"
          placeholder="选择查询参数"
          show-search
          :filter-option="filterCrudLocalSelectOption"
          @update:value="setKey"
        />
        <Button size="small" danger @click="emit('remove')">删除</Button>
      </div>
    </template>
  </div>
</template>
