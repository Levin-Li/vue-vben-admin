<script setup lang="ts">
import { computed } from 'vue';

import { $t } from '@vben/locales';

defineOptions({
  name: 'PreferenceBackgroundSettings',
});

const transparency = defineModel<number>('transparency', { default: 0 });

const normalizedTransparency = computed({
  get: () => Math.min(100, Math.max(0, Math.round(transparency.value ?? 0))),
  set: (value: number) => {
    transparency.value = Math.min(
      100,
      Math.max(0, Math.round(Number(value) || 0)),
    );
  },
});
</script>

<template>
  <section class="space-y-3">
    <label class="block space-y-2 text-sm">
      <span class="flex justify-between gap-3">
        <span>{{ $t('preferences.theme.backgroundTransparency') }}</span>
        <span class="text-muted-foreground">{{ normalizedTransparency }}%</span>
      </span>
      <input
        v-model.number="normalizedTransparency"
        class="accent-primary w-full"
        max="100"
        min="0"
        step="1"
        type="range"
      />
    </label>
  </section>
</template>
