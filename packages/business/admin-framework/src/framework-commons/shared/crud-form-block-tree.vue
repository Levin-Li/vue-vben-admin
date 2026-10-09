<script setup lang="ts">
import type { CrudFormBlock } from './crud-form-block-tree';
import type { CrudFieldConfig } from './types';

defineOptions({ name: 'CrudFormBlockTree' });

withDefaults(
  defineProps<{
    blocks: CrudFormBlock<CrudFieldConfig>[];
    collapsed: Record<string, boolean>;
    gridTemplateColumns?: string;
    quickFillActive: boolean;
  }>(),
  { gridTemplateColumns: '' },
);

defineSlots<{
  fields(props: { block: CrudFormBlock<CrudFieldConfig> }): unknown;
  header(props: { block: GroupBlock }): unknown;
}>();

type GroupBlock = CrudFormBlock<CrudFieldConfig> & { complexGroupKey: string };

function asGroupBlock(block: CrudFormBlock<CrudFieldConfig>): GroupBlock {
  return block as GroupBlock;
}
</script>

<template>
  <div
    v-for="(block, index) in blocks"
    :key="`${block.complexGroupKey || 'field'}-${index}`"
    :data-crud-complex-group="block.complexGroupKey || undefined"
    :class="
      block.complexGroupKey && !quickFillActive
        ? 'border-border col-span-full overflow-hidden rounded-lg border'
        : 'contents'
    "
  >
    <slot
      v-if="block.complexGroupKey && !quickFillActive"
      name="header"
      :block="asGroupBlock(block)"
    ></slot>
    <div
      v-show="
        !block.complexGroupKey ||
        quickFillActive ||
        !collapsed[block.complexGroupKey]
      "
      :class="
        block.complexGroupKey && !quickFillActive
          ? 'grid gap-x-4 gap-y-4 p-4'
          : 'contents'
      "
      :style="
        block.complexGroupKey && !quickFillActive
          ? { gridTemplateColumns }
          : undefined
      "
    >
      <slot name="fields" :block="block"></slot>
      <CrudFormBlockTree
        v-if="block.children.length > 0"
        :blocks="block.children"
        :collapsed="collapsed"
        :grid-template-columns="gridTemplateColumns"
        :quick-fill-active="quickFillActive"
      >
        <template #header="slotProps">
          <slot name="header" v-bind="slotProps"></slot>
        </template>
        <template #fields="slotProps">
          <slot name="fields" v-bind="slotProps"></slot>
        </template>
      </CrudFormBlockTree>
    </div>
  </div>
</template>
