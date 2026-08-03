<script setup lang="ts">
import { useSlots } from 'vue';

import { CircleHelp } from '@vben/icons';

import { Switch, VbenTooltip } from '@vben-core/shadcn-ui';

defineOptions({
  name: 'PreferenceSwitchItem',
});

const props = withDefaults(
  defineProps<{
    beforeSwitchClass?: string;
    disabled?: boolean;
    shortcutClass?: string;
    tip?: string;
  }>(),
  {
    beforeSwitchClass: 'ml-auto mr-2 text-xs opacity-60',
    disabled: false,
    shortcutClass: 'ml-auto mr-2 text-xs opacity-60',
    tip: '',
  },
);

const checked = defineModel<boolean>();

const slots = useSlots();

function handleClick() {
  if (props.disabled) {
    return;
  }

  checked.value = !checked.value;
}
</script>

<template>
  <div
    :class="{
      'opacity-50': disabled,
    }"
    class="hover:bg-accent my-1 flex w-full items-center justify-between rounded-md px-2 py-2.5"
    @click="handleClick"
  >
    <span class="flex items-center text-sm">
      <slot></slot>

      <VbenTooltip v-if="slots.tip || tip" side="bottom">
        <template #trigger>
          <CircleHelp class="ml-1 size-3 cursor-help" />
        </template>
        <slot name="tip">
          <template v-if="tip">
            <p v-for="(line, index) in tip.split('\n')" :key="index">
              {{ line }}
            </p>
          </template>
        </slot>
      </VbenTooltip>
    </span>
    <template v-if="$slots['before-switch']">
      <span :class="props.beforeSwitchClass">
        <slot name="before-switch"></slot>
      </span>
      <Switch v-model="checked" :disabled="disabled" @click.stop />
      <span v-if="$slots.shortcut" :class="props.shortcutClass">
        <slot name="shortcut"></slot>
      </span>
    </template>
    <template v-else>
      <span v-if="$slots.shortcut" :class="props.shortcutClass">
        <slot name="shortcut"></slot>
      </span>
      <Switch v-model="checked" :disabled="disabled" @click.stop />
    </template>
  </div>
</template>
