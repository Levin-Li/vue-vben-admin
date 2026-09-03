<script lang="ts" setup>
import type { PropType, VNodeChild } from 'vue';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  useSlots,
} from 'vue';

import { useRefresh } from '@vben/hooks';
import { RotateCw } from '@vben/icons';
import { $t } from '@vben/locales';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import {
  VbenFullScreen,
  VbenIconButton,
  VbenTooltip,
} from '@vben-core/shadcn-ui';

import {
  GlobalSearch,
  LanguageToggle,
  PreferencesButton,
  ThemeToggle,
  TimezoneButton,
} from '../../widgets';
import { getLayoutHeaderExtensionAreaItems } from './header-extension-area';

interface Props {
  /**
   * Logo 主题
   */
  theme?: string;
}

defineOptions({
  name: 'LayoutHeader',
});

withDefaults(defineProps<Props>(), {
  theme: 'light',
});

const REFERENCE_VALUE = 50;

const accessStore = useAccessStore();
const { globalSearchShortcutKey, preferencesButtonPosition } = usePreferences();
const slots = useSlots();
const { refresh } = useRefresh();
const headerTopCenterItems = getLayoutHeaderExtensionAreaItems('center');
const headerTopRightItems = getLayoutHeaderExtensionAreaItems('right');
const rightControlsRef = ref<HTMLElement>();
const rightControlsWidth = ref(0);
let rightControlsResizeObserver: ResizeObserver | undefined;
const showHeaderTopCenter = computed(() => {
  return Boolean(
    slots['header-top-center'] || headerTopCenterItems.value.length > 0,
  );
});
const showHeaderTopRight = computed(() => {
  return Boolean(
    slots['header-top-right'] || headerTopRightItems.value.length > 0,
  );
});
const centerExtensionStyle = computed(() =>
  rightControlsWidth.value > 0
    ? { right: `${rightControlsWidth.value + 8}px` }
    : undefined,
);

function syncRightControlsWidth() {
  rightControlsWidth.value = rightControlsRef.value?.offsetWidth || 0;
}

onMounted(() => {
  syncRightControlsWidth();

  if (typeof ResizeObserver === 'undefined' || !rightControlsRef.value) {
    return;
  }

  rightControlsResizeObserver = new ResizeObserver(syncRightControlsWidth);
  rightControlsResizeObserver.observe(rightControlsRef.value);
});

onBeforeUnmount(() => {
  rightControlsResizeObserver?.disconnect();
});

const HeaderExtensionAreaRender = defineComponent({
  name: 'HeaderExtensionAreaRender',
  props: {
    render: {
      required: true,
      type: Function as PropType<() => VNodeChild>,
    },
  },
  setup(props) {
    return () => props.render();
  },
});

const quickActionSlots = computed(() => {
  const list: string[] = [];
  if (preferencesButtonPosition.value.header) {
    list.push('preferences');
  }
  if (preferences.widget.themeToggle) {
    list.push('theme-toggle');
  }
  if (preferences.widget.languageToggle) {
    list.push('language-toggle');
  }
  if (preferences.widget.timezone) {
    list.push('timezone');
  }
  if (preferences.widget.fullscreen) {
    list.push('fullscreen');
  }
  return list;
});

const rightSlots = computed(() => {
  const list = [{ index: REFERENCE_VALUE + 100, name: 'user-dropdown' }];
  if (preferences.widget.globalSearch) {
    list.push({
      index: REFERENCE_VALUE,
      name: 'global-search',
    });
  }

  if (quickActionSlots.value.length > 0) {
    list.push({
      index: REFERENCE_VALUE + 10,
      name: 'quick-actions',
    });
  }
  if (preferences.widget.notification) {
    list.push({
      index: REFERENCE_VALUE + 60,
      name: 'notification',
    });
  }

  Object.keys(slots).forEach((key) => {
    const name = key.split('-');
    if (key.startsWith('header-right')) {
      list.push({ index: Number(name[2]), name: key });
    }
  });
  return list.toSorted((a, b) => a.index - b.index);
});

const leftSlots = computed(() => {
  const list: Array<{ index: number; name: string }> = [];

  if (preferences.widget.refresh) {
    list.push({
      index: 0,
      name: 'refresh',
    });
  }

  Object.keys(slots).forEach((key) => {
    const name = key.split('-');
    if (key.startsWith('header-left')) {
      list.push({ index: Number(name[2]), name: key });
    }
  });
  return list.toSorted((a, b) => a.index - b.index);
});
</script>

<template>
  <div
    class="layout-header-font-scale relative flex h-full min-w-0 flex-1 items-center"
  >
    <template
      v-for="slot in leftSlots.filter((item) => item.index < REFERENCE_VALUE)"
      :key="slot.name"
    >
      <slot :name="slot.name">
        <template v-if="slot.name === 'refresh'">
          <VbenIconButton
            class="header-theme-control my-0 mr-1 rounded-md"
            @click="refresh"
          >
            <RotateCw class="size-4" />
          </VbenIconButton>
        </template>
      </slot>
    </template>
    <div class="flex-center hidden lg:block">
      <slot name="breadcrumb"></slot>
    </div>
    <template
      v-for="slot in leftSlots.filter((item) => item.index > REFERENCE_VALUE)"
      :key="slot.name"
    >
      <slot :name="slot.name"></slot>
    </template>
    <div
      :class="`menu-align-${preferences.header.menuAlign}`"
      class="flex h-full min-w-0 flex-1 items-center"
    >
      <slot name="menu"></slot>
    </div>
    <div
      v-if="showHeaderTopCenter"
      :style="centerExtensionStyle"
      class="pointer-events-none absolute top-1/2 z-10 flex h-full -translate-y-1/2 items-center justify-end overflow-x-auto px-2"
      data-testid="header-top-center-extensions"
    >
      <div class="pointer-events-auto flex h-full min-w-0 items-center gap-2">
        <slot name="header-top-center"></slot>
        <template v-for="item in headerTopCenterItems" :key="item.id">
          <div class="flex h-full min-w-0 items-center" :class="item.class">
            <component
              :is="item.component"
              v-if="item.component"
              v-bind="item.props"
            />
            <HeaderExtensionAreaRender
              v-else-if="item.render"
              :render="item.render"
            />
          </div>
        </template>
      </div>
    </div>
    <div
      ref="rightControlsRef"
      class="relative z-20 flex h-full min-w-max shrink-0 items-center"
      data-testid="header-right-fixed-controls"
    >
      <div
        v-if="showHeaderTopRight"
        class="mr-1 flex h-full min-w-0 items-center gap-2"
      >
        <slot name="header-top-right"></slot>
        <template v-for="item in headerTopRightItems" :key="item.id">
          <div class="flex h-full min-w-0 items-center" :class="item.class">
            <component
              :is="item.component"
              v-if="item.component"
              v-bind="item.props"
            />
            <HeaderExtensionAreaRender
              v-else-if="item.render"
              :render="item.render"
            />
          </div>
        </template>
      </div>
      <template v-for="slot in rightSlots" :key="slot.name">
        <slot :name="slot.name">
          <template v-if="slot.name === 'global-search'">
            <GlobalSearch
              :enable-shortcut-key="globalSearchShortcutKey"
              :menus="accessStore.accessMenus"
              class="mr-1 hidden 2xl:mr-4 2xl:block"
            />
          </template>

          <template v-else-if="slot.name === 'quick-actions'">
            <div
              :aria-label="$t('ui.widgets.quickActions')"
              class="header-quick-actions"
              data-testid="header-quick-actions"
              role="group"
            >
              <div class="header-quick-actions__list">
                <VbenTooltip
                  v-if="quickActionSlots.includes('preferences')"
                  side="left"
                >
                  <template #trigger>
                    <div class="header-quick-actions__item">
                      <PreferencesButton />
                    </div>
                  </template>
                  {{ $t('ui.widgets.interfaceSettings') }}
                </VbenTooltip>
                <VbenTooltip
                  v-if="quickActionSlots.includes('theme-toggle')"
                  side="left"
                >
                  <template #trigger>
                    <div class="header-quick-actions__item">
                      <ThemeToggle class="mt-[2px]" />
                    </div>
                  </template>
                  {{ $t('ui.widgets.theme') }}
                </VbenTooltip>
                <VbenTooltip
                  v-if="quickActionSlots.includes('language-toggle')"
                  side="left"
                >
                  <template #trigger>
                    <div class="header-quick-actions__item">
                      <LanguageToggle />
                    </div>
                  </template>
                  {{ $t('ui.widgets.language') }}
                </VbenTooltip>
                <VbenTooltip
                  v-if="quickActionSlots.includes('timezone')"
                  side="left"
                >
                  <template #trigger>
                    <div class="header-quick-actions__item">
                      <TimezoneButton class="mt-[2px]" />
                    </div>
                  </template>
                  {{ $t('ui.widgets.timezone.setTimezone') }}
                </VbenTooltip>
                <VbenTooltip
                  v-if="quickActionSlots.includes('fullscreen')"
                  side="left"
                >
                  <template #trigger>
                    <div class="header-quick-actions__item">
                      <VbenFullScreen />
                    </div>
                  </template>
                  {{ $t('ui.widgets.fullscreen') }}
                </VbenTooltip>
              </div>
            </div>
          </template>
        </slot>
      </template>
    </div>
  </div>
</template>

<style scoped>
.layout-header-font-scale {
  font-size: var(--font-size-header-menu);
}

.layout-header-font-scale :deep(:is(a, button, input, kbd, p, span)) {
  font-size: inherit !important;
}
</style>
<style lang="scss" scoped>
.menu-align-start {
  --menu-align: start;
}

.menu-align-center {
  --menu-align: center;
}

.menu-align-end {
  --menu-align: end;
}

.header-quick-actions {
  @apply relative z-30 mr-1 flex size-8 shrink-0 items-start justify-end;

  &__list {
    @apply absolute right-0 top-0 flex max-h-8 flex-col items-center overflow-hidden rounded-md border border-transparent bg-transparent transition-[max-height,box-shadow,background-color] duration-200;
  }

  &__item {
    @apply flex size-8 shrink-0 items-center justify-center;

    :deep(button) {
      background-color: var(--header-control-background, transparent);
      color: var(--header-control-foreground, inherit);
    }

    :deep(button:hover) {
      background-color: var(
        --header-control-background-hover,
        hsl(var(--accent))
      );
    }

    :deep(svg) {
      color: currentColor;
    }
  }

  &:focus-within,
  &:hover {
    .header-quick-actions__list {
      @apply max-h-48 overflow-visible shadow-md;
      border-color: var(--header-control-border, hsl(var(--border)));
      background-color: var(--header-control-surface, hsl(var(--popover)));
    }
  }
}
</style>
