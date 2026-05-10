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

import { IconifyIcon } from '@vben/icons';

import { Tooltip } from 'ant-design-vue';

interface FloatingPanelPosition {
  x: number;
  y: number;
}

interface Props {
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  defaultPlacement?:
    | 'bottom-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'center'
    | 'top-center'
    | 'top-left'
    | 'top-right';
  disabled?: boolean;
  edgePadding?: number;
  initialPosition?: FloatingPanelPosition;
  name?: string;
  panelClass?: string;
  placementGap?: number;
  placementIndex?: number;
  persist?: boolean;
  storageKey?: string;
  top?: number;
  zIndex?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  collapsible: true,
  defaultCollapsed: false,
  defaultPlacement: 'top-center',
  disabled: false,
  edgePadding: 12,
  panelClass: '',
  placementGap: 16,
  placementIndex: 0,
  persist: true,
  top: 16,
  zIndex: 1000,
});

const emit = defineEmits<{
  move: [position: FloatingPanelPosition];
}>();

const panelRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isCollapsed = ref(props.defaultCollapsed);
const isHandleTooltipOpen = ref(false);
const hasUserPosition = ref(false);
const position = reactive<FloatingPanelPosition>({
  x: 0,
  y: 0,
});

let dragState: null | {
  moved: boolean;
  startLeft: number;
  startTop: number;
  startX: number;
  startY: number;
} = null;
let dragWindow: null | Window = null;
let removeWindowResizeListener: null | (() => void) = null;

const panelStyle = computed<StyleValue>(() => ({
  borderRadius: 'var(--radius)',
  borderStyle: 'solid',
  borderWidth: '1px',
  boxShadow: 'var(--shadow-sm)',
  display: 'inline-flex',
  left: `${position.x}px`,
  minHeight: isCollapsed.value ? '0' : undefined,
  minWidth: isCollapsed.value ? '0' : undefined,
  position: 'fixed',
  top: `${position.y}px`,
  zIndex: props.zIndex,
}));

const handleName = computed(() => props.name || '浮动面板');

const handleActionLabel = computed(() => {
  if (props.disabled) {
    return '拖动已禁用';
  }
  return isCollapsed.value
    ? '点击可展开，按住可拖动'
    : '点击可收缩，按住可拖动';
});

const handleLabel = computed(
  () => `${handleName.value}：${handleActionLabel.value}`,
);

const dragHandleStyle = computed<StyleValue>(() => ({
  alignItems: 'center',
  background: 'hsl(var(--background))',
  borderColor: 'hsl(var(--border))',
  borderRadius: '9999px',
  borderStyle: 'solid',
  borderWidth: '1px',
  boxShadow: 'var(--shadow-sm)',
  color: 'hsl(var(--muted-foreground))',
  cursor: props.disabled ? 'default' : isDragging.value ? 'grabbing' : 'grab',
  display: 'inline-flex',
  height: '22px',
  justifyContent: 'center',
  left: '-10px',
  padding: '0',
  position: 'absolute',
  top: '-10px',
  touchAction: 'none',
  userSelect: 'none',
  width: '22px',
}));

function getPanelWindow() {
  return panelRef.value?.ownerDocument?.defaultView || window;
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

function getMeasuredPanelSize() {
  const panel = panelRef.value;
  const content = panel?.querySelector<HTMLElement>(
    '.vben-draggable-floating-panel-content',
  );

  return {
    height: content?.offsetHeight || panel?.offsetHeight || 0,
    width: content?.offsetWidth || panel?.offsetWidth || 0,
  };
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
  const panel = panelRef.value;
  const panelWindow = getPanelWindow();
  const boundaryWidth = panelWindow.innerWidth;
  const boundaryHeight = panelWindow.innerHeight;
  const panelSize = getMeasuredPanelSize();
  const panelWidth = panelSize.width;
  const panelHeight = fallbackPanelHeight ?? panelSize.height;
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
  const panel = panelRef.value;
  const panelWindow = getPanelWindow();
  const boundaryWidth = panelWindow.innerWidth;
  const boundaryHeight = panelWindow.innerHeight;
  const panelSize = getMeasuredPanelSize();
  const panelWidth = panelSize.width;
  const panelHeight = panelSize.height;
  const stackOffset = props.placementIndex * props.placementGap;
  const x = props.defaultPlacement.endsWith('left')
    ? props.edgePadding
    : props.defaultPlacement.endsWith('right')
      ? boundaryWidth - panelWidth - props.edgePadding
      : (boundaryWidth - panelWidth) / 2 + stackOffset;
  const y =
    props.defaultPlacement === 'center'
      ? (boundaryHeight - panelHeight) / 2 + stackOffset
      : props.defaultPlacement.startsWith('bottom')
        ? boundaryHeight - panelHeight - props.edgePadding - stackOffset
        : props.top + stackOffset;

  return clampPosition(
    {
      x,
      y,
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

function handlePointerMove(event: PointerEvent) {
  if (!dragState) {
    return;
  }

  const deltaX = event.clientX - dragState.startX;
  const deltaY = event.clientY - dragState.startY;
  if (!dragState.moved && Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
    return;
  }

  isDragging.value = true;
  dragState.moved = true;
  setPosition(
    {
      x: dragState.startLeft + deltaX,
      y: dragState.startTop + deltaY,
    },
    false,
  );
  event.preventDefault();
}

function stopDrag() {
  const targetWindow = dragWindow || window;
  targetWindow.removeEventListener('pointermove', handlePointerMove);
  targetWindow.removeEventListener('pointerup', handlePointerUp);
  targetWindow.removeEventListener('pointercancel', handlePointerUp);
  dragWindow = null;
}

function handlePointerUp() {
  const shouldToggleCollapsed = props.collapsible && !dragState?.moved;
  dragState = null;
  hasUserPosition.value = true;
  isDragging.value = false;
  stopDrag();
  savePosition({ ...position });

  if (shouldToggleCollapsed) {
    isCollapsed.value = !isCollapsed.value;
  }
}

function handlePointerDown(event: PointerEvent) {
  if (props.disabled || event.button !== 0) {
    return;
  }

  isHandleTooltipOpen.value = false;
  dragState = {
    moved: false,
    startLeft: position.x,
    startTop: position.y,
    startX: event.clientX,
    startY: event.clientY,
  };

  dragWindow = getPanelWindow();
  dragWindow.addEventListener('pointermove', handlePointerMove);
  dragWindow.addEventListener('pointerup', handlePointerUp);
  dragWindow.addEventListener('pointercancel', handlePointerUp);
  event.preventDefault();
}

function handleTooltipOpenChange(open: boolean) {
  isHandleTooltipOpen.value = dragState || isDragging.value ? false : open;
}

function resetPosition() {
  hasUserPosition.value = false;
  setPosition(getDefaultPosition(), true);
}

onMounted(async () => {
  await nextTick();
  initPosition();
  const panelWindow = getPanelWindow();

  const handleWindowResize = () => {
    if (hasUserPosition.value) {
      setPosition({ ...position });
      return;
    }

    setPosition(getDefaultPosition());
  };

  panelWindow.addEventListener('resize', handleWindowResize);
  removeWindowResizeListener = () =>
    panelWindow.removeEventListener('resize', handleWindowResize);
});

onBeforeUnmount(() => {
  stopDrag();
  removeWindowResizeListener?.();
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
    :class="[
      panelClass,
      {
        'is-collapsed': isCollapsed,
        'is-disabled': disabled,
        'is-dragging': isDragging,
      },
    ]"
    :style="panelStyle"
  >
    <Tooltip
      v-if="!disabled"
      :mouse-enter-delay="1.5"
      :mouse-leave-delay="0"
      :open="isHandleTooltipOpen"
      placement="right"
      @open-change="handleTooltipOpenChange"
    >
      <template #title>
        <div class="max-w-80">
          <div class="font-medium leading-5">{{ handleName }}</div>
          <div class="mt-0.5 text-xs leading-5 opacity-90">
            {{ handleActionLabel }}
          </div>
        </div>
      </template>
      <button
        :aria-label="handleLabel"
        :aria-pressed="isCollapsed"
        class="vben-draggable-floating-panel-handle"
        type="button"
        :style="dragHandleStyle"
        @pointerdown="handlePointerDown"
      >
        <IconifyIcon class="size-3.5" icon="lucide:grip" />
      </button>
    </Tooltip>
    <div v-show="!isCollapsed" class="vben-draggable-floating-panel-content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.vben-draggable-floating-panel {
  position: fixed;
  display: inline-flex;
  border-width: 1px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

.vben-draggable-floating-panel.is-collapsed {
  width: 0;
  height: 0;
  padding: 0 !important;
  border-color: transparent;
  border-width: 0;
  background: transparent !important;
  box-shadow: none !important;
}

.vben-draggable-floating-panel-handle:hover {
  color: hsl(var(--foreground));
}

.vben-draggable-floating-panel.is-dragging
  .vben-draggable-floating-panel-handle {
  cursor: grabbing;
}
</style>
