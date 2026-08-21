<script lang="ts" setup>
import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Empty, Input, Popover, Tooltip } from 'ant-design-vue';

import { MENU_ICON_GROUPS, MENU_ICON_OPTIONS } from './menu-icon-options';

const modelValue = defineModel<string>({ default: '' });

const pickerOpen = ref(false);
const activeGroup = ref('all');
const keyword = ref('');

const filteredOptions = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLocaleLowerCase();
  const group = MENU_ICON_GROUPS.find((item) => item.id === activeGroup.value);
  const options = group ? group.options : MENU_ICON_OPTIONS;

  if (!normalizedKeyword) {
    return options;
  }

  return options.filter((option) =>
    `${option.label} ${option.icon}`
      .toLocaleLowerCase()
      .includes(normalizedKeyword),
  );
});

function selectIcon(icon: string) {
  modelValue.value = icon;
  pickerOpen.value = false;
}
</script>

<template>
  <Popover
    v-model:open="pickerOpen"
    placement="bottomLeft"
    trigger="click"
    :overlay-inner-style="{ padding: 0 }"
  >
    <template #content>
      <section
        aria-label="菜单图标选择器"
        class="w-[500px] max-w-[calc(100vw-48px)] p-3"
      >
        <div class="mb-3 flex flex-wrap gap-1">
          <Button
            :type="activeGroup === 'all' ? 'primary' : 'text'"
            size="small"
            @click="activeGroup = 'all'"
          >
            全部
          </Button>
          <Button
            v-for="group in MENU_ICON_GROUPS"
            :key="group.id"
            :type="activeGroup === group.id ? 'primary' : 'text'"
            size="small"
            @click="activeGroup = group.id"
          >
            {{ group.label }}
          </Button>
        </div>

        <Input
          v-model:value="keyword"
          allow-clear
          class="mb-3"
          placeholder="搜索图标名称，例如：用户、设置、chart"
        />

        <div
          v-if="filteredOptions.length > 0"
          aria-label="可选菜单图标"
          class="grid max-h-72 grid-cols-8 gap-1 overflow-y-auto pr-1"
          role="listbox"
        >
          <Tooltip
            v-for="option in filteredOptions"
            :key="option.icon"
            :title="`${option.label} (${option.icon})`"
          >
            <Button
              :aria-label="`选择${option.label}图标`"
              class="h-10! w-10! p-0!"
              :class="[
                modelValue === option.icon ? 'border-primary text-primary' : '',
              ]"
              :type="modelValue === option.icon ? 'primary' : 'default'"
              role="option"
              :aria-selected="modelValue === option.icon"
              @click="selectIcon(option.icon)"
            >
              <IconifyIcon class="size-5" :icon="option.icon" />
            </Button>
          </Tooltip>
        </div>
        <Empty
          v-else
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
          description="未找到匹配图标"
        />

        <p class="text-muted-foreground mb-0 mt-3 text-xs leading-5">
          已选图标会保存为
          <code>lucide:名称</code>；也可以直接在输入框中填写兼容的 Iconify
          图标名。
        </p>
      </section>
    </template>

    <Input
      v-model:value="modelValue"
      allow-clear
      placeholder="选择或输入图标，例如 lucide:settings"
    >
      <template #prefix>
        <IconifyIcon v-if="modelValue" class="size-4" :icon="modelValue" />
      </template>
    </Input>
  </Popover>
</template>
