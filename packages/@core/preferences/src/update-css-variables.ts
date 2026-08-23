import type { Preferences } from './types';

import {
  brightenColor,
  convertToHslCssVar,
  generatorColorVariables,
} from '@vben-core/shared/color';
import { updateCSSVariables as executeUpdateCSSVariables } from '@vben-core/shared/utils';

import { resolveBackgroundColor } from './background-color';
import { BUILT_IN_THEME_PRESETS } from './constants';

/**
 * 更新主题的 CSS 变量以及其他 CSS 变量
 * @param preferences - 当前偏好设置对象，它的主题值将被用来设置文档的主题。
 */
function updateCSSVariables(preferences: Preferences) {
  // 当修改到颜色变量时，更新 css 变量
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const theme = preferences?.theme ?? {};

  const { builtinType, mode, radius } = theme;

  // html 设置 dark 类
  if (Reflect.has(theme, 'mode')) {
    const dark = isDarkTheme(mode);
    root.classList.toggle('dark', dark);
  }

  // html 设置 data-theme=[builtinType]
  if (Reflect.has(theme, 'builtinType')) {
    const rootTheme = root.dataset.theme;
    if (rootTheme !== builtinType) {
      root.dataset.theme = builtinType;
    }
  }

  // 获取当前的内置主题
  const currentBuiltType = [...BUILT_IN_THEME_PRESETS].find(
    (item) => item.type === builtinType,
  );

  let builtinTypeColorPrimary: string | undefined = '';

  if (currentBuiltType) {
    const isDark = isDarkTheme(preferences.theme.mode);
    // 设置不同主题的主要颜色
    const color = isDark
      ? currentBuiltType.darkPrimaryColor || currentBuiltType.primaryColor
      : currentBuiltType.primaryColor;
    builtinTypeColorPrimary = color || currentBuiltType.color;
  }

  // 如果内置主题颜色和自定义颜色都不存在，则不更新主题颜色
  if (
    builtinTypeColorPrimary ||
    Reflect.has(theme, 'colorPrimary') ||
    Reflect.has(theme, 'colorDestructive') ||
    Reflect.has(theme, 'colorSuccess') ||
    Reflect.has(theme, 'colorWarning')
  ) {
    // preferences.theme.colorPrimary = builtinTypeColorPrimary || colorPrimary;
    updateMainColorVariables(preferences);
  }

  // 更新圆角
  if (Reflect.has(theme, 'radius')) {
    document.documentElement.style.setProperty('--radius', `${radius}rem`);
  }

  // 更新字体大小
  if (Reflect.has(theme, 'fontSize')) {
    const fontSize = theme.fontSize;
    const headingFontSizeScale = theme.headingFontSizeScale ?? 1.25;
    const sidebarMenuFontSizeScale = theme.sidebarMenuFontSizeScale ?? 0.875;
    const headerMenuFontSizeScale = theme.headerMenuFontSizeScale ?? 0.875;
    const tabbarFontSizeScale = theme.tabbarFontSizeScale ?? 0.875;
    const breadcrumbFontSizeScale = theme.breadcrumbFontSizeScale ?? 0.875;
    const footerFontSizeScale = theme.footerFontSizeScale ?? 0.875;

    document.documentElement.style.setProperty(
      '--font-size-base',
      `${fontSize}px`,
    );
    document.documentElement.style.setProperty(
      '--font-size-heading',
      `calc(${fontSize}px * ${headingFontSizeScale})`,
    );
    document.documentElement.style.setProperty(
      '--font-size-sidebar-menu',
      `calc(${fontSize}px * ${sidebarMenuFontSizeScale})`,
    );
    document.documentElement.style.setProperty(
      '--font-size-header-menu',
      `calc(${fontSize}px * ${headerMenuFontSizeScale})`,
    );
    document.documentElement.style.setProperty(
      '--font-size-tabbar',
      `calc(${fontSize}px * ${tabbarFontSizeScale})`,
    );
    document.documentElement.style.setProperty(
      '--font-size-breadcrumb',
      `calc(${fontSize}px * ${breadcrumbFontSizeScale})`,
    );
    document.documentElement.style.setProperty(
      '--font-size-footer',
      `calc(${fontSize}px * ${footerFontSizeScale})`,
    );
    document.documentElement.style.setProperty(
      '--menu-font-size',
      'var(--font-size-sidebar-menu)',
    );
  }

  if (Reflect.has(theme, 'fontFamily')) {
    root.style.setProperty('--font-family-custom', theme.fontFamily || 'inherit');
  }

  updateHeaderMenuThemeVariables(preferences);
  updateFooterBackgroundVariable(preferences);
}

function updateFooterBackgroundVariable(preferences: Preferences) {
  const root = document.documentElement;
  const footer = preferences.footer;

  root.style.setProperty('--footer-margin-top', `${footer.marginTop}px`);
  root.style.setProperty('--footer-margin-right', `${footer.marginRight}px`);
  root.style.setProperty('--footer-margin-bottom', `${footer.marginBottom}px`);
  root.style.setProperty('--footer-margin-left', `${footer.marginLeft}px`);
  root.style.setProperty(
    '--footer-radius-top-left',
    `${footer.radiusTopLeft}px`,
  );
  root.style.setProperty(
    '--footer-radius-top-right',
    `${footer.radiusTopRight}px`,
  );
  root.style.setProperty(
    '--footer-radius-bottom-right',
    `${footer.radiusBottomRight}px`,
  );
  root.style.setProperty(
    '--footer-radius-bottom-left',
    `${footer.radiusBottomLeft}px`,
  );

  if (!footer.backgroundColorCustom) {
    root.style.removeProperty('--footer-background');
    return;
  }

  root.style.setProperty(
    '--footer-background',
    resolveBackgroundColor(
      footer.backgroundColor,
      footer.backgroundTransparency,
    ),
  );
}

/**
 * 将顶栏交互主题与下拉面板背景放在根节点，保证 teleport 到 body 的通知和下拉菜单也能使用同一来源。
 */
function updateHeaderMenuThemeVariables(preferences: Preferences) {
  const root = document.documentElement;
  const theme = preferences.theme;

  if (isDarkTheme(theme.mode) || !theme.semiDarkHeader) {
    root.style.removeProperty('--header-menu-background');
    root.style.removeProperty('--header-menu-theme-color');
    return;
  }

  let menuBackgroundColor: string;
  if (theme.headerMenuBackgroundColorCustom) {
    menuBackgroundColor = resolveBackgroundColor(
      theme.headerMenuBackgroundColor,
      theme.headerMenuBackgroundColorTransparency,
    );
  } else if (theme.sidebarMenuBackgroundColorCustom) {
    menuBackgroundColor = resolveBackgroundColor(
      theme.sidebarMenuBackgroundColor,
      theme.sidebarMenuBackgroundColorTransparency,
    );
  } else {
    menuBackgroundColor = resolveBackgroundColor(
      theme.semiDarkSidebarColor,
      theme.semiDarkSidebarColorTransparency,
    );
  }

  root.style.setProperty(
    '--header-menu-background',
    convertToHslCssVar(menuBackgroundColor),
  );

  let headerThemeColor: string;
  if (theme.headerMenuThemeColorCustom) {
    headerThemeColor = theme.headerMenuThemeColor;
  } else if (theme.baseBackgroundColorCustom) {
    headerThemeColor = theme.baseBackgroundColor;
  } else {
    headerThemeColor = brightenColor(theme.semiDarkHeaderColor, 40);
  }

  root.style.setProperty(
    '--header-menu-theme-color',
    convertToHslCssVar(headerThemeColor),
  );
}

/**
 * 更新主要的 CSS 变量
 * @param  preference - 当前偏好设置对象，它的颜色值将被转换成 HSL 格式并设置为 CSS 变量。
 */
function updateMainColorVariables(preference: Preferences) {
  if (!preference.theme) {
    return;
  }
  const { colorDestructive, colorPrimary, colorSuccess, colorWarning } =
    preference.theme;

  const colorVariables = generatorColorVariables([
    { color: colorPrimary, name: 'primary' },
    { alias: 'warning', color: colorWarning, name: 'yellow' },
    { alias: 'success', color: colorSuccess, name: 'green' },
    { alias: 'destructive', color: colorDestructive, name: 'red' },
  ]);

  // 要设置的 CSS 变量映射
  const colorMappings = {
    '--green-500': '--success',
    '--primary-500': '--primary',
    '--red-500': '--destructive',
    '--yellow-500': '--warning',
  };

  // 统一处理颜色变量的更新
  Object.entries(colorMappings).forEach(([sourceVar, targetVar]) => {
    const colorValue = colorVariables[sourceVar];
    if (colorValue) {
      document.documentElement.style.setProperty(targetVar, colorValue);
    }
  });

  executeUpdateCSSVariables(colorVariables);
}

function isDarkTheme(theme: string) {
  let dark = theme === 'dark';
  if (theme === 'auto') {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return dark;
}

export { isDarkTheme, updateCSSVariables };
