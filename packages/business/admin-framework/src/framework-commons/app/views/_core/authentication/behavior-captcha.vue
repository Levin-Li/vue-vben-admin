<script setup lang="ts">
import 'go-captcha-vue/dist/style.css';

import { Click as GoCaptchaClick, Slide as GoCaptchaSlide } from 'go-captcha-vue';
import { computed, ref, watch } from 'vue';
import { Spin } from 'ant-design-vue';

import {
  encodeBehaviorCaptchaResult,
  getBehaviorCaptchaInstruction,
  type BehaviorCaptchaChallenge,
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
type TrackOperation = { t: number; type: 'click'; x: number; y: number };

const startedAt = ref<number>();
const operations = ref<TrackOperation[]>([]);
const submitted = ref(false);

const data = computed(() => {
  const payload = props.challenge?.payload || {};
  return {
    image: String(payload.image || ''),
    thumb: String(payload.thumb || ''),
  };
});

const isSlide = computed(() => props.challenge?.mode === 'SLIDE');

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
    title:
      props.challenge?.prompt ||
      getBehaviorCaptchaInstruction(props.challenge?.mode),
    verticalPadding: 10,
    width: Number(payload.width) || 427,
  };
});

function begin() {
  startedAt.value ||= Date.now();
  return startedAt.value;
}

function resetState() {
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
  operations.value.push({ t: Date.now() - start, type: 'click', x: Math.round(x), y: Math.round(y) });
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
      <GoCaptchaClick
        v-if="challenge && !isSlide && data.image && data.thumb"
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

:deep(.behavior-captcha-card[data-test='captcha-mode-CLICK'] .go-captcha .gc-header) {
  height: 56px;
}

:deep(.behavior-captcha-card[data-test='captcha-mode-CLICK'] .go-captcha .gc-header img) {
  flex: 0 0 auto;
  max-height: 56px;
}

:deep(.gc-button-block) {
  display: none;
}
</style>
