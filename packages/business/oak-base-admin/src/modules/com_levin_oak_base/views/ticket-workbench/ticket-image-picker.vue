<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { ticketImageToPng } from './image-convert';

const props = defineProps<{ modelValue: string[]; active: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [string[]];
  'busy-change': [boolean];
}>();
const input = ref<HTMLInputElement>();
const preview = ref<string>();
const pasteTarget = ref<number | 'add' | null>(null);
const hint = ref<{ x: number; y: number }>();
const busy = ref(false);
let generation = 0;
watch(
  () => props.active,
  (active) => {
    generation += 1;
    if (!active) {
      leave();
      preview.value = undefined;
    }
  },
);

function enter(target: number | 'add', event: MouseEvent) {
  pasteTarget.value = target;
  move(event);
}
function move(event: MouseEvent) {
  hint.value = {
    x: Math.min(event.clientX + 12, window.innerWidth - 230),
    y: Math.min(event.clientY + 16, window.innerHeight - 35),
  };
}
function leave() {
  pasteTarget.value = null;
  hint.value = undefined;
}
async function acceptFiles(files: File[], target: number | 'add') {
  if (busy.value || !files.length) return;
  if (target === 'add' && props.modelValue.length + files.length > 5) {
    message.error('最多添加 5 张图片');
    return;
  }
  busy.value = true;
  emit('busy-change', true);
  const version = generation;
  const original = target === 'add' ? undefined : props.modelValue[target];
  try {
    const values: string[] = [];
    for (const file of target === 'add' ? files : files.slice(0, 1))
      values.push(await ticketImageToPng(file));
    if (!props.active || version !== generation) return;
    const next = [...props.modelValue];
    if (target === 'add') {
      if (next.length + values.length > 5) {
        message.error('最多添加 5 张图片');
        return;
      }
      next.push(...values);
    } else if (original && next[target] === original && values[0])
      next[target] = values[0];
    else return;
    emit('update:modelValue', next);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '图片读取失败');
  } finally {
    busy.value = false;
    emit('busy-change', false);
  }
}
function changed(event: Event) {
  const target = event.target as HTMLInputElement;
  void acceptFiles(Array.from(target.files || []), 'add');
  target.value = '';
}
function paste(event: ClipboardEvent) {
  if (!props.active || pasteTarget.value === null) return;
  const element = event.target;
  if (
    element instanceof HTMLElement &&
    (element.isContentEditable ||
      element.closest(
        'input:not([type="file"]),textarea,[contenteditable="true"]',
      ))
  )
    return;
  const files = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  if (!files.length) return;
  event.preventDefault();
  void acceptFiles(files, pasteTarget.value);
}
function remove(index: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  );
}
onMounted(() => document.addEventListener('paste', paste));
onBeforeUnmount(() => {
  generation += 1;
  document.removeEventListener('paste', paste);
});
</script>

<template>
  <div class="ticket-image-picker">
    <div
      v-for="(image, index) in modelValue"
      :key="`${index}-${image.slice(0, 32)}`"
      class="ticket-image-picker__card"
      @mouseenter="enter(index, $event)"
      @mousemove="move"
      @mouseleave="leave"
    >
      <button
        type="button"
        class="ticket-image-picker__preview"
        :aria-label="`查看图片 ${index + 1}`"
        @focus="pasteTarget = index"
        @blur="pasteTarget = null"
        @click="preview = image"
      >
        <img
          :src="`data:image/png;base64,${image}`"
          :alt="`图片 ${index + 1}`"
        />
      </button>
      <button
        type="button"
        class="ticket-image-picker__remove"
        :aria-label="`移除图片 ${index + 1}`"
        @click="remove(index)"
      >
        ×
      </button>
    </div>
    <button
      v-if="modelValue.length < 5"
      type="button"
      class="ticket-image-picker__add"
      aria-label="添加图片"
      :disabled="busy"
      @mouseenter="enter('add', $event)"
      @mousemove="move"
      @mouseleave="leave"
      @focus="pasteTarget = 'add'"
      @blur="pasteTarget = null"
      @click="input?.click()"
    >
      ＋
    </button>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      multiple
      class="ticket-image-picker__input"
      tabindex="-1"
      aria-hidden="true"
      @change="changed"
    />
    <span
      v-if="hint && active"
      class="ticket-image-picker__hint"
      :style="{ left: `${hint.x}px`, top: `${hint.y}px` }"
      aria-hidden="true"
      >按 [Ctrl/⌘ + V] 粘贴截图到这里</span
    >
  </div>
  <Modal
    :open="Boolean(preview)"
    title="图片预览"
    :footer="null"
    @cancel="preview = undefined"
  >
    <img
      v-if="preview"
      :src="`data:image/png;base64,${preview}`"
      alt="图片大图预览"
      class="ticket-image-picker__large"
    />
  </Modal>
</template>

<style scoped>
.ticket-image-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ticket-image-picker__input {
  display: none !important;
}
.ticket-image-picker__card,
.ticket-image-picker__add {
  position: relative;
  width: 72px;
  height: 72px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--muted) / 0.3);
}
.ticket-image-picker__preview {
  width: 100%;
  height: 100%;
  padding: 3px;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.ticket-image-picker__preview img {
  width: 100%;
  height: 100%;
  border-radius: 5px;
  object-fit: cover;
}
.ticket-image-picker__remove {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: #4b5563;
  cursor: pointer;
  line-height: 20px;
}
.ticket-image-picker__add {
  color: hsl(var(--muted-foreground));
  font-size: 26px;
  cursor: pointer;
}
.ticket-image-picker__hint {
  position: fixed;
  z-index: 1200;
  padding: 5px 8px;
  border-radius: 4px;
  color: #fff;
  background: #333;
  font-size: 12px;
  pointer-events: none;
}
.ticket-image-picker__large {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  margin: auto;
  object-fit: contain;
}
</style>
