<script lang="ts" setup>
import type { CSSProperties, SetupContext } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

import type { MenuRecordRaw } from '@vben/types';

import { computed, onMounted, useSlots, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useRefresh } from '@vben/hooks';
import { $t, i18n } from '@vben/locales';
import {
  preferences,
  resolveBackgroundColor,
  updatePreferences,
  usePreferences,
} from '@vben/preferences';
import { useAccessStore, useTabbarStore, useTimezoneStore } from '@vben/stores';
import { cloneDeep, convertToHslCssVar, mapTree, TinyColor } from '@vben/utils';

import { VbenAdminLayout } from '@vben-core/layout-ui';
import { VbenBackTop, VbenLogo } from '@vben-core/shadcn-ui';

import { Breadcrumb, CheckUpdates, Preferences } from '../widgets';
import { LayoutContent, LayoutContentSpinner } from './content';
import { Copyright } from './copyright';
import { LayoutFooter } from './footer';
import { LayoutHeader } from './header';
import {
  LayoutExtraMenu,
  LayoutMenu,
  LayoutMixedMenu,
  useExtraMenu,
  useMixedMenu,
} from './menu';
import { LayoutTabbar } from './tabbar';

defineOptions({ name: 'BasicLayout' });

const emit = defineEmits<{ clickLogo: [] }>();

const {
  isDark,
  isHeaderNav,
  isMixedNav,
  isMobile,
  isSideMixedNav,
  isHeaderMixedNav,
  isHeaderSidebarNav,
  layout,
  preferencesButtonPosition,
  sidebarCollapsed,
  theme,
} = usePreferences();
const accessStore = useAccessStore();
const timezoneStore = useTimezoneStore();
const { refresh } = useRefresh();

const sidebarTheme = computed(() => {
  const dark = isDark.value || preferences.theme.semiDarkSidebar;
  return dark ? 'dark' : 'light';
});

const sidebarThemeSub = computed(() => {
  const dark = isDark.value || preferences.theme.semiDarkSidebarSub;
  return dark ? 'dark' : 'light';
});

const headerTheme = computed(() => {
  const dark = isDark.value || preferences.theme.semiDarkHeader;
  return dark ? 'dark' : 'light';
});

const semiDarkSidebarStyleColor = computed(() => {
  if (isDark.value || !preferences.theme.semiDarkSidebar) {
    return undefined;
  }

  return convertToHslCssVar(
    resolveBackgroundColor(
      preferences.theme.semiDarkSidebarColor,
      preferences.theme.semiDarkSidebarColorTransparency,
    ),
  );
});

const semiDarkHeaderStyleColor = computed(() => {
  if (isDark.value || !preferences.theme.semiDarkHeader) {
    return undefined;
  }

  return convertToHslCssVar(
    resolveBackgroundColor(
      preferences.theme.semiDarkHeaderColor,
      preferences.theme.semiDarkHeaderColorTransparency,
    ),
  );
});

const headerMenuPopupStyle = computed((): CSSProperties => {
  if (isDark.value || !preferences.theme.semiDarkHeader) {
    return {};
  }

  return {
    '--menu-background-color': 'hsl(var(--header-menu-background))',
    '--sidebar-menu-background-color': 'var(--header-menu-background)',
    '--menu-item-active-background-color':
      'hsl(var(--header-menu-theme-color, var(--primary)))',
    '--menu-item-active-color': 'hsl(var(--primary-foreground))',
    '--menu-item-color': 'hsl(var(--primary-foreground))',
    '--menu-item-hover-background-color':
      'hsl(var(--header-menu-theme-color, var(--primary)))',
    '--menu-item-hover-color': 'hsl(var(--primary-foreground))',
    '--menu-submenu-active-background-color':
      'hsl(var(--header-menu-theme-color, var(--primary)))',
    '--menu-submenu-active-color': 'hsl(var(--primary-foreground))',
    '--menu-submenu-hover-background-color':
      'hsl(var(--header-menu-theme-color, var(--primary)))',
    '--menu-submenu-hover-color': 'hsl(var(--primary-foreground))',
  };
});

const headerMenuStyle = computed((): CSSProperties => {
  if (isDark.value || !preferences.theme.semiDarkHeader) {
    return {};
  }

  return {
    ...headerMenuPopupStyle.value,
    '--menu-background-color': 'transparent',
  };
});

const sidebarMenuStyleColors = computed(() => {
  if (sidebarTheme.value !== 'dark' || isDark.value) {
    return {};
  }

  const menuBackgroundColor = preferences.theme.sidebarMenuBackgroundColorCustom
    ? resolveBackgroundColor(
        preferences.theme.sidebarMenuBackgroundColor,
        preferences.theme.sidebarMenuBackgroundColorTransparency,
      )
    : resolveBackgroundColor(
        preferences.theme.semiDarkSidebarColor,
        preferences.theme.semiDarkSidebarColorTransparency,
      );

  return {
    background: convertToHslCssVar(menuBackgroundColor),
    hoverBackground: convertToHslCssVar(
      new TinyColor(menuBackgroundColor).brighten(7).toHslString(),
    ),
  };
});

const sidebarMenuPopupStyle = computed(() => {
  const { background, hoverBackground } = sidebarMenuStyleColors.value;

  return {
    ...(background ? { '--sidebar-menu-background-color': background } : {}),
    ...(hoverBackground
      ? { '--sidebar-menu-hover-background-color': hoverBackground }
      : {}),
    ...(isDark.value
      ? {}
      : {
          '--sidebar-menu-active-background-color': 'hsl(var(--primary) / 15%)',
          '--sidebar-menu-active-color': 'hsl(var(--primary))',
          '--sidebar-menu-border-color': '#fff',
        }),
  } as CSSProperties;
});

const baseBackgroundColor = computed(() => {
  if (isDark.value) {
    return 'hsl(var(--background-deep))';
  }

  return preferences.theme.baseBackgroundColorCustom
    ? resolveBackgroundColor(
        preferences.theme.baseBackgroundColor,
        preferences.theme.baseBackgroundTransparency,
      )
    : 'hsl(var(--background-deep))';
});

const contentBackgroundColor = computed(() => {
  if (!preferences.theme.contentBackgroundColorCustom) {
    return 'transparent';
  }

  return resolveBackgroundColor(
    preferences.theme.contentBackgroundColor,
    preferences.theme.contentBackgroundTransparency,
  );
});

const tabbarBackgroundColor = computed(() => {
  if (!preferences.tabbar.backgroundColorCustom) {
    return 'hsl(var(--background))';
  }

  return resolveBackgroundColor(
    preferences.tabbar.backgroundColor,
    preferences.tabbar.backgroundTransparency,
  );
});

const baseLayoutStyle = computed((): CSSProperties => {
  return { backgroundColor: baseBackgroundColor.value };
});

const logoClass = computed(() => {
  const { collapsedShowTitle } = preferences.sidebar;
  const classes: string[] = [];

  if (collapsedShowTitle && sidebarCollapsed.value && !isMixedNav.value) {
    classes.push('mx-auto');
  }

  if (isSideMixedNav.value) {
    classes.push('flex-center');
  }

  return classes.join(' ');
});

const isMenuRounded = computed(() => {
  return preferences.navigation.styleType === 'rounded';
});

const logoCollapsed = computed(() => {
  if (isMobile.value && sidebarCollapsed.value) {
    return true;
  }
  if (isHeaderNav.value || isMixedNav.value || isHeaderSidebarNav.value) {
    return false;
  }
  return (
    sidebarCollapsed.value || isSideMixedNav.value || isHeaderMixedNav.value
  );
});

const showHeaderNav = computed(() => {
  return (
    !isMobile.value &&
    (isHeaderNav.value || isMixedNav.value || isHeaderMixedNav.value)
  );
});

const {
  handleMenuSelect,
  handleMenuOpen,
  headerActive,
  headerMenus,
  sidebarActive,
  sidebarMenus,
  mixHeaderMenus,
  sidebarVisible,
} = useMixedMenu();

// 侧边多列菜单
const {
  extraActiveMenu,
  extraMenus,
  handleDefaultSelect,
  handleMenuMouseEnter,
  handleMixedMenuSelect,
  handleSideMouseLeave,
  sidebarExtraVisible,
} = useExtraMenu(mixHeaderMenus);

/**
 * 包装菜单，翻译菜单名称
 * @param menus 原始菜单数据
 * @param deep 是否深度包装。对于双列布局，只需要包装第一层，因为更深层的数据会在扩展菜单中重新包装
 */
function wrapperMenus(menus: MenuRecordRaw[], deep: boolean = true) {
  return deep
    ? mapTree(menus, (item) => {
        return { ...cloneDeep(item), name: $t(item.name) };
      })
    : menus.map((item) => {
        return { ...cloneDeep(item), name: $t(item.name) };
      });
}

function toggleSidebar() {
  updatePreferences({
    sidebar: {
      hidden: !preferences.sidebar.hidden,
    },
  });
}

function clickLogo() {
  emit('clickLogo');
}

function autoCollapseMenuByRouteMeta(route: RouteLocationNormalizedLoaded) {
  // 只在双列模式下生效
  if (
    ['header-mixed-nav', 'sidebar-mixed-nav'].includes(
      preferences.app.layout,
    ) &&
    route.meta &&
    route.meta.hideInMenu
  ) {
    sidebarExtraVisible.value = false;
  }
}

const route = useRoute();

onMounted(() => {
  autoCollapseMenuByRouteMeta(route);
});

watch(
  () => preferences.app.layout,
  async (val) => {
    if (val === 'sidebar-mixed-nav' && preferences.sidebar.hidden) {
      updatePreferences({
        sidebar: {
          hidden: false,
        },
      });
    }
  },
);

const tabbarStore = useTabbarStore();

function refreshAll() {
  tabbarStore.cachedTabs.clear();
  refresh();
}

// 语言更新后，刷新页面
// i18n.global.locale会在preference.app.locale变更之后才会更新，因此watchpreference.app.locale是不合适的，刷新页面时可能语言配置尚未完全加载完成
watch(i18n.global.locale, refreshAll, { flush: 'post' });

// 时区更新后，刷新页面
watch(() => timezoneStore.timezone, refreshAll, { flush: 'post' });

const slots: SetupContext['slots'] = useSlots();
const headerSlots = computed(() => {
  return Object.keys(slots).filter((key) => key.startsWith('header-'));
});
</script>

<template>
  <VbenAdminLayout
    v-model:sidebar-extra-visible="sidebarExtraVisible"
    :style="baseLayoutStyle"
    :base-background-color="baseBackgroundColor"
    :content-compact="preferences.app.contentCompact"
    :content-compact-width="preferences.app.contentCompactWidth"
    :content-background-color="contentBackgroundColor"
    :content-padding="preferences.app.contentPadding"
    :content-margin-bottom="preferences.app.contentMarginBottom"
    :content-margin-left="preferences.app.contentMarginLeft"
    :content-margin-right="preferences.app.contentMarginRight"
    :content-margin-top="preferences.app.contentMarginTop"
    :content-radius-top-left="preferences.app.contentRadiusTopLeft"
    :content-radius-top-right="preferences.app.contentRadiusTopRight"
    :content-radius-bottom-right="preferences.app.contentRadiusBottomRight"
    :content-radius-bottom-left="preferences.app.contentRadiusBottomLeft"
    :content-border-top-width="preferences.app.contentBorderTopWidth"
    :content-border-right-width="preferences.app.contentBorderRightWidth"
    :content-border-bottom-width="preferences.app.contentBorderBottomWidth"
    :content-border-left-width="preferences.app.contentBorderLeftWidth"
    :footer-enable="preferences.footer.enable"
    :footer-fixed="preferences.footer.fixed"
    :footer-height="preferences.footer.height"
    :header-height="preferences.header.height"
    :header-margin-top="preferences.header.marginTop"
    :header-margin-right="preferences.header.marginRight"
    :header-margin-bottom="preferences.header.marginBottom"
    :header-margin-left="preferences.header.marginLeft"
    :header-radius-top-left="preferences.header.radiusTopLeft"
    :header-radius-top-right="preferences.header.radiusTopRight"
    :header-radius-bottom-right="preferences.header.radiusBottomRight"
    :header-radius-bottom-left="preferences.header.radiusBottomLeft"
    :header-border-top-width="preferences.header.borderTopWidth"
    :header-border-right-width="preferences.header.borderRightWidth"
    :header-border-bottom-width="preferences.header.borderBottomWidth"
    :header-border-left-width="preferences.header.borderLeftWidth"
    :header-hidden="preferences.header.hidden"
    :header-mode="preferences.header.mode"
    :header-theme="headerTheme"
    :header-theme-color="semiDarkHeaderStyleColor"
    :header-toggle-sidebar-button="preferences.widget.sidebarToggle"
    :header-visible="preferences.header.enable"
    :is-mobile="preferences.app.isMobile"
    :layout="layout"
    :sidebar-collapse="preferences.sidebar.collapsed"
    :sidebar-collapse-show-title="preferences.sidebar.collapsedShowTitle"
    :sidebar-enable="sidebarVisible"
    :sidebar-collapsed-button="preferences.sidebar.collapsedButton"
    :sidebar-fixed-button="preferences.sidebar.fixedButton"
    :sidebar-expand-on-hover="preferences.sidebar.expandOnHover"
    :sidebar-extra-collapse="preferences.sidebar.extraCollapse"
    :sidebar-extra-collapsed-width="preferences.sidebar.extraCollapsedWidth"
    :sidebar-extra-menu-visible="extraMenus.length > 0"
    :sidebar-hidden="preferences.sidebar.hidden"
    :sidebar-mixed-width="preferences.sidebar.mixedWidth"
    :sidebar-mixed-menu-gap="preferences.sidebar.mixedMenuGap"
    :sidebar-menu-item-gap="preferences.sidebar.menuItemGap"
    :sidebar-menu-background-color="sidebarMenuStyleColors.background"
    :sidebar-menu-hover-background-color="
      sidebarMenuStyleColors.hoverBackground
    "
    :sidebar-menu-use-primary-active-color="!isDark"
    :sidebar-theme="sidebarTheme"
    :sidebar-theme-color="semiDarkSidebarStyleColor"
    :sidebar-theme-sub="sidebarThemeSub"
    :sidebar-theme-sub-color="semiDarkSidebarStyleColor"
    :sidebar-width="preferences.sidebar.width"
    :sidebar-margin-top="preferences.sidebar.marginTop"
    :sidebar-margin-right="preferences.sidebar.marginRight"
    :sidebar-margin-bottom="preferences.sidebar.marginBottom"
    :sidebar-margin-left="preferences.sidebar.marginLeft"
    :sidebar-radius-top-left="preferences.sidebar.radiusTopLeft"
    :sidebar-radius-top-right="preferences.sidebar.radiusTopRight"
    :sidebar-radius-bottom-right="preferences.sidebar.radiusBottomRight"
    :sidebar-radius-bottom-left="preferences.sidebar.radiusBottomLeft"
    :sidebar-border-top-width="preferences.sidebar.borderTopWidth"
    :sidebar-border-right-width="preferences.sidebar.borderRightWidth"
    :sidebar-border-bottom-width="preferences.sidebar.borderBottomWidth"
    :sidebar-border-left-width="preferences.sidebar.borderLeftWidth"
    :side-collapse-width="preferences.sidebar.collapseWidth"
    :tabbar-enable="preferences.tabbar.enable"
    :tabbar-background-color="tabbarBackgroundColor"
    :tabbar-height="preferences.tabbar.height"
    :tabbar-margin-top="preferences.tabbar.marginTop"
    :tabbar-margin-right="preferences.tabbar.marginRight"
    :tabbar-margin-bottom="preferences.tabbar.marginBottom"
    :tabbar-margin-left="preferences.tabbar.marginLeft"
    :tabbar-radius-top-left="preferences.tabbar.radiusTopLeft"
    :tabbar-radius-top-right="preferences.tabbar.radiusTopRight"
    :tabbar-radius-bottom-right="preferences.tabbar.radiusBottomRight"
    :tabbar-radius-bottom-left="preferences.tabbar.radiusBottomLeft"
    :tabbar-border-top-width="preferences.tabbar.borderTopWidth"
    :tabbar-border-right-width="preferences.tabbar.borderRightWidth"
    :tabbar-border-bottom-width="preferences.tabbar.borderBottomWidth"
    :tabbar-border-left-width="preferences.tabbar.borderLeftWidth"
    :z-index="preferences.app.zIndex"
    @side-mouse-leave="handleSideMouseLeave"
    @toggle-sidebar="toggleSidebar"
    @update:sidebar-collapse="
      (value: boolean) => updatePreferences({ sidebar: { collapsed: value } })
    "
    @update:sidebar-enable="
      (value: boolean) => updatePreferences({ sidebar: { enable: value } })
    "
    @update:sidebar-expand-on-hover="
      (value: boolean) =>
        updatePreferences({ sidebar: { expandOnHover: value } })
    "
    @update:sidebar-extra-collapse="
      (value: boolean) =>
        updatePreferences({ sidebar: { extraCollapse: value } })
    "
  >
    <!-- logo -->
    <template #logo>
      <VbenLogo
        v-if="preferences.logo.enable"
        :fit="preferences.logo.fit"
        :class="logoClass"
        :collapsed="logoCollapsed"
        :src="preferences.logo.source"
        :src-dark="preferences.logo.sourceDark"
        :text="preferences.app.name"
        :theme="showHeaderNav ? headerTheme : theme"
        @click="clickLogo"
      >
        <template v-if="$slots['logo-text']" #text>
          <slot name="logo-text"></slot>
        </template>
      </VbenLogo>
    </template>
    <!-- 头部区域 -->
    <template #header>
      <LayoutHeader :theme="theme">
        <template
          v-if="!showHeaderNav && preferences.breadcrumb.enable"
          #breadcrumb
        >
          <Breadcrumb
            :hide-when-only-one="preferences.breadcrumb.hideOnlyOne"
            :show-home="preferences.breadcrumb.showHome"
            :show-icon="preferences.breadcrumb.showIcon"
            :type="preferences.breadcrumb.styleType"
          />
        </template>
        <template v-if="showHeaderNav" #menu>
          <LayoutMenu
            :default-active="headerActive"
            :menus="wrapperMenus(headerMenus)"
            :popup-style="headerMenuPopupStyle"
            :rounded="isMenuRounded"
            :theme="headerTheme"
            :style="headerMenuStyle"
            class="w-full"
            mode="horizontal"
            @select="handleMenuSelect"
          />
        </template>
        <template #user-dropdown>
          <slot name="user-dropdown"></slot>
        </template>
        <template #notification>
          <slot name="notification"></slot>
        </template>
        <template #timezone>
          <slot name="timezone"></slot>
        </template>
        <template v-for="item in headerSlots" #[item]>
          <slot :name="item"></slot>
        </template>
      </LayoutHeader>
    </template>
    <!-- 侧边菜单区域 -->
    <template #menu>
      <LayoutMenu
        :accordion="preferences.navigation.accordion"
        :collapse="preferences.sidebar.collapsed"
        :collapse-show-title="preferences.sidebar.collapsedShowTitle"
        :default-active="sidebarActive"
        :menus="wrapperMenus(sidebarMenus)"
        :popup-style="sidebarMenuPopupStyle"
        :rounded="isMenuRounded"
        :theme="sidebarTheme"
        mode="vertical"
        @open="handleMenuOpen"
        @select="handleMenuSelect"
      />
    </template>
    <template #mixed-menu>
      <LayoutMixedMenu
        :active-path="extraActiveMenu"
        :menus="wrapperMenus(mixHeaderMenus, false)"
        :rounded="isMenuRounded"
        :theme="sidebarTheme"
        @default-select="handleDefaultSelect"
        @enter="handleMenuMouseEnter"
        @select="handleMixedMenuSelect"
      />
    </template>
    <!-- 侧边额外区域 -->
    <template #side-extra>
      <LayoutExtraMenu
        :accordion="preferences.navigation.accordion"
        :collapse="preferences.sidebar.extraCollapse"
        :menus="wrapperMenus(extraMenus)"
        :popup-style="sidebarMenuPopupStyle"
        :rounded="isMenuRounded"
        :theme="sidebarThemeSub"
      />
    </template>
    <template #side-extra-title>
      <VbenLogo
        v-if="preferences.logo.enable"
        :fit="preferences.logo.fit"
        :text="preferences.app.name"
        :theme="theme"
      >
        <template v-if="$slots['logo-text']" #text>
          <slot name="logo-text"></slot>
        </template>
      </VbenLogo>
    </template>

    <template #tabbar>
      <LayoutTabbar
        v-if="preferences.tabbar.enable"
        :show-icon="preferences.tabbar.showIcon"
        :theme="theme"
      />
    </template>

    <!-- 主体内容 -->
    <template #content>
      <LayoutContent />
    </template>

    <template v-if="preferences.transition.loading" #content-overlay>
      <LayoutContentSpinner />
    </template>

    <!-- 页脚 -->
    <template v-if="preferences.footer.enable" #footer>
      <LayoutFooter>
        <Copyright
          v-if="preferences.copyright.enable"
          v-bind="preferences.copyright"
        />
      </LayoutFooter>
    </template>

    <template #extra>
      <slot name="extra"></slot>
      <CheckUpdates
        v-if="preferences.app.enableCheckUpdates"
        :check-updates-interval="preferences.app.checkUpdatesInterval"
      />

      <Transition v-if="preferences.widget.lockScreen" name="slide-up">
        <slot v-if="accessStore.isLockScreen" name="lock-screen"></slot>
      </Transition>

      <template v-if="preferencesButtonPosition.fixed">
        <Preferences
          class="z-100 fixed right-0 top-1/2 -translate-y-1/2 transform"
        />
      </template>
      <VbenBackTop />
    </template>
  </VbenAdminLayout>
</template>
