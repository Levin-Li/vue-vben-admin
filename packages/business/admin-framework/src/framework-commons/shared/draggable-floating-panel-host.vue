<script lang="ts" setup>
import type { PropType, VNodeChild } from 'vue';

import { defineComponent } from 'vue';

import DraggableFloatingPanel from './draggable-floating-panel.vue';
import { getDraggableFloatingPanels } from './draggable-floating-panel-service';

interface Props {
  hostClass?: unknown;
  scope?: string;
}

const props = withDefaults(defineProps<Props>(), {
  scope: 'default',
});

const panels = getDraggableFloatingPanels(props.scope);

const FloatingPanelRender = defineComponent({
  name: 'FloatingPanelRender',
  props: {
    render: {
      required: true,
      type: Function as PropType<() => VNodeChild>,
    },
  },
  setup(props) {
    return () => props.render();
  },
});
</script>

<template>
  <div
    class="vben-draggable-floating-panel-host relative min-h-full"
    :class="hostClass"
  >
    <slot></slot>
    <DraggableFloatingPanel
      v-for="(panel, index) in panels"
      :key="panel.id"
      v-bind="{
        placementIndex: index,
        storageKey: `${panel.scope}:${panel.id}`,
        ...(panel.panelProps || {}),
      }"
    >
      <component
        :is="panel.component"
        v-if="panel.component"
        v-bind="panel.props"
      />
      <FloatingPanelRender v-else-if="panel.render" :render="panel.render" />
    </DraggableFloatingPanel>
  </div>
</template>
