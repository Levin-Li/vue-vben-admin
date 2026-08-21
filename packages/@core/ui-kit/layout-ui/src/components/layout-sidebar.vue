<script setup lang="ts">
import type { CSSProperties } from 'vue';

import { computed, shallowRef, useSlots } from 'vue';

import { VbenScrollbar } from '@vben-core/shadcn-ui';

import { useScrollLock } from '@vueuse/core';

import { SidebarCollapseButton, SidebarFixedButton } from './widgets';

interface Props {
  /**
   * 折叠区域高度
   * @default 42
   */
  collapseHeight?: number;
  /**
   * 折叠宽度
   * @default 48
   */
  collapseWidth?: number;
  /**
   * 隐藏的dom是否可见
   * @default true
   */
  domVisible?: boolean;
  /**
   * 扩展区域宽度
   */
  extraWidth: number;
  /** 当前是否有可展示的扩展菜单 */
  extraMenuVisible?: boolean;
  /** 双列菜单一级栏与二级菜单面板的间隔 */
  extraGap?: number;
  /**
   * 固定扩展区域
   * @default false
   */
  fixedExtra?: boolean;
  /**
   * 头部高度
   */
  headerHeight: number;
  /**
   * 是否侧边混合模式
   * @default false
   */
  isSidebarMixed?: boolean;
  /**
   * 侧边栏布局顶部偏移量
   * @default 60
   */
  offsetTop?: number;
  /** 菜单背景色 */
  menuBackgroundColor?: string;
  /** 菜单悬停背景色 */
  menuHoverBackgroundColor?: string;
  /** 全局浅色主题下，菜单选中项使用主题色 */
  menuUsePrimaryActiveColor?: boolean;
  /** 菜单项之间的纵向间隔 */
  menuItemGap?: number;
  /**
   * 混合菜单宽度
   * @default 80
   */
  mixedWidth?: number;
  /**
   * 顶部外边距
   * @default 60
   */
  marginTop?: number;
  /** 右外边距 */
  marginRight?: number;
  /** 下外边距 */
  marginBottom?: number;
  /** 左外边距 */
  marginLeft?: number;
  /** 左上圆角 */
  radiusTopLeft?: number;
  /** 右上圆角 */
  radiusTopRight?: number;
  /** 右下圆角 */
  radiusBottomRight?: number;
  /** 左下圆角 */
  radiusBottomLeft?: number;
  /** 上边框宽度 */
  borderTopWidth?: number;
  /** 右边框宽度 */
  borderRightWidth?: number;
  /** 下边框宽度 */
  borderBottomWidth?: number;
  /** 左边框宽度 */
  borderLeftWidth?: number;
  /**
   * 是否显示
   * @default true
   */
  show?: boolean;
  /**
   * 显示折叠按钮
   * @default true
   */
  showCollapseButton?: boolean;
  /**
   * 显示固定按钮
   * @default true
   */
  showFixedButton?: boolean;
  /**
   * 主题
   */
  theme: string;
  /**
   * 主题色
   */
  themeColor?: string;
  /**
   * 子主题
   */
  themeSub: string;
  /**
   * 子主题色
   */
  themeSubColor?: string;
  /**
   * 宽度
   */
  width: number;
  /**
   * zIndex
   * @default 0
   */
  zIndex?: number;
}

const props = withDefaults(defineProps<Props>(), {
  collapseHeight: 42,
  collapseWidth: 48,
  domVisible: true,
  fixedExtra: false,
  extraMenuVisible: true,
  extraGap: 6,
  isSidebarMixed: false,
  offsetTop: 0,
  mixedWidth: 70,
  menuItemGap: 4,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginTop: 0,
  radiusTopLeft: 0,
  radiusTopRight: 0,
  radiusBottomRight: 0,
  radiusBottomLeft: 0,
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  show: true,
  showCollapseButton: true,
  showFixedButton: true,
  zIndex: 0,
});

const emit = defineEmits<{ leave: [] }>();
const collapse = defineModel<boolean>('collapse');
const extraCollapse = defineModel<boolean>('extraCollapse');
const expandOnHovering = defineModel<boolean>('expandOnHovering');
const expandOnHover = defineModel<boolean>('expandOnHover');
const extraVisible = defineModel<boolean>('extraVisible');

const isLocked = useScrollLock(document.body);
const slots = useSlots();

// @ts-expect-error unused
const asideRef = shallowRef<HTMLDivElement | null>();

const hiddenSideStyle = computed((): CSSProperties => calcMenuWidthStyle(true));

const shouldShowExtra = computed(
  () => props.isSidebarMixed && extraVisible.value && props.extraMenuVisible,
);

const menuBackgroundVariables = computed((): CSSProperties => {
  if (props.theme !== 'dark') {
    return {};
  }

  return {
    ...(props.menuBackgroundColor
      ? { '--sidebar-menu-background-color': props.menuBackgroundColor }
      : {}),
    ...(props.menuHoverBackgroundColor
      ? {
          '--sidebar-menu-hover-background-color':
            props.menuHoverBackgroundColor,
        }
      : {}),
    ...(props.menuUsePrimaryActiveColor
      ? {
          '--sidebar-menu-active-background-color': 'hsl(var(--primary) / 15%)',
          '--sidebar-menu-active-color': 'hsl(var(--primary))',
        }
      : {}),
  } as CSSProperties;
});

const colorVariables = computed((): CSSProperties => {
  if (props.theme !== 'dark' || !props.themeColor) {
    return menuBackgroundVariables.value;
  }

  return {
    '--menu': 'var(--sidebar)',
    '--sidebar': props.themeColor,
    '--sidebar-deep': props.themeColor,
    ...menuBackgroundVariables.value,
  } as CSSProperties;
});

const style = computed((): CSSProperties => {
  const {
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    isSidebarMixed,
    offsetTop,
    marginTop,
    menuBackgroundColor,
    menuUsePrimaryActiveColor,
    marginRight,
    marginBottom,
    marginLeft,
    radiusTopLeft,
    radiusTopRight,
    radiusBottomRight,
    radiusBottomLeft,
    zIndex,
  } = props;

  return {
    '--scroll-shadow': 'var(--sidebar)',
    ...calcMenuWidthStyle(false),
    height: `calc(100% - ${offsetTop + marginTop + marginBottom}px)`,
    marginTop: `${offsetTop + marginTop}px`,
    marginRight: `${marginRight}px`,
    marginBottom: `${marginBottom}px`,
    marginLeft: `${marginLeft}px`,
    boxSizing: 'border-box',
    borderColor: 'hsl(var(--border))',
    borderStyle: 'solid',
    borderTopWidth: `${borderTopWidth}px`,
    borderRightWidth: `${borderRightWidth}px`,
    borderBottomWidth: `${borderBottomWidth}px`,
    borderLeftWidth: `${borderLeftWidth}px`,
    borderRadius: `${radiusTopLeft}px ${radiusTopRight}px ${radiusBottomRight}px ${radiusBottomLeft}px`,
    zIndex,
    ...(menuUsePrimaryActiveColor && menuBackgroundColor
      ? { borderRightColor: '#fff' }
      : {}),
    ...(isSidebarMixed && extraVisible.value ? { transition: 'none' } : {}),
    ...(radiusTopLeft || radiusTopRight || radiusBottomRight || radiusBottomLeft
      ? { overflow: 'hidden' }
      : {}),
    ...colorVariables.value,
  } as CSSProperties;
});

const extraStyle = computed((): CSSProperties => {
  const {
    borderBottomWidth,
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    extraWidth,
    extraGap,
    marginBottom,
    marginLeft,
    marginRight,
    marginTop,
    menuBackgroundColor,
    menuUsePrimaryActiveColor,
    offsetTop,
    radiusBottomLeft,
    radiusBottomRight,
    radiusTopLeft,
    radiusTopRight,
    show,
    width,
    zIndex,
  } = props;
  const visible = shouldShowExtra.value && show;

  return {
    '--scroll-shadow': 'var(--sidebar)',
    backgroundColor: 'hsl(var(--sidebar))',
    boxSizing: 'border-box',
    borderColor: 'hsl(var(--border))',
    borderStyle: 'solid',
    borderTopWidth: `${borderTopWidth}px`,
    borderRightWidth: `${borderRightWidth}px`,
    borderBottomWidth: `${borderBottomWidth}px`,
    borderLeftWidth: `${borderLeftWidth}px`,
    borderRadius: `${radiusTopLeft}px ${radiusTopRight}px ${radiusBottomRight}px ${radiusBottomLeft}px`,
    height: `calc(100% - ${offsetTop + marginTop + marginBottom}px)`,
    left: `${width + marginLeft + extraGap}px`,
    marginTop: `${offsetTop + marginTop}px`,
    marginRight: `${marginRight}px`,
    marginBottom: `${marginBottom}px`,
    marginLeft: '0px',
    width: visible ? `${extraWidth}px` : 0,
    zIndex,
    ...(menuUsePrimaryActiveColor && menuBackgroundColor
      ? { borderColor: '#fff' }
      : {}),
    ...colorVariables.value,
  } as CSSProperties;
});

const extraTitleStyle = computed((): CSSProperties => {
  const { headerHeight } = props;

  return {
    height: `${headerHeight - 1}px`,
  };
});

const contentWidthStyle = computed((): CSSProperties => {
  const { collapseWidth, fixedExtra, isSidebarMixed, mixedWidth } = props;
  if (isSidebarMixed && fixedExtra) {
    return { width: `${collapse.value ? collapseWidth : mixedWidth}px` };
  }
  return {};
});

const contentStyle = computed((): CSSProperties => {
  const { collapseHeight, headerHeight } = props;

  return {
    backgroundColor:
      'hsl(var(--sidebar-menu-background-color, var(--sidebar)))',
    height: `calc(100% - ${headerHeight + collapseHeight}px)`,
    paddingTop: '8px',
    '--sidebar-menu-item-gap': `${props.menuItemGap}px`,
    ...contentWidthStyle.value,
  };
});

const headerStyle = computed((): CSSProperties => {
  const { headerHeight, isSidebarMixed } = props;

  return {
    ...(isSidebarMixed ? { display: 'flex', justifyContent: 'center' } : {}),
    height: `${headerHeight - 1}px`,
    ...contentWidthStyle.value,
  };
});

const extraContentStyle = computed((): CSSProperties => {
  const { collapseHeight, headerHeight } = props;
  return {
    backgroundColor:
      'hsl(var(--sidebar-menu-background-color, var(--sidebar)))',
    height: `calc(100% - ${
      (extraCollapse.value ? 0 : headerHeight) + collapseHeight
    }px)`,
    '--sidebar-menu-item-gap': `${props.menuItemGap}px`,
  };
});

const collapseStyle = computed((): CSSProperties => {
  return {
    height: `${props.collapseHeight}px`,
  };
});

function calcMenuWidthStyle(isHiddenDom: boolean): CSSProperties {
  const {
    extraWidth,
    extraGap,
    isSidebarMixed,
    marginLeft,
    marginRight,
    show,
    width,
  } = props;

  let widthValue =
    width === 0
      ? '0px'
      : `${width}px`;

  const { collapseWidth } = props;

  if (isHiddenDom && expandOnHovering.value && !expandOnHover.value) {
    widthValue = `${collapseWidth}px`;
  }

  const hasExtraMenu = isHiddenDom && shouldShowExtra.value && show;
  const placeholderWidth = isHiddenDom && show
    ? hasExtraMenu
      ? `calc(${widthValue} + ${
          marginLeft + extraGap + extraWidth + marginRight
        }px)`
      : `calc(${widthValue} + ${marginLeft + marginRight}px)`
    : widthValue;

  return {
    ...(placeholderWidth === '0px' ? { overflow: 'hidden' } : {}),
    flex: `0 0 ${placeholderWidth}`,
    marginLeft: show ? 0 : `-${placeholderWidth}`,
    maxWidth: placeholderWidth,
    minWidth: placeholderWidth,
    width: placeholderWidth,
  };
}

function handleMouseenter(e: MouseEvent) {
  if (e?.offsetX < 10) {
    return;
  }

  // 未开启和未折叠状态不生效
  if (expandOnHover.value) {
    return;
  }
  if (!expandOnHovering.value) {
    collapse.value = false;
  }
  if (props.isSidebarMixed) {
    isLocked.value = true;
  }
  expandOnHovering.value = true;
}

function handleMouseleave() {
  emit('leave');
  if (props.isSidebarMixed) {
    isLocked.value = false;
  }
  if (expandOnHover.value) {
    return;
  }

  expandOnHovering.value = false;
  collapse.value = true;
  extraVisible.value = false;
}
</script>

<template>
  <div
    v-if="domVisible"
    :class="theme"
    :style="hiddenSideStyle"
    class="h-full transition-all duration-150"
  ></div>
  <aside
    :class="[
      theme,
      {
        'bg-sidebar-deep': isSidebarMixed,
        'bg-sidebar': !isSidebarMixed,
      },
    ]"
    :style="style"
    class="fixed left-0 top-0 h-full transition-all duration-150"
    @mouseenter="handleMouseenter"
    @mouseleave="handleMouseleave"
  >
    <SidebarFixedButton
      v-if="!collapse && !isSidebarMixed && showFixedButton"
      v-model:expand-on-hover="expandOnHover"
    />
    <div v-if="slots.logo" :style="headerStyle">
      <slot name="logo"></slot>
    </div>
    <VbenScrollbar
      :style="contentStyle"
      class="layout-sidebar-scrollbar"
      shadow
      shadow-border
    >
      <slot></slot>
    </VbenScrollbar>

    <div :style="collapseStyle"></div>
    <SidebarCollapseButton
      v-if="showCollapseButton && !isSidebarMixed"
      v-model:collapsed="collapse"
    />
  </aside>
  <div
    v-if="shouldShowExtra"
    ref="asideRef"
    :class="[
      theme,
    ]"
    :style="extraStyle"
    class="fixed top-0 overflow-hidden bg-sidebar transition-all duration-200"
  >
    <SidebarCollapseButton
      v-if="isSidebarMixed && expandOnHover"
      v-model:collapsed="extraCollapse"
    />

    <SidebarFixedButton
      v-if="!extraCollapse"
      v-model:expand-on-hover="expandOnHover"
    />
    <div v-if="!extraCollapse" :style="extraTitleStyle" class="pl-2">
      <slot name="extra-title"></slot>
    </div>
    <VbenScrollbar
      :style="extraContentStyle"
      class="layout-sidebar-scrollbar border-border py-2"
      shadow
      shadow-border
    >
      <slot name="extra"></slot>
    </VbenScrollbar>
  </div>
</template>

<style scoped>
.layout-sidebar-scrollbar :deep([data-reka-scroll-area-viewport]) {
  overscroll-behavior-y: none;
}
</style>
