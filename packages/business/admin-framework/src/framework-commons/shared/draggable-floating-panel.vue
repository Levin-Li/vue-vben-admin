<script lang="ts" setup>
import type { StyleValue } from 'vue';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';

interface FloatingPanelPosition {
  x: number;
  y: number;
}

interface Props {
  defaultPlacement?: 'top-center' | 'top-left' | 'top-right';
  disabled?: boolean;
  edgePadding?: number;
  initialPosition?: FloatingPanelPosition;
  panelClass?: string;
  placementGap?: number;
  placementIndex?: number;
  persist?: boolean;
  storageKey?: string;
  top?: number;
  zIndex?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultPlacement: 'top-center',
  disabled: false,
  edgePadding: 12,
  panelClass: '',
  placementGap: 16,
  placementIndex: 0,
  persist: true,
  top: 16,
  zIndex: 30,
});

const emit = defineEmits<{
  move: [position: FloatingPanelPosition];
}>();

const panelRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const hasUserPosition = ref(false);
const position = reactive<FloatingPanelPosition>({
  x: 0,
  y: 0,
});

let dragState: null | {
  startLeft: number;
  startTop: number;
  startX: number;
  startY: number;
} = null;
let resizeObserver: null | ResizeObserver = null;

const panelStyle = computed<StyleValue>(() => ({
  left: `${position.x}px`,
  top: `${position.y}px`,
  zIndex: props.zIndex,
}));

function getBoundaryElement() {
  return panelRef.value?.parentElement || null;
}

function getStoredPosition() {
  if (!props.persist || !props.storageKey || typeof window === 'undefined') {
    return null;
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(props.storageKey) || '');
    if (
      parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number'
    ) {
      return parsed as FloatingPanelPosition;
    }
  } catch {
    return null;
  }

  return null;
}

function savePosition(nextPosition: FloatingPanelPosition) {
  if (!props.persist || !props.storageKey || typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(props.storageKey, JSON.stringify(nextPosition));
}

function clampPosition(
  nextPosition: FloatingPanelPosition,
  fallbackPanelHeight?: number,
) {
  const boundary = getBoundaryElement();
  const panel = panelRef.value;
  const boundaryWidth = boundary?.clientWidth || window.innerWidth;
  const boundaryHeight = boundary?.clientHeight || window.innerHeight;
  const panelWidth = panel?.offsetWidth || 0;
  const panelHeight = fallbackPanelHeight ?? panel?.offsetHeight ?? 0;
  const maxX = Math.max(
    props.edgePadding,
    boundaryWidth - panelWidth - props.edgePadding,
  );
  const maxY = Math.max(
    props.edgePadding,
    boundaryHeight - panelHeight - props.edgePadding,
  );

  return {
    x: Math.min(Math.max(props.edgePadding, nextPosition.x), maxX),
    y: Math.min(Math.max(props.edgePadding, nextPosition.y), maxY),
  };
}

function getDefaultPosition() {
  const boundary = getBoundaryElement();
  const panel = panelRef.value;
  const boundaryWidth = boundary?.clientWidth || window.innerWidth;
  const panelWidth = panel?.offsetWidth || 0;
  const panelHeight = panel?.offsetHeight || 0;
  const stackOffset = props.placementIndex * props.placementGap;
  const x =
    props.defaultPlacement === 'top-left'
      ? props.edgePadding
      : props.defaultPlacement === 'top-right'
        ? boundaryWidth - panelWidth - props.edgePadding
        : (boundaryWidth - panelWidth) / 2;

  return clampPosition(
    {
      x,
      y: props.top + stackOffset,
    },
    panelHeight,
  );
}

function setPosition(nextPosition: FloatingPanelPosition, persist = false) {
  const clamped = clampPosition(nextPosition);
  position.x = clamped.x;
  position.y = clamped.y;
  emit('move', clamped);

  if (persist) {
    savePosition(clamped);
  }
}

function initPosition() {
  const storedPosition = getStoredPosition();
  const nextPosition =
    storedPosition || props.initialPosition || getDefaultPosition();

  hasUserPosition.value = Boolean(storedPosition || props.initialPosition);
  setPosition(nextPosition);
}

function isInteractiveTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;

  return Boolean(
    element?.closest(
      'a,button,input,textarea,select,[contenteditable="true"],[role="button"],.ant-select,.ant-picker,.ant-input,.ant-btn',
    ),
  );
}

function handlePointerMove(event: PointerEvent) {
  if (!dragState) {
    return;
  }

  isDragging.value = true;
  setPosition(
    {
      x: dragState.startLeft + event.clientX - dragState.startX,
      y: dragState.startTop + event.clientY - dragState.startY,
    },
    false,
  );
  event.preventDefault();
}

function stopDrag() {
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);
  window.removeEventListener('pointercancel', handlePointerUp);
}

function handlePointerUp() {
  dragState = null;
  hasUserPosition.value = true;
  isDragging.value = false;
  stopDrag();
  savePosition({ ...position });
}

function handlePointerDown(event: PointerEvent) {
  if (
    props.disabled ||
    event.button !== 0 ||
    isInteractiveTarget(event.target)
  ) {
    return;
  }

  dragState = {
    startLeft: position.x,
    startTop: position.y,
    startX: event.clientX,
    startY: event.clientY,
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
}

function resetPosition() {
  hasUserPosition.value = false;
  setPosition(getDefaultPosition(), true);
}

onMounted(async () => {
  await nextTick();
  initPosition();

  const boundary = getBoundaryElement();
  if (boundary && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (hasUserPosition.value) {
        setPosition({ ...position });
        return;
      }

      setPosition(getDefaultPosition());
    });
    resizeObserver.observe(boundary);
  }
});

onBeforeUnmount(() => {
  stopDrag();
  resizeObserver?.disconnect();
});

defineExpose({
  resetPosition,
  setPosition,
});
</script>

<template>
  <div
    ref="panelRef"
    class="vben-draggable-floating-panel bg-card border-border text-foreground"
    :class="[panelClass, { 'is-disabled': disabled, 'is-dragging': isDragging }]"
    :style="panelStyle"
    @pointerdown="handlePointerDown"
  >
    <slot></slot>
  </div>
</template>

<style scoped>
.vben-draggable-floating-panel {
  position: absolute;
  display: inline-flex;
  max-width: calc(100% - 24px);
  cursor: grab;
  border-width: 1px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  user-select: none;
  touch-action: none;
}

.vben-draggable-floating-panel.is-dragging {
  cursor: grabbing;
}

.vben-draggable-floating-panel.is-disabled {
  cursor: default;
}
</style>
