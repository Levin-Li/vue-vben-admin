<script setup lang="ts">
import { computed } from 'vue';

import type { NavigationVisualStyleType, SelectOption } from '@vben/types';

import { Switch, VbenTooltip } from '@vben-core/shadcn-ui';

import ToggleItem from '../toggle-item.vue';

defineOptions({
  name: 'PreferenceNavigationVisualStyle',
});

const navigationVisualStyle = defineModel<NavigationVisualStyleType>(
  'navigationVisualStyle',
);
const navigationGradientTransitionColor = defineModel<string>(
  'navigationGradientTransitionColor',
);
const navigationGradientTransitionColorEnabled = defineModel<boolean>(
  'navigationGradientTransitionColorEnabled',
);
const navigationGradientEndColor = defineModel<string>(
  'navigationGradientEndColor',
);
const navigationGradientCrudToolbarEnabled = defineModel<boolean>(
  'navigationGradientCrudToolbarEnabled',
);
const navigationGradientCrudHeaderEnabled = defineModel<boolean>(
  'navigationGradientCrudHeaderEnabled',
);
const navigationGradientCrudTableEnabled = defineModel<boolean>(
  'navigationGradientCrudTableEnabled',
);
const navigationGradientCrudRowsEnabled = defineModel<boolean>(
  'navigationGradientCrudRowsEnabled',
);
const navigationGradientSidebarEnabled = defineModel<boolean>(
  'navigationGradientSidebarEnabled',
);
const navigationGradientHeaderEnabled = defineModel<boolean>(
  'navigationGradientHeaderEnabled',
);
const navigationGradientTabbarEnabled = defineModel<boolean>(
  'navigationGradientTabbarEnabled',
);
const navigationGradientCrudQueryEnabled = defineModel<boolean>(
  'navigationGradientCrudQueryEnabled',
);
const navigationGradientCrudCreateFormEnabled = defineModel<boolean>(
  'navigationGradientCrudCreateFormEnabled',
);
const navigationGradientCrudEditFormEnabled = defineModel<boolean>(
  'navigationGradientCrudEditFormEnabled',
);
const navigationGradientCrudDetailFormEnabled = defineModel<boolean>(
  'navigationGradientCrudDetailFormEnabled',
);
const emit = defineEmits<{
  openColorSettings: [target: 'gradientEnd' | 'gradientTransition'];
}>();

// 导航视觉主题紧跟明暗主题展示，避免与导航交互配置混在一起。
const visualStyleItems: SelectOption[] = [
  { label: '默认主题', value: 'minimal' },
  { label: '主题渐变', value: 'brand-gradient' },
];

const isGradientTheme = computed(
  () => navigationVisualStyle.value === 'brand-gradient',
);
const sidebarGradientEnabled = computed({
  get: () => navigationGradientSidebarEnabled.value !== false,
  set: (value: boolean) => {
    navigationGradientSidebarEnabled.value = value;
  },
});
const headerGradientEnabled = computed({
  get: () => navigationGradientHeaderEnabled.value !== false,
  set: (value: boolean) => {
    navigationGradientHeaderEnabled.value = value;
  },
});
const tabbarGradientEnabled = computed({
  get: () => navigationGradientTabbarEnabled.value === true,
  set: (value: boolean) => {
    navigationGradientTabbarEnabled.value = value;
  },
});
const crudHeaderGradientEnabled = computed({
  get: () => navigationGradientCrudHeaderEnabled.value !== false,
  set: (value: boolean) => {
    navigationGradientCrudHeaderEnabled.value = value;
  },
});
</script>

<template>
  <ToggleItem v-model="navigationVisualStyle" :items="visualStyleItems">
    导航主题
  </ToggleItem>
  <template v-if="isGradientTheme">
    <div class="gradient-colors-row">
      <span>渐变色</span>
      <div class="gradient-color-controls">
        <VbenTooltip side="bottom">
          <template #trigger>
            <button
              aria-label="过渡色"
              :class="{
                'gradient-color-preview--disabled':
                  !navigationGradientTransitionColorEnabled,
              }"
              :disabled="!navigationGradientTransitionColorEnabled"
              class="gradient-color-preview"
              type="button"
              @click="emit('openColorSettings', 'gradientTransition')"
            >
              <span
                :style="{ backgroundColor: navigationGradientTransitionColor }"
              ></span>
            </button>
          </template>
          过渡色
        </VbenTooltip>
        <label class="gradient-transition-toggle">
          <span>过渡色</span>
          <Switch
            v-model="navigationGradientTransitionColorEnabled"
            aria-label="过渡色开关"
          />
        </label>
        <VbenTooltip side="bottom">
          <template #trigger>
            <button
              aria-label="最终色"
              class="gradient-color-preview"
              type="button"
              @click="emit('openColorSettings', 'gradientEnd')"
            >
              <span
                :style="{ backgroundColor: navigationGradientEndColor }"
              ></span>
            </button>
          </template>
          最终色
        </VbenTooltip>
      </div>
    </div>
    <div class="gradient-colors-row">
      <span>表格</span>
      <div class="gradient-table-controls">
        <label>
          <span>工具栏</span>
          <Switch
            v-model="navigationGradientCrudToolbarEnabled"
            aria-label="工具栏渐变"
          />
        </label>
        <label>
          <span>表头</span>
          <Switch v-model="crudHeaderGradientEnabled" aria-label="表头渐变" />
        </label>
        <label>
          <span>整表</span>
          <Switch
            v-model="navigationGradientCrudTableEnabled"
            aria-label="整个表格渐变"
          />
        </label>
        <label>
          <span>表行</span>
          <Switch
            v-model="navigationGradientCrudRowsEnabled"
            aria-label="表行渐变"
          />
        </label>
      </div>
    </div>
    <div class="gradient-colors-row gradient-sub-row">
      <span>表单</span>
      <div class="gradient-table-controls">
        <label>
          <span>查询</span>
          <Switch
            v-model="navigationGradientCrudQueryEnabled"
            aria-label="查询面板渐变"
          />
        </label>
        <label>
          <span>新增</span>
          <Switch
            v-model="navigationGradientCrudCreateFormEnabled"
            aria-label="新增表单渐变"
          />
        </label>
        <label>
          <span>编辑</span>
          <Switch
            v-model="navigationGradientCrudEditFormEnabled"
            aria-label="编辑表单渐变"
          />
        </label>
        <label>
          <span>详情</span>
          <Switch
            v-model="navigationGradientCrudDetailFormEnabled"
            aria-label="详情表单渐变"
          />
        </label>
      </div>
    </div>
    <div class="gradient-colors-row">
      <span>布局渐变</span>
      <div class="gradient-table-controls">
        <label>
          <span>侧边栏</span>
          <Switch v-model="sidebarGradientEnabled" aria-label="侧边栏渐变" />
        </label>
        <label>
          <span>顶栏</span>
          <Switch v-model="headerGradientEnabled" aria-label="顶栏渐变" />
        </label>
        <label>
          <span>标签栏</span>
          <Switch v-model="tabbarGradientEnabled" aria-label="标签栏渐变" />
        </label>
      </div>
    </div>
  </template>
</template>

<style scoped>
.gradient-colors-row {
  align-items: center;
  display: flex;
  font-size: 0.875rem;
  justify-content: space-between;
  margin: 4px 8px 8px;
  width: calc(100% - 16px);
}

.gradient-color-controls {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.gradient-color-preview {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  cursor: pointer;
  height: 28px;
  overflow: hidden;
  padding: 0;
  width: 56px;
}

.gradient-color-preview span {
  display: block;
  height: 100%;
  width: 100%;
}

.gradient-color-preview--disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.gradient-transition-toggle {
  align-items: center;
  display: flex;
  font-size: 0.75rem;
  gap: 6px;
  white-space: nowrap;
}

.gradient-table-controls {
  align-items: center;
  display: flex;
  font-size: 0.75rem;
  gap: 10px;
  margin-left: auto;
}

.gradient-table-controls label {
  align-items: center;
  display: flex;
  gap: 4px;
  white-space: nowrap;
}

.gradient-sub-row {
  margin-top: -4px;
}
</style>
