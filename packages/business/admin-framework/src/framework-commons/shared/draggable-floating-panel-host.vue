<script lang="ts" setup>
import type { PropType, VNodeChild } from 'vue';

import {
  computed,
  defineComponent,
  onMounted,
  shallowRef,
  useSlots,
} from 'vue';

import DraggableFloatingPanel from './draggable-floating-panel.vue';
import { getDraggableFloatingPanels } from './draggable-floating-panel-service';

interface Props {
  hostClass?: unknown;
  scope?: string;
}

/**
 * Global floating panel host.
 *
 * The framework root app mounts this component once in
 * `framework-commons/app/app.vue`. Without a `scope`, it renders all registered
 * floating panels and teleports them to `window.top.document.body` when that is
 * available, so panels are positioned against the top-level browser viewport.
 *
 * Business modules normally do not mount this component. They register panels
 * through `useDraggableFloatingPanels(scope)` or `addDraggableFloatingPanel`.
 * A scoped host is only for special embedded scenarios where a local floating
 * area is intentionally required.
 */
const props = defineProps<Props>();

const panels = getDraggableFloatingPanels(props.scope);
const resolvedTeleportTarget = shallowRef<HTMLElement | null>(null);
const slots = useSlots();
const hasDefaultSlot = computed(() => Boolean(slots.default));

function resolveTeleportTarget() {
  if (typeof document === 'undefined') {
    return null;
  }

  if (typeof window !== 'undefined') {
    try {
      return window.top?.document?.body || document.body;
    } catch {
      return document.body;
    }
  }

  return document.body;
}

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

onMounted(() => {
  resolvedTeleportTarget.value = resolveTeleportTarget();
});
</script>

<template>
  <div
    v-if="hasDefaultSlot"
    class="vben-draggable-floating-panel-host relative min-h-full"
    :class="hostClass"
  >
    <slot></slot>
  </div>
  <Teleport v-if="resolvedTeleportTarget" :to="resolvedTeleportTarget">
    <DraggableFloatingPanel
      v-for="(panel, index) in panels"
      :key="`${panel.scope}:${panel.id}`"
      v-bind="{
        placementIndex: index,
        storageKey: `${panel.scope}:${panel.id}`,
        name: panel.name || panel.id,
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
  </Teleport>
</template>
