<script setup lang="ts">
import 'go-captcha-vue/dist/style.css';

import { Click as GoCaptchaClick, Slide as GoCaptchaSlide } from 'go-captcha-vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Spin } from 'ant-design-vue';

import {
  encodeBehaviorCaptchaResult,
  isObstacleAvoidancePayload,
  type BehaviorCaptchaChallenge,
  type BehaviorCaptchaPathPayload,
  type BehaviorCaptchaPoint,
} from './behavior-captcha';

defineOptions({ name: 'BehaviorCaptcha' });

const props = defineProps<{
  challenge: BehaviorCaptchaChallenge | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  complete: [verifyCode: string];
  refresh: [];
}>();

type ClickDot = { index: number; key: number; x: number; y: number };
type TrackOperation = { t: number; type: string; x: number; y: number };

const pathStage = ref<HTMLElement>();
const startedAt = ref<number>();
const operations = ref<TrackOperation[]>([]);
const submitted = ref(false);
const dragging = ref(false);
const activePointerId = ref<number | null>(null);

const data = computed(() => {
  const payload = props.challenge?.payload || {};
  return {
    image: String(payload.image || ''),
    thumb: String(payload.thumb || ''),
  };
});

const isSlide = computed(() => props.challenge?.mode === 'SLIDE');
const pathPayload = computed<BehaviorCaptchaPathPayload | null>(() => {
  if (
    props.challenge?.mode === 'OBSTACLE_AVOIDANCE'
    && isObstacleAvoidancePayload(props.challenge.payload)
  ) {
    return props.challenge.payload;
  }
  return null;
});
const isPath = computed(() => Boolean(pathPayload.value));

const slideData = computed(() => {
  const payload = props.challenge?.payload || {};
  return {
    image: String(payload.image || ''),
    thumb: String(payload.thumb || ''),
    thumbHeight: Number(payload.thumbHeight) || 72,
    thumbWidth: Number(payload.thumbWidth) || 72,
    thumbX: Number(payload.thumbX) || 0,
    thumbY: Number(payload.thumbY) || 0,
  };
});

const config = computed(() => {
  const payload = props.challenge?.payload || {};
  return {
    buttonText: '确认',
    height: Number(payload.height) || 240,
    horizontalPadding: 0,
    showTheme: true,
    thumbHeight: 40,
    thumbWidth: 150,
    title: '',
    verticalPadding: 10,
    width: Number(payload.width) || 427,
  };
});

const pathViewBox = computed(() => {
  const payload = pathPayload.value;
  return payload ? `0 0 ${payload.width} ${payload.height}` : '0 0 0 0';
});

const pathPoints = computed(() =>
  operations.value
    .filter(
      (operation) => Number.isFinite(operation.x) && Number.isFinite(operation.y),
    )
    .map((operation) => ({
      x: Math.round(operation.x),
      y: Math.round(operation.y),
    })),
);

const pathPolylinePoints = computed(() =>
  pathPoints.value.map((point) => `${point.x},${point.y}`).join(' '),
);

const currentBallPoint = computed<BehaviorCaptchaPoint | null>(() => {
  const payload = pathPayload.value;
  return pathPoints.value.at(-1) || payload?.start || null;
});

const pathStageStyle = computed(() => {
  const payload = pathPayload.value;
  if (!payload) {
    return {};
  }
  return {
    '--captcha-stage-height': `${payload.height}px`,
    '--captcha-stage-width': `${payload.width}px`,
    backgroundImage: payload.image ? `url("${payload.image}")` : undefined,
    height: `${payload.height}px`,
    width: `${payload.width}px`,
  } as Record<string, string | undefined>;
});

const ballStyle = computed(() => {
  const payload = pathPayload.value;
  const point = currentBallPoint.value;
  if (!payload || !point) {
    return {};
  }
  const diameter = payload.ballRadius * 2;
  return {
    height: `${diameter}px`,
    left: `${point.x}px`,
    top: `${point.y}px`,
    width: `${diameter}px`,
  };
});

function markerStyle(
  point: BehaviorCaptchaPoint,
  radius: number,
  labelOffset = radius + 14,
) {
  const diameter = radius * 2;
  return {
    '--marker-label-offset': `${labelOffset}px`,
    height: `${diameter}px`,
    left: `${point.x}px`,
    top: `${point.y}px`,
    width: `${diameter}px`,
  } as Record<string, string>;
}

const startMarkerStyle = computed(() => {
  const payload = pathPayload.value;
  return payload ? markerStyle(payload.start, payload.ballRadius + 6) : {};
});


function begin() {
  startedAt.value ||= Date.now();
  return startedAt.value;
}

function clearPathListeners() {
  window.removeEventListener('pointermove', onPathPointerMove as EventListener);
  window.removeEventListener('pointerup', onPathPointerUp as EventListener);
  window.removeEventListener('pointercancel', onPathPointerCancel as EventListener);
}

function resetState() {
  clearPathListeners();
  activePointerId.value = null;
  dragging.value = false;
  startedAt.value = undefined;
  operations.value = [];
  submitted.value = false;
}

function submitAnswer(answer: unknown) {
  if (!props.challenge || submitted.value) {
    return false;
  }
  submitted.value = true;
  const start = begin();
  emit(
    'complete',
    encodeBehaviorCaptchaResult(
      props.challenge,
      answer,
      operations.value,
      { startTime: start },
    ),
  );
  return true;
}

function submitPoints(points: Array<{ x: number; y: number }>) {
  return points.length ? submitAnswer({ points }) : false;
}

function onClick(x: number, y: number) {
  if (props.loading || !props.challenge || submitted.value) {
    return;
  }
  const start = begin();
  operations.value.push({
    t: Date.now() - start,
    type: 'click',
    x: Math.round(x),
    y: Math.round(y),
  });
  const requiredClicks = Number(props.challenge.payload?.requiredClicks) || 4;
  if (operations.value.length === requiredClicks) {
    submitPoints(operations.value.map(({ x, y }) => ({ x, y })));
  }
}

function onConfirm(dots: ClickDot[], reset: () => void) {
  if (props.loading || !props.challenge || !dots.length) {
    reset();
    return false;
  }
  const answerPoints = dots.map((dot) => ({
    x: Math.round(dot.x),
    y: Math.round(dot.y),
  }));
  if (operations.value.length !== answerPoints.length) {
    operations.value = answerPoints.map((point, index) => ({
      ...point,
      t: index * 200,
      type: 'click',
    }));
  }
  return submitPoints(answerPoints);
}

function onSlideMove(x: number, y: number) {
  if (props.loading || !props.challenge || submitted.value) {
    return;
  }
  const start = begin();
  operations.value.push({
    t: Date.now() - start,
    type: 'click',
    x: Math.round(x),
    y: Math.round(y),
  });
}

function onSlideConfirm(point: { x: number; y: number }, reset: () => void) {
  if (props.loading || !props.challenge || submitted.value) {
    reset();
    return false;
  }
  if (!operations.value.length) {
    onSlideMove(point.x, point.y);
  }
  return submitAnswer({ x: Math.round(point.x), y: Math.round(point.y) });
}

function clampPathPoint(point: BehaviorCaptchaPoint, payload: BehaviorCaptchaPathPayload) {
  const padding = payload.ballRadius;
  return {
    x: Math.max(padding, Math.min(payload.width - padding, Math.round(point.x))),
    y: Math.max(padding, Math.min(payload.height - padding, Math.round(point.y))),
  };
}

function resolvePathPoint(event: MouseEvent | PointerEvent) {
  const payload = pathPayload.value;
  const rect = pathStage.value?.getBoundingClientRect();
  if (!payload || !rect) {
    return null;
  }
  const scaleX = payload.width / Math.max(rect.width, 1);
  const scaleY = payload.height / Math.max(rect.height, 1);
  return clampPathPoint(
    {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    },
    payload,
  );
}

function appendPathOperation(type: string, point: BehaviorCaptchaPoint, force = false) {
  const start = begin();
  const last = operations.value.at(-1);
  if (!force && last) {
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (type === last.type && distance < 2) {
      return;
    }
  }
  operations.value.push({
    t: Date.now() - start,
    type,
    x: point.x,
    y: point.y,
  });
}

function isActivePointer(event: MouseEvent | PointerEvent) {
  return (
    activePointerId.value == null
    || !('pointerId' in event)
    || event.pointerId === activePointerId.value
  );
}

function addPathListeners() {
  window.addEventListener('pointermove', onPathPointerMove as EventListener);
  window.addEventListener('pointerup', onPathPointerUp as EventListener);
  window.addEventListener('pointercancel', onPathPointerCancel as EventListener);
}

function startPathDrag(event: PointerEvent) {
  const payload = pathPayload.value;
  if (!payload || props.loading || !props.challenge || submitted.value) {
    return;
  }
  event.preventDefault();
  clearPathListeners();
  activePointerId.value = event.pointerId;
  dragging.value = true;
  startedAt.value = undefined;
  operations.value = [];
  appendPathOperation('down', payload.start, true);
  addPathListeners();
}

function onPathPointerMove(event: PointerEvent) {
  if (!dragging.value || !isActivePointer(event)) {
    return;
  }
  const point = resolvePathPoint(event);
  if (!point) {
    return;
  }
  appendPathOperation('move', point);
}

function submitPathTrack() {
  const payload = pathPayload.value;
  if (!payload) {
    return false;
  }
  const points = pathPoints.value;
  if (!points.length) {
    return false;
  }
  return submitAnswer({
    path: points,
    start: payload.start,
  });
}

function finishPathDrag(event: PointerEvent, type: 'cancel' | 'up') {
  const payload = pathPayload.value;
  if (!payload || !dragging.value || !isActivePointer(event)) {
    return;
  }
  const point = resolvePathPoint(event) || payload.start;
  appendPathOperation(type, point, true);
  clearPathListeners();
  activePointerId.value = null;
  dragging.value = false;
  if (type === 'up') {
    submitPathTrack();
    return;
  }
  startedAt.value = undefined;
  operations.value = [];
}

function onPathPointerUp(event: PointerEvent) {
  finishPathDrag(event, 'up');
}

function onPathPointerCancel(event: PointerEvent) {
  finishPathDrag(event, 'cancel');
}

const events = computed(() => ({
  click: onClick,
  confirm: onConfirm,
  refresh: () => emit('refresh'),
}));

const slideEvents = computed(() => ({
  confirm: onSlideConfirm,
  move: onSlideMove,
  refresh: () => emit('refresh'),
}));

watch(
  () => props.challenge?.challengeId,
  resetState,
  { immediate: true },
);

onBeforeUnmount(() => {
  clearPathListeners();
});
</script>

<template>
  <div
    class="behavior-captcha-card flex justify-center"
    :data-test="`captcha-mode-${challenge?.mode || 'UNSUPPORTED'}`"
  >
    <div class="behavior-captcha-stage relative min-h-[240px] w-full">
      <div
        v-if="loading || !challenge"
        class="behavior-captcha-loading absolute inset-0 z-10 flex items-center justify-center"
        data-test="behavior-captcha-loading"
      >
        <Spin size="large" />
      </div>
      <div
        v-if="challenge && isPath && pathPayload"
        class="behavior-captcha-path-shell flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-sm"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-foreground">
              {{ challenge.title || '障碍躲避' }}
            </p>
          </div>
          <button
            class="behavior-captcha-path-refresh inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            data-test="behavior-captcha-path-refresh"
            type="button"
            :disabled="loading"
            @click="emit('refresh')"
          >
            <span aria-hidden="true">↻</span>
          </button>
        </div>
        <div
          ref="pathStage"
          class="behavior-captcha-path-stage relative overflow-hidden rounded-2xl border border-border bg-muted/70"
          data-test="behavior-captcha-path-stage"
          :style="pathStageStyle"
        >
          <div
            class="behavior-captcha-path-fallback absolute inset-0"
            :class="{ 'opacity-0': pathPayload.image }"
          />
          <div class="behavior-captcha-path-overlay absolute inset-0">
            <svg
              class="pointer-events-none absolute inset-0 z-10 h-full w-full"
              data-test="behavior-captcha-path-svg"
              :viewBox="pathViewBox"
            >
              <polyline
                v-if="pathPolylinePoints"
                class="behavior-captcha-path-track"
                data-test="behavior-captcha-path-track"
                :points="pathPolylinePoints"
              />
            </svg>

            <div
              class="behavior-captcha-marker behavior-captcha-start-marker"
              data-test="behavior-captcha-path-start"
              :style="startMarkerStyle"
            >
              <span>起</span>
            </div>


            <button
              class="behavior-captcha-ball"
              data-test="behavior-captcha-path-ball"
              type="button"
              aria-label="行为验证拖动球"
              :disabled="loading || submitted"
              :style="ballStyle"
              @pointerdown="startPathDrag"
            />
          </div>
        </div>
        <div class="rounded-xl bg-muted/70 px-4 py-3 text-center text-sm text-muted-foreground">
          按住白球拖动，轨迹不可碰撞障碍，到达 [{{ pathPayload.targetIcon }}] 终点松开。
        </div>
      </div>
      <GoCaptchaClick
        v-if="challenge && !isSlide && !isPath && data.image && (data.thumb || challenge.mode === 'IDIOM_CLICK')"
        :config="config"
        :data="data"
        :events="events"
      />
      <GoCaptchaSlide
        v-if="challenge && isSlide && slideData.image && slideData.thumb"
        :config="config"
        :data="slideData"
        :events="slideEvents"
      />
    </div>
  </div>
</template>

<style scoped>
:deep(.go-captcha.gc-theme) {
  border: 0;
}

:deep(.go-captcha .gc-body .gc-body-inner) {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
}

:deep(.go-captcha .gc-body .gc-loading) {
  align-items: center;
  height: auto;
  inset: 0;
  justify-content: center;
  margin: 0;
  width: auto;
}

:deep(.behavior-captcha-card[data-test='captcha-mode-CLICK'] .go-captcha .gc-header),
:deep(.behavior-captcha-card[data-test='captcha-mode-IDIOM_CLICK'] .go-captcha .gc-header) {
  height: 56px;
}

:deep(.behavior-captcha-card[data-test='captcha-mode-CLICK'] .go-captcha .gc-header img),
:deep(.behavior-captcha-card[data-test='captcha-mode-CLICK'] .go-captcha .gc-header img) {
  flex: 0 0 auto;
  max-height: 56px;
}

:deep(.gc-button-block) {
  display: none;
}

.behavior-captcha-path-stage {
  background-color: hsl(var(--muted));
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  touch-action: none;
}

.behavior-captcha-path-fallback {
  background:
    radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.18), transparent 32%),
    radial-gradient(circle at 82% 18%, hsl(var(--success) / 0.15), transparent 28%),
    linear-gradient(135deg, hsl(var(--muted)), hsl(var(--background)));
}

.behavior-captcha-path-track {
  fill: none;
  filter: drop-shadow(0 0 10px rgb(255 255 255 / 0.28));
  stroke: rgb(255 255 255 / 0.95);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 4;
}

.behavior-captcha-obstacle {
  align-items: center;
  color: rgb(255 255 255 / 0.92);
  display: inline-flex;
  font-family:
    var(--captcha-obstacle-font, 'Noto Sans SC'),
    'PingFang SC',
    'Microsoft YaHei',
    'Segoe UI Symbol',
    sans-serif;
  font-weight: 700;
  justify-content: center;
  pointer-events: none;
  position: absolute;
  text-align: center;
  text-shadow:
    0 1px 1px rgb(0 0 0 / 0.3),
    0 0 12px rgb(255 255 255 / 0.22);
  user-select: none;
  z-index: 12;
}

.behavior-captcha-marker {
  align-items: center;
  border-radius: 9999px;
  display: inline-flex;
  justify-content: center;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, -50%);
  user-select: none;
  z-index: 15;
}

.behavior-captcha-marker::after {
  background: rgb(15 23 42 / 0.72);
  border-radius: 9999px;
  color: rgb(255 255 255 / 0.94);
  content: attr(data-label);
  font-size: 12px;
  left: 50%;
  line-height: 1;
  padding: 4px 8px;
  position: absolute;
  top: var(--marker-label-offset);
  transform: translateX(-50%);
  white-space: nowrap;
}

.behavior-captcha-start-marker {
  background: hsl(var(--primary) / 0.16);
  border: 2px solid hsl(var(--primary));
  box-shadow: 0 0 0 6px hsl(var(--background) / 0.14);
  color: hsl(var(--primary-foreground, var(--foreground)));
}

.behavior-captcha-start-marker::after {
  content: '起点';
}

.behavior-captcha-start-marker span {
  color: hsl(var(--primary));
  font-size: 14px;
  font-weight: 700;
}

.behavior-captcha-ball {
  background:
    radial-gradient(circle at 35% 35%, rgb(255 255 255), rgb(255 255 255 / 0.88) 55%, rgb(226 232 240 / 0.98));
  border: 2px solid rgb(255 255 255 / 0.96);
  border-radius: 9999px;
  box-shadow:
    0 8px 24px rgb(15 23 42 / 0.25),
    0 0 0 4px rgb(255 255 255 / 0.22);
  cursor: grab;
  position: absolute;
  touch-action: none;
  transform: translate(-50%, -50%);
  z-index: 18;
}

.behavior-captcha-ball:disabled {
  cursor: not-allowed;
}

.behavior-captcha-ball:active {
  cursor: grabbing;
}
</style>
