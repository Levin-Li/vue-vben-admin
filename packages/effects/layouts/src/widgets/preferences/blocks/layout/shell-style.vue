<script setup lang="ts">
import { $t } from '@vben/locales';
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@vben-core/shadcn-ui';

withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false });

const marginTop = defineModel<number>('marginTop');
const marginRight = defineModel<number>('marginRight');
const marginBottom = defineModel<number>('marginBottom');
const marginLeft = defineModel<number>('marginLeft');
const radiusTopLeft = defineModel<number>('radiusTopLeft');
const radiusTopRight = defineModel<number>('radiusTopRight');
const radiusBottomRight = defineModel<number>('radiusBottomRight');
const radiusBottomLeft = defineModel<number>('radiusBottomLeft');
const borderTopWidth = defineModel<number>('borderTopWidth');
const borderRightWidth = defineModel<number>('borderRightWidth');
const borderBottomWidth = defineModel<number>('borderBottomWidth');
const borderLeftWidth = defineModel<number>('borderLeftWidth');

const marginFields = [
  { label: $t('preferences.shell.top'), model: marginTop },
  { label: $t('preferences.shell.right'), model: marginRight },
  { label: $t('preferences.shell.bottom'), model: marginBottom },
  { label: $t('preferences.shell.left'), model: marginLeft },
];

const borderFields = [
  { label: $t('preferences.shell.top'), model: borderTopWidth },
  { label: $t('preferences.shell.right'), model: borderRightWidth },
  { label: $t('preferences.shell.bottom'), model: borderBottomWidth },
  { label: $t('preferences.shell.left'), model: borderLeftWidth },
];

const radiusFields = [
  { label: $t('preferences.shell.topLeft'), model: radiusTopLeft },
  { label: $t('preferences.shell.topRight'), model: radiusTopRight },
  { label: $t('preferences.shell.bottomRight'), model: radiusBottomRight },
  { label: $t('preferences.shell.bottomLeft'), model: radiusBottomLeft },
];
</script>

<template>
  <div class="my-3 px-2">
    <div class="flex items-end gap-2">
      <div class="text-muted-foreground mb-1 shrink-0 text-sm">
        {{ $t('preferences.shell.margin') }}
      </div>
      <div class="grid flex-1 grid-cols-4 gap-2">
        <label
          v-for="field in marginFields"
          :key="field.label"
          class="space-y-1"
        >
          <span class="text-muted-foreground block text-center text-xs">
            {{ field.label }}
          </span>
          <NumberField
            v-model="field.model.value"
            :disabled="disabled"
            :max="80"
            :min="0"
          >
            <NumberFieldContent class="group">
              <NumberFieldDecrement
                class="opacity-0 transition-opacity group-hover:opacity-100"
              />
              <NumberFieldInput class="h-8 text-center" />
              <NumberFieldIncrement
                class="opacity-0 transition-opacity group-hover:opacity-100"
              />
            </NumberFieldContent>
          </NumberField>
        </label>
      </div>
    </div>
  </div>
  <div class="my-3 px-2">
    <div class="flex items-end gap-2">
      <div class="text-muted-foreground mb-1 shrink-0 text-sm">
        {{ $t('preferences.shell.radius') }}
      </div>
      <div class="grid flex-1 grid-cols-4 gap-2">
        <label
          v-for="field in radiusFields"
          :key="field.label"
          class="space-y-1"
        >
          <span class="text-muted-foreground block text-center text-xs">
            {{ field.label }}
          </span>
          <NumberField
            v-model="field.model.value"
            :disabled="disabled"
            :max="80"
            :min="0"
          >
            <NumberFieldContent class="group">
              <NumberFieldDecrement
                class="opacity-0 transition-opacity group-hover:opacity-100"
              />
              <NumberFieldInput class="h-8 text-center" />
              <NumberFieldIncrement
                class="opacity-0 transition-opacity group-hover:opacity-100"
              />
            </NumberFieldContent>
          </NumberField>
        </label>
      </div>
    </div>
  </div>
  <div class="my-3 px-2">
    <div class="flex items-end gap-2">
      <div class="text-muted-foreground mb-1 shrink-0 text-sm">
        {{ $t('preferences.shell.border') }}
      </div>
      <div class="grid flex-1 grid-cols-4 gap-2">
        <label
          v-for="field in borderFields"
          :key="field.label"
          class="space-y-1"
        >
          <span class="text-muted-foreground block text-center text-xs">
            {{ field.label }}
          </span>
          <NumberField
            v-model="field.model.value"
            :disabled="disabled"
            :max="20"
            :min="0"
          >
            <NumberFieldContent class="group">
              <NumberFieldDecrement
                class="opacity-0 transition-opacity group-hover:opacity-100"
              />
              <NumberFieldInput class="h-8 text-center" />
              <NumberFieldIncrement
                class="opacity-0 transition-opacity group-hover:opacity-100"
              />
            </NumberFieldContent>
          </NumberField>
        </label>
      </div>
    </div>
  </div>
</template>
