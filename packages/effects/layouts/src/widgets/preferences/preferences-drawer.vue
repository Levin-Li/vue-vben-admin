<script setup lang="ts">
import type { SupportedLanguagesType } from '@vben/locales';
import type {
  BreadcrumbStyleType,
  BuiltinThemeType,
  ContentCompactType,
  LayoutHeaderMenuAlignType,
  LayoutHeaderModeType,
  LayoutType,
  NavigationStyleType,
  PreferencesButtonPositionType,
  ThemeModeType,
} from '@vben/types';

import type { SegmentedItem } from '@vben-core/shadcn-ui';

import { computed, ref } from 'vue';

import { Copy, Pin, PinOff, RotateCw } from '@vben/icons';
import { $t, loadLocaleMessages } from '@vben/locales';
import {
  clearCache,
  preferences,
  resetPreferences,
  usePreferences,
} from '@vben/preferences';

import { useVbenDrawer } from '@vben-core/popup-ui';
import {
  VbenButton,
  VbenIconButton,
  VbenSegmented,
} from '@vben-core/shadcn-ui';
import { globalShareState } from '@vben-core/shared/global-state';

import { useClipboard } from '@vueuse/core';

import {
  Animation,
  Block,
  Breadcrumb,
  ColorMode,
  ColorSettings,
  Content,
  FontScale,
  FontSize,
  Footer,
  General,
  GlobalShortcutKeys,
  Header,
  Layout,
  Navigation,
  Radius,
  Sidebar,
  Tabbar,
  Theme,
  Widget,
} from './blocks';

const message = globalShareState.getMessage();

const appLocale = defineModel<SupportedLanguagesType>('appLocale');
const appDynamicTitle = defineModel<boolean>('appDynamicTitle');
const appLayout = defineModel<LayoutType>('appLayout');
const appColorGrayMode = defineModel<boolean>('appColorGrayMode');
const appColorWeakMode = defineModel<boolean>('appColorWeakMode');
const appContentCompact = defineModel<ContentCompactType>('appContentCompact');
const appContentMarginTop = defineModel<number>('appContentMarginTop');
const appContentMarginRight = defineModel<number>('appContentMarginRight');
const appContentMarginBottom = defineModel<number>('appContentMarginBottom');
const appContentMarginLeft = defineModel<number>('appContentMarginLeft');
const appContentRadiusTopLeft = defineModel<number>('appContentRadiusTopLeft');
const appContentRadiusTopRight = defineModel<number>(
  'appContentRadiusTopRight',
);
const appContentRadiusBottomRight = defineModel<number>(
  'appContentRadiusBottomRight',
);
const appContentRadiusBottomLeft = defineModel<number>(
  'appContentRadiusBottomLeft',
);
const appContentBorderTopWidth = defineModel<number>(
  'appContentBorderTopWidth',
);
const appContentBorderRightWidth = defineModel<number>(
  'appContentBorderRightWidth',
);
const appContentBorderBottomWidth = defineModel<number>(
  'appContentBorderBottomWidth',
);
const appContentBorderLeftWidth = defineModel<number>(
  'appContentBorderLeftWidth',
);
const appWatermark = defineModel<boolean>('appWatermark');
const appWatermarkColor = defineModel<string>('appWatermarkColor');
const appWatermarkColorCustom = defineModel<boolean>('appWatermarkColorCustom');
const appWatermarkTransparency = defineModel<number>(
  'appWatermarkTransparency',
);
const appWatermarkContent = defineModel<string>('appWatermarkContent');
const appEnableCheckUpdates = defineModel<boolean>('appEnableCheckUpdates');
const appEnableStickyPreferencesNavigationBar = defineModel<boolean>(
  'appEnableStickyPreferencesNavigationBar',
);
const appPreferencesButtonPosition = defineModel<PreferencesButtonPositionType>(
  'appPreferencesButtonPosition',
);

const transitionProgress = defineModel<boolean>('transitionProgress');
const transitionName = defineModel<string>('transitionName');
const transitionLoading = defineModel<boolean>('transitionLoading');
const transitionEnable = defineModel<boolean>('transitionEnable');

const themeColorPrimary = defineModel<string>('themeColorPrimary');
const themeColorDestructive = defineModel<string>('themeColorDestructive');
const themeColorSuccess = defineModel<string>('themeColorSuccess');
const themeColorWarning = defineModel<string>('themeColorWarning');
const themeBaseBackgroundColor = defineModel<string>(
  'themeBaseBackgroundColor',
);
const themeBaseBackgroundColorCustom = defineModel<boolean>(
  'themeBaseBackgroundColorCustom',
);
const themeBaseBackgroundTransparency = defineModel<number>(
  'themeBaseBackgroundTransparency',
);
const themeContentBackgroundColor = defineModel<string>(
  'themeContentBackgroundColor',
);
const themeContentBackgroundColorCustom = defineModel<boolean>(
  'themeContentBackgroundColorCustom',
);
const themeContentBackgroundTransparency = defineModel<number>(
  'themeContentBackgroundTransparency',
);
const themeBuiltinType = defineModel<BuiltinThemeType>('themeBuiltinType');
const themeMode = defineModel<ThemeModeType>('themeMode');
const themeRadius = defineModel<string>('themeRadius');
const themeFontSize = defineModel<number>('themeFontSize');
const themeFontFamily = defineModel<string>('themeFontFamily');
const themeHeadingFontSizeScale = defineModel<number>(
  'themeHeadingFontSizeScale',
);
const themeSidebarMenuFontSizeScale = defineModel<number>(
  'themeSidebarMenuFontSizeScale',
);
const themeHeaderMenuFontSizeScale = defineModel<number>(
  'themeHeaderMenuFontSizeScale',
);
const themeTabbarFontSizeScale = defineModel<number>(
  'themeTabbarFontSizeScale',
);
const themeBreadcrumbFontSizeScale = defineModel<number>(
  'themeBreadcrumbFontSizeScale',
);
const themeFooterFontSizeScale = defineModel<number>(
  'themeFooterFontSizeScale',
);
const themeSemiDarkSidebar = defineModel<boolean>('themeSemiDarkSidebar');
const themeSemiDarkSidebarColor = defineModel<string>(
  'themeSemiDarkSidebarColor',
);
const themeSemiDarkSidebarColorTransparency = defineModel<number>(
  'themeSemiDarkSidebarColorTransparency',
);
const themeSemiDarkSidebarSub = defineModel<boolean>('themeSemiDarkSidebarSub');
const themeSemiDarkHeader = defineModel<boolean>('themeSemiDarkHeader');
const themeSemiDarkHeaderColor = defineModel<string>(
  'themeSemiDarkHeaderColor',
);
const themeSemiDarkHeaderColorTransparency = defineModel<number>(
  'themeSemiDarkHeaderColorTransparency',
);
const themeHeaderMenuThemeColor = defineModel<string>(
  'themeHeaderMenuThemeColor',
);
const themeHeaderMenuThemeColorCustom = defineModel<boolean>(
  'themeHeaderMenuThemeColorCustom',
);
const themeHeaderMenuBackgroundColor = defineModel<string>(
  'themeHeaderMenuBackgroundColor',
);
const themeHeaderMenuBackgroundColorCustom = defineModel<boolean>(
  'themeHeaderMenuBackgroundColorCustom',
);
const themeHeaderMenuBackgroundColorTransparency = defineModel<number>(
  'themeHeaderMenuBackgroundColorTransparency',
);
const themeSidebarMenuBackgroundColor = defineModel<string>(
  'themeSidebarMenuBackgroundColor',
);
const themeSidebarMenuBackgroundColorCustom = defineModel<boolean>(
  'themeSidebarMenuBackgroundColorCustom',
);
const themeSidebarMenuBackgroundColorTransparency = defineModel<number>(
  'themeSidebarMenuBackgroundColorTransparency',
);

const sidebarEnable = defineModel<boolean>('sidebarEnable');
const sidebarWidth = defineModel<number>('sidebarWidth');
const sidebarMixedMenuGap = defineModel<number>('sidebarMixedMenuGap');
const sidebarMenuItemGap = defineModel<number>('sidebarMenuItemGap');
const sidebarCollapsed = defineModel<boolean>('sidebarCollapsed');
const sidebarCollapsedShowTitle = defineModel<boolean>(
  'sidebarCollapsedShowTitle',
);
const sidebarAutoActivateChild = defineModel<boolean>(
  'sidebarAutoActivateChild',
);
const sidebarExpandOnHover = defineModel<boolean>('sidebarExpandOnHover');
const sidebarCollapsedButton = defineModel<boolean>('sidebarCollapsedButton');
const sidebarFixedButton = defineModel<boolean>('sidebarFixedButton');
const sidebarMarginTop = defineModel<number>('sidebarMarginTop');
const sidebarMarginRight = defineModel<number>('sidebarMarginRight');
const sidebarMarginBottom = defineModel<number>('sidebarMarginBottom');
const sidebarMarginLeft = defineModel<number>('sidebarMarginLeft');
const sidebarRadiusTopLeft = defineModel<number>('sidebarRadiusTopLeft');
const sidebarRadiusTopRight = defineModel<number>('sidebarRadiusTopRight');
const sidebarRadiusBottomRight = defineModel<number>(
  'sidebarRadiusBottomRight',
);
const sidebarRadiusBottomLeft = defineModel<number>('sidebarRadiusBottomLeft');
const sidebarBorderTopWidth = defineModel<number>('sidebarBorderTopWidth');
const sidebarBorderRightWidth = defineModel<number>('sidebarBorderRightWidth');
const sidebarBorderBottomWidth = defineModel<number>(
  'sidebarBorderBottomWidth',
);
const sidebarBorderLeftWidth = defineModel<number>('sidebarBorderLeftWidth');
const headerEnable = defineModel<boolean>('headerEnable');
const headerHeight = defineModel<number>('headerHeight');
const headerMarginTop = defineModel<number>('headerMarginTop');
const headerMarginRight = defineModel<number>('headerMarginRight');
const headerMarginBottom = defineModel<number>('headerMarginBottom');
const headerMarginLeft = defineModel<number>('headerMarginLeft');
const headerRadiusTopLeft = defineModel<number>('headerRadiusTopLeft');
const headerRadiusTopRight = defineModel<number>('headerRadiusTopRight');
const headerRadiusBottomRight = defineModel<number>('headerRadiusBottomRight');
const headerRadiusBottomLeft = defineModel<number>('headerRadiusBottomLeft');
const headerBorderTopWidth = defineModel<number>('headerBorderTopWidth');
const headerBorderRightWidth = defineModel<number>('headerBorderRightWidth');
const headerBorderBottomWidth = defineModel<number>('headerBorderBottomWidth');
const headerBorderLeftWidth = defineModel<number>('headerBorderLeftWidth');
const headerMode = defineModel<LayoutHeaderModeType>('headerMode');
const headerMenuAlign =
  defineModel<LayoutHeaderMenuAlignType>('headerMenuAlign');

const breadcrumbEnable = defineModel<boolean>('breadcrumbEnable');
const breadcrumbShowIcon = defineModel<boolean>('breadcrumbShowIcon');
const breadcrumbShowHome = defineModel<boolean>('breadcrumbShowHome');
const breadcrumbStyleType = defineModel<BreadcrumbStyleType>(
  'breadcrumbStyleType',
);
const breadcrumbHideOnlyOne = defineModel<boolean>('breadcrumbHideOnlyOne');

const tabbarEnable = defineModel<boolean>('tabbarEnable');
const tabbarHeight = defineModel<number>('tabbarHeight');
const tabbarBackgroundColor = defineModel<string>('tabbarBackgroundColor');
const tabbarBackgroundColorCustom = defineModel<boolean>(
  'tabbarBackgroundColorCustom',
);
const tabbarBackgroundTransparency = defineModel<number>(
  'tabbarBackgroundTransparency',
);
const tabbarMarginTop = defineModel<number>('tabbarMarginTop');
const tabbarMarginRight = defineModel<number>('tabbarMarginRight');
const tabbarMarginBottom = defineModel<number>('tabbarMarginBottom');
const tabbarMarginLeft = defineModel<number>('tabbarMarginLeft');
const tabbarRadiusTopLeft = defineModel<number>('tabbarRadiusTopLeft');
const tabbarRadiusTopRight = defineModel<number>('tabbarRadiusTopRight');
const tabbarRadiusBottomRight = defineModel<number>('tabbarRadiusBottomRight');
const tabbarRadiusBottomLeft = defineModel<number>('tabbarRadiusBottomLeft');
const tabbarBorderTopWidth = defineModel<number>('tabbarBorderTopWidth');
const tabbarBorderRightWidth = defineModel<number>('tabbarBorderRightWidth');
const tabbarBorderBottomWidth = defineModel<number>('tabbarBorderBottomWidth');
const tabbarBorderLeftWidth = defineModel<number>('tabbarBorderLeftWidth');
const tabbarShowIcon = defineModel<boolean>('tabbarShowIcon');
const tabbarShowMore = defineModel<boolean>('tabbarShowMore');
const tabbarShowMaximize = defineModel<boolean>('tabbarShowMaximize');
const tabbarPersist = defineModel<boolean>('tabbarPersist');
const tabbarVisitHistory = defineModel<boolean>('tabbarVisitHistory');
const tabbarDraggable = defineModel<boolean>('tabbarDraggable');
const tabbarWheelable = defineModel<boolean>('tabbarWheelable');
const tabbarStyleType = defineModel<string>('tabbarStyleType');
const tabbarMaxCount = defineModel<number>('tabbarMaxCount');
const tabbarMiddleClickToClose = defineModel<boolean>(
  'tabbarMiddleClickToClose',
);

const navigationStyleType = defineModel<NavigationStyleType>(
  'navigationStyleType',
);
const navigationSplit = defineModel<boolean>('navigationSplit');
const navigationAccordion = defineModel<boolean>('navigationAccordion');

// const logoVisible = defineModel<boolean>('logoVisible');

const footerEnable = defineModel<boolean>('footerEnable');
const footerFixed = defineModel<boolean>('footerFixed');
const footerHeight = defineModel<number>('footerHeight');
const footerMarginTop = defineModel<number>('footerMarginTop');
const footerMarginRight = defineModel<number>('footerMarginRight');
const footerMarginBottom = defineModel<number>('footerMarginBottom');
const footerMarginLeft = defineModel<number>('footerMarginLeft');
const footerRadiusTopLeft = defineModel<number>('footerRadiusTopLeft');
const footerRadiusTopRight = defineModel<number>('footerRadiusTopRight');
const footerRadiusBottomRight = defineModel<number>('footerRadiusBottomRight');
const footerRadiusBottomLeft = defineModel<number>('footerRadiusBottomLeft');
const footerBackgroundColor = defineModel<string>('footerBackgroundColor');
const footerBackgroundColorCustom = defineModel<boolean>(
  'footerBackgroundColorCustom',
);
const footerBackgroundTransparency = defineModel<number>(
  'footerBackgroundTransparency',
);

const shortcutKeysEnable = defineModel<boolean>('shortcutKeysEnable');
const shortcutKeysGlobalSearch = defineModel<boolean>(
  'shortcutKeysGlobalSearch',
);
const shortcutKeysGlobalLogout = defineModel<boolean>(
  'shortcutKeysGlobalLogout',
);

const shortcutKeysGlobalLockScreen = defineModel<boolean>(
  'shortcutKeysGlobalLockScreen',
);

const widgetGlobalSearch = defineModel<boolean>('widgetGlobalSearch');
const widgetFullscreen = defineModel<boolean>('widgetFullscreen');
const widgetLanguageToggle = defineModel<boolean>('widgetLanguageToggle');
const widgetNotification = defineModel<boolean>('widgetNotification');
const widgetThemeToggle = defineModel<boolean>('widgetThemeToggle');
const widgetSidebarToggle = defineModel<boolean>('widgetSidebarToggle');
const widgetLockScreen = defineModel<boolean>('widgetLockScreen');
const widgetRefresh = defineModel<boolean>('widgetRefresh');

const {
  diffPreference,
  isDark,
  isFullContent,
  isHeaderNav,
  isHeaderSidebarNav,
  isMixedNav,
  isSideMixedNav,
  isSideMode,
  isSideNav,
} = usePreferences();
const { copy } = useClipboard({ legacy: true });

const [Drawer] = useVbenDrawer();

const activeTab = ref('appearance');
const colorSettingsRef = ref<InstanceType<typeof ColorSettings>>();
const watermarkColorSettingsRef = ref<InstanceType<typeof ColorSettings>>();

const tabs = computed((): SegmentedItem[] => {
  return [
    {
      label: $t('preferences.appearance'),
      value: 'appearance',
    },
    {
      label: $t('preferences.layout'),
      value: 'layout',
    },
    {
      label: $t('preferences.shortcutKeys.title'),
      value: 'shortcutKey',
    },
    {
      label: $t('preferences.general'),
      value: 'general',
    },
  ];
});

const showBreadcrumbConfig = computed(() => {
  return (
    !isFullContent.value &&
    !isMixedNav.value &&
    !isHeaderNav.value &&
    preferences.header.enable
  );
});

async function handleCopy() {
  await copy(JSON.stringify(diffPreference.value, null, 2));

  message.copyPreferencesSuccess?.(
    $t('preferences.copyPreferencesSuccessTitle'),
    $t('preferences.copyPreferencesSuccess'),
  );
}

async function handleClearCacheAndRestoreDefaults() {
  clearCache();
  resetPreferences();
  await loadLocaleMessages(preferences.app.locale);
}

async function handleReset() {
  if (!diffPreference.value) {
    return;
  }
  resetPreferences();
  await loadLocaleMessages(preferences.app.locale);
}

function openColorSettings(
  target:
    | 'baseBackground'
    | 'contentBackground'
    | 'footerBackground'
    | 'header'
    | 'headerMenuBackground'
    | 'headerMenuTheme'
    | 'menuBackground'
    | 'primary'
    | 'sidebar'
    | 'tabbarBackground'
    | 'watermark',
) {
  if (target === 'watermark') {
    watermarkColorSettingsRef.value?.open(target);
    return;
  }

  colorSettingsRef.value?.open(target);
}
</script>

<template>
  <div>
    <Drawer
      :description="$t('preferences.subtitle')"
      :title="$t('preferences.title')"
      class="!border-0 sm:max-w-[400px]"
    >
      <template #extra>
        <div class="flex items-center">
          <VbenIconButton
            :disabled="!diffPreference"
            :tooltip="$t('preferences.resetTip')"
            class="relative"
            @click="handleReset"
          >
            <span
              v-if="diffPreference"
              class="bg-primary absolute right-0.5 top-0.5 h-2 w-2 rounded"
            ></span>
            <RotateCw class="size-4" />
          </VbenIconButton>
          <VbenIconButton
            :tooltip="
              appEnableStickyPreferencesNavigationBar
                ? $t('preferences.disableStickyPreferencesNavigationBar')
                : $t('preferences.enableStickyPreferencesNavigationBar')
            "
            class="relative"
            @click="
              () =>
                (appEnableStickyPreferencesNavigationBar =
                  !appEnableStickyPreferencesNavigationBar)
            "
          >
            <PinOff
              v-if="appEnableStickyPreferencesNavigationBar"
              class="size-4"
            />
            <Pin v-else class="size-4" />
          </VbenIconButton>
        </div>
      </template>

      <div>
        <VbenSegmented
          v-model="activeTab"
          :tabs="tabs"
          :class="{
            'sticky-tabs-header': appEnableStickyPreferencesNavigationBar,
          }"
        >
          <template #general>
            <Block :title="$t('preferences.general')">
              <General
                v-model:app-dynamic-title="appDynamicTitle"
                v-model:app-enable-check-updates="appEnableCheckUpdates"
                v-model:app-locale="appLocale"
                v-model:app-watermark="appWatermark"
                v-model:app-watermark-color="appWatermarkColor"
                v-model:app-watermark-color-custom="appWatermarkColorCustom"
                v-model:app-watermark-content="appWatermarkContent"
                @open-color-settings="openColorSettings"
              />
            </Block>

            <Block :title="$t('preferences.animation.title')">
              <Animation
                v-model:transition-enable="transitionEnable"
                v-model:transition-loading="transitionLoading"
                v-model:transition-name="transitionName"
                v-model:transition-progress="transitionProgress"
              />
            </Block>
          </template>
          <template #appearance>
            <Block :title="$t('preferences.theme.title')">
              <Theme
                v-model="themeMode"
                v-model:theme-base-background-color="themeBaseBackgroundColor"
                v-model:theme-base-background-color-custom="
                  themeBaseBackgroundColorCustom
                "
                v-model:theme-content-background-color="
                  themeContentBackgroundColor
                "
                v-model:theme-content-background-color-custom="
                  themeContentBackgroundColorCustom
                "
                v-model:tabbar-background-color="tabbarBackgroundColor"
                v-model:tabbar-background-color-custom="
                  tabbarBackgroundColorCustom
                "
                v-model:footer-background-color="footerBackgroundColor"
                v-model:footer-background-color-custom="
                  footerBackgroundColorCustom
                "
                v-model:theme-semi-dark-header="themeSemiDarkHeader"
                v-model:theme-semi-dark-header-color="themeSemiDarkHeaderColor"
                v-model:theme-header-menu-theme-color="
                  themeHeaderMenuThemeColor
                "
                v-model:theme-header-menu-theme-color-custom="
                  themeHeaderMenuThemeColorCustom
                "
                v-model:theme-header-menu-background-color="
                  themeHeaderMenuBackgroundColor
                "
                v-model:theme-header-menu-background-color-custom="
                  themeHeaderMenuBackgroundColorCustom
                "
                v-model:theme-semi-dark-sidebar="themeSemiDarkSidebar"
                v-model:theme-semi-dark-sidebar-color="
                  themeSemiDarkSidebarColor
                "
                v-model:theme-semi-dark-sidebar-sub="themeSemiDarkSidebarSub"
                v-model:theme-sidebar-menu-background-color="
                  themeSidebarMenuBackgroundColor
                "
                v-model:theme-sidebar-menu-background-color-custom="
                  themeSidebarMenuBackgroundColorCustom
                "
                @open-color-settings="openColorSettings"
              />
            </Block>
            <Block :title="$t('preferences.theme.themeColor')">
              <ColorSettings
                ref="colorSettingsRef"
                v-model="themeBuiltinType"
                v-model:footer-background-color="footerBackgroundColor"
                v-model:footer-background-transparency="
                  footerBackgroundTransparency
                "
                v-model:tabbar-background-color="tabbarBackgroundColor"
                v-model:tabbar-background-transparency="
                  tabbarBackgroundTransparency
                "
                v-model:theme-base-background-color="themeBaseBackgroundColor"
                v-model:theme-base-background-transparency="
                  themeBaseBackgroundTransparency
                "
                v-model:theme-color-destructive="themeColorDestructive"
                v-model:theme-color-primary="themeColorPrimary"
                v-model:theme-color-success="themeColorSuccess"
                v-model:theme-color-warning="themeColorWarning"
                v-model:theme-content-background-color="
                  themeContentBackgroundColor
                "
                v-model:theme-content-background-transparency="
                  themeContentBackgroundTransparency
                "
                v-model:theme-header-menu-background-color="
                  themeHeaderMenuBackgroundColor
                "
                v-model:theme-header-menu-background-color-transparency="
                  themeHeaderMenuBackgroundColorTransparency
                "
                v-model:theme-header-menu-theme-color="
                  themeHeaderMenuThemeColor
                "
                v-model:theme-semi-dark-header-color="themeSemiDarkHeaderColor"
                v-model:theme-semi-dark-header-color-transparency="
                  themeSemiDarkHeaderColorTransparency
                "
                v-model:theme-semi-dark-sidebar-color="
                  themeSemiDarkSidebarColor
                "
                v-model:theme-semi-dark-sidebar-color-transparency="
                  themeSemiDarkSidebarColorTransparency
                "
                v-model:theme-sidebar-menu-background-color="
                  themeSidebarMenuBackgroundColor
                "
                v-model:theme-sidebar-menu-background-color-transparency="
                  themeSidebarMenuBackgroundColorTransparency
                "
                :is-dark="isDark"
              />
            </Block>
            <Block :title="$t('preferences.theme.radius')">
              <Radius v-model="themeRadius" />
            </Block>
            <Block :title="$t('preferences.theme.fontSize')">
              <FontSize v-model="themeFontSize" />
            </Block>
            <Block :title="$t('preferences.theme.fontFamily')">
              <input
                v-model="themeFontFamily"
                class="border-border h-10 w-full rounded border px-3"
                :placeholder="$t('preferences.theme.fontFamilyTip')"
              />
            </Block>
            <Block :title="$t('preferences.theme.fontSizeScale')">
              <div class="grid grid-cols-3 gap-3">
                <label class="space-y-1">
                  <span class="text-muted-foreground block text-xs">{{
                    $t('preferences.theme.headingFontSizeScale')
                  }}</span>
                  <FontScale v-model="themeHeadingFontSizeScale" />
                </label>
                <label class="space-y-1">
                  <span class="text-muted-foreground block text-xs">{{
                    $t('preferences.theme.sidebarMenuFontSizeScale')
                  }}</span>
                  <FontScale v-model="themeSidebarMenuFontSizeScale" />
                </label>
                <label class="space-y-1">
                  <span class="text-muted-foreground block text-xs">{{
                    $t('preferences.theme.headerMenuFontSizeScale')
                  }}</span>
                  <FontScale v-model="themeHeaderMenuFontSizeScale" />
                </label>
                <label class="space-y-1">
                  <span class="text-muted-foreground block text-xs">{{
                    $t('preferences.theme.tabbarFontSizeScale')
                  }}</span>
                  <FontScale v-model="themeTabbarFontSizeScale" />
                </label>
                <label class="space-y-1">
                  <span class="text-muted-foreground block text-xs">{{
                    $t('preferences.theme.breadcrumbFontSizeScale')
                  }}</span>
                  <FontScale v-model="themeBreadcrumbFontSizeScale" />
                </label>
                <label class="space-y-1">
                  <span class="text-muted-foreground block text-xs">{{
                    $t('preferences.theme.footerFontSizeScale')
                  }}</span>
                  <FontScale v-model="themeFooterFontSizeScale" />
                </label>
              </div>
              <div class="text-muted-foreground mt-3 text-xs">
                {{ $t('preferences.theme.fontSizeScaleTip') }}
              </div>
            </Block>
            <Block :title="$t('preferences.other')">
              <ColorMode
                v-model:app-color-gray-mode="appColorGrayMode"
                v-model:app-color-weak-mode="appColorWeakMode"
              />
            </Block>
          </template>
          <template #layout>
            <Block :title="$t('preferences.layout')">
              <Layout v-model="appLayout" />
            </Block>
            <Block :title="$t('preferences.content')">
              <Content
                v-model="appContentCompact"
                v-model:content-border-bottom-width="
                  appContentBorderBottomWidth
                "
                v-model:content-border-left-width="appContentBorderLeftWidth"
                v-model:content-border-right-width="appContentBorderRightWidth"
                v-model:content-border-top-width="appContentBorderTopWidth"
                v-model:content-margin-bottom="appContentMarginBottom"
                v-model:content-margin-left="appContentMarginLeft"
                v-model:content-margin-right="appContentMarginRight"
                v-model:content-margin-top="appContentMarginTop"
                v-model:content-radius-top-left="appContentRadiusTopLeft"
                v-model:content-radius-top-right="appContentRadiusTopRight"
                v-model:content-radius-bottom-right="
                  appContentRadiusBottomRight
                "
                v-model:content-radius-bottom-left="appContentRadiusBottomLeft"
              />
            </Block>

            <Block :title="$t('preferences.sidebar.title')">
              <Sidebar
                v-model:sidebar-auto-activate-child="sidebarAutoActivateChild"
                v-model:sidebar-collapsed="sidebarCollapsed"
                v-model:sidebar-collapsed-show-title="sidebarCollapsedShowTitle"
                v-model:sidebar-enable="sidebarEnable"
                v-model:sidebar-expand-on-hover="sidebarExpandOnHover"
                v-model:sidebar-width="sidebarWidth"
                v-model:sidebar-mixed-menu-gap="sidebarMixedMenuGap"
                v-model:sidebar-menu-item-gap="sidebarMenuItemGap"
                v-model:sidebar-collapsed-button="sidebarCollapsedButton"
                v-model:sidebar-fixed-button="sidebarFixedButton"
                v-model:sidebar-margin-top="sidebarMarginTop"
                v-model:sidebar-margin-right="sidebarMarginRight"
                v-model:sidebar-margin-bottom="sidebarMarginBottom"
                v-model:sidebar-margin-left="sidebarMarginLeft"
                v-model:sidebar-radius-top-left="sidebarRadiusTopLeft"
                v-model:sidebar-radius-top-right="sidebarRadiusTopRight"
                v-model:sidebar-radius-bottom-right="sidebarRadiusBottomRight"
                v-model:sidebar-radius-bottom-left="sidebarRadiusBottomLeft"
                v-model:sidebar-border-top-width="sidebarBorderTopWidth"
                v-model:sidebar-border-right-width="sidebarBorderRightWidth"
                v-model:sidebar-border-bottom-width="sidebarBorderBottomWidth"
                v-model:sidebar-border-left-width="sidebarBorderLeftWidth"
                :current-layout="appLayout"
                :disabled="!isSideMode"
              />
            </Block>

            <Block :title="$t('preferences.header.title')">
              <Header
                v-model:header-enable="headerEnable"
                v-model:header-height="headerHeight"
                v-model:header-menu-align="headerMenuAlign"
                v-model:header-mode="headerMode"
                v-model:header-margin-top="headerMarginTop"
                v-model:header-margin-right="headerMarginRight"
                v-model:header-margin-bottom="headerMarginBottom"
                v-model:header-margin-left="headerMarginLeft"
                v-model:header-radius-top-left="headerRadiusTopLeft"
                v-model:header-radius-top-right="headerRadiusTopRight"
                v-model:header-radius-bottom-right="headerRadiusBottomRight"
                v-model:header-radius-bottom-left="headerRadiusBottomLeft"
                v-model:header-border-top-width="headerBorderTopWidth"
                v-model:header-border-right-width="headerBorderRightWidth"
                v-model:header-border-bottom-width="headerBorderBottomWidth"
                v-model:header-border-left-width="headerBorderLeftWidth"
                :disabled="isFullContent"
              />
            </Block>

            <Block :title="$t('preferences.navigationMenu.title')">
              <Navigation
                v-model:navigation-accordion="navigationAccordion"
                v-model:navigation-split="navigationSplit"
                v-model:navigation-style-type="navigationStyleType"
                v-model:tabbar-enable="tabbarEnable"
                :disabled="isFullContent"
                :disabled-navigation-split="!isMixedNav"
              />
            </Block>

            <Block :title="$t('preferences.breadcrumb.title')">
              <Breadcrumb
                v-model:breadcrumb-enable="breadcrumbEnable"
                v-model:breadcrumb-hide-only-one="breadcrumbHideOnlyOne"
                v-model:breadcrumb-show-home="breadcrumbShowHome"
                v-model:breadcrumb-show-icon="breadcrumbShowIcon"
                v-model:breadcrumb-style-type="breadcrumbStyleType"
                :disabled="
                  !showBreadcrumbConfig ||
                  !(isSideNav || isSideMixedNav || isHeaderSidebarNav)
                "
              />
            </Block>
            <Block :title="$t('preferences.tabbar.title')">
              <Tabbar
                v-model:tabbar-height="tabbarHeight"
                v-model:tabbar-margin-top="tabbarMarginTop"
                v-model:tabbar-margin-right="tabbarMarginRight"
                v-model:tabbar-margin-bottom="tabbarMarginBottom"
                v-model:tabbar-margin-left="tabbarMarginLeft"
                v-model:tabbar-radius-top-left="tabbarRadiusTopLeft"
                v-model:tabbar-radius-top-right="tabbarRadiusTopRight"
                v-model:tabbar-radius-bottom-right="tabbarRadiusBottomRight"
                v-model:tabbar-radius-bottom-left="tabbarRadiusBottomLeft"
                v-model:tabbar-border-top-width="tabbarBorderTopWidth"
                v-model:tabbar-border-right-width="tabbarBorderRightWidth"
                v-model:tabbar-border-bottom-width="tabbarBorderBottomWidth"
                v-model:tabbar-border-left-width="tabbarBorderLeftWidth"
                v-model:tabbar-draggable="tabbarDraggable"
                v-model:tabbar-enable="tabbarEnable"
                v-model:tabbar-persist="tabbarPersist"
                v-model:tabbar-visit-history="tabbarVisitHistory"
                v-model:tabbar-show-icon="tabbarShowIcon"
                v-model:tabbar-show-maximize="tabbarShowMaximize"
                v-model:tabbar-show-more="tabbarShowMore"
                v-model:tabbar-style-type="tabbarStyleType"
                v-model:tabbar-wheelable="tabbarWheelable"
                v-model:tabbar-max-count="tabbarMaxCount"
                v-model:tabbar-middle-click-to-close="tabbarMiddleClickToClose"
              />
            </Block>
            <Block :title="$t('preferences.widget.title')">
              <Widget
                v-model:app-preferences-button-position="
                  appPreferencesButtonPosition
                "
                v-model:widget-fullscreen="widgetFullscreen"
                v-model:widget-global-search="widgetGlobalSearch"
                v-model:widget-language-toggle="widgetLanguageToggle"
                v-model:widget-lock-screen="widgetLockScreen"
                v-model:widget-notification="widgetNotification"
                v-model:widget-refresh="widgetRefresh"
                v-model:widget-sidebar-toggle="widgetSidebarToggle"
                v-model:widget-theme-toggle="widgetThemeToggle"
              />
            </Block>
            <Block :title="$t('preferences.footer.title')">
              <Footer
                v-model:footer-height="footerHeight"
                v-model:footer-margin-top="footerMarginTop"
                v-model:footer-margin-right="footerMarginRight"
                v-model:footer-margin-bottom="footerMarginBottom"
                v-model:footer-margin-left="footerMarginLeft"
                v-model:footer-radius-top-left="footerRadiusTopLeft"
                v-model:footer-radius-top-right="footerRadiusTopRight"
                v-model:footer-radius-bottom-right="footerRadiusBottomRight"
                v-model:footer-radius-bottom-left="footerRadiusBottomLeft"
                v-model:footer-background-color="footerBackgroundColor"
                v-model:footer-background-color-custom="
                  footerBackgroundColorCustom
                "
                v-model:footer-enable="footerEnable"
                v-model:footer-fixed="footerFixed"
              />
            </Block>
          </template>

          <template #shortcutKey>
            <Block :title="$t('preferences.shortcutKeys.global')">
              <GlobalShortcutKeys
                v-model:shortcut-keys-enable="shortcutKeysEnable"
                v-model:shortcut-keys-global-search="shortcutKeysGlobalSearch"
                v-model:shortcut-keys-lock-screen="shortcutKeysGlobalLockScreen"
                v-model:shortcut-keys-logout="shortcutKeysGlobalLogout"
              />
            </Block>
          </template>
        </VbenSegmented>
        <ColorSettings
          ref="watermarkColorSettingsRef"
          v-model:app-watermark-color="appWatermarkColor"
          v-model:app-watermark-transparency="appWatermarkTransparency"
          hide-entries
          :is-dark="isDark"
        />
      </div>

      <template #footer>
        <VbenButton
          :disabled="!diffPreference"
          class="mx-4 w-full"
          size="sm"
          variant="default"
          @click="handleCopy"
        >
          <Copy class="mr-2 size-3" />
          {{ $t('preferences.copyPreferences') }}
        </VbenButton>
        <VbenButton
          class="mr-4 w-full"
          size="sm"
          variant="ghost"
          @click="handleClearCacheAndRestoreDefaults"
        >
          {{ $t('preferences.clearCacheAndRestoreDefaults') }}
        </VbenButton>
      </template>
    </Drawer>
  </div>
</template>

<style scoped>
:deep(.sticky-tabs-header [role='tablist']) {
  position: sticky;
  top: -12px;
  z-index: 9999;
}
</style>
