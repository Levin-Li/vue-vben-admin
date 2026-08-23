<script setup lang="ts">
import { watch } from 'vue';

import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@vben-core/shadcn-ui';

defineOptions({
  name: 'PreferenceFontScale',
});

const modelValue = defineModel<number>({
  default: 1,
});

const min = 0.75;
const max = 1.5;
const step = 0.025;

watch(
  modelValue,
  (newValue) => {
    if (newValue < min) {
      modelValue.value = min;
    } else if (newValue > max) {
      modelValue.value = max;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex items-center gap-2">
    <NumberField
      v-model="modelValue"
      :max="max"
      :min="min"
      :step="step"
      class="w-full"
    >
      <NumberFieldContent>
        <NumberFieldDecrement />
        <NumberFieldInput />
        <NumberFieldIncrement />
      </NumberFieldContent>
    </NumberField>
    <span class="text-muted-foreground whitespace-nowrap text-xs">×</span>
  </div>
</template>
