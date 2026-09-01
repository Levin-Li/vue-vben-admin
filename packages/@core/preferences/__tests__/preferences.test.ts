import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  function createMemoryStorage(): Storage {
    const storage = new Map<string, string>();

    return {
      get length() {
        return storage.size;
      },
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    };
  }

  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: sessionStorage,
  });
});

import { defaultPreferences } from '../src/config';
import { PreferenceManager } from '../src/preferences';
import { isDarkTheme, updateCSSVariables } from '../src/update-css-variables';

describe('preferences', () => {
  let preferenceManager: PreferenceManager;

  // 模拟 window.matchMedia 方法
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(), // Deprecated
      dispatchEvent: vi.fn(),
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(), // Deprecated
    })),
  );
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    preferenceManager = new PreferenceManager();
  });

  it('loads default preferences if no saved preferences found', () => {
    const preferences = preferenceManager.getPreferences();
    expect(preferences).toEqual(defaultPreferences);
  });

  it('initializes preferences with overrides', async () => {
    const overrides: any = {
      app: {
        locale: 'en-US',
      },
    };
    await preferenceManager.initPreferences({
      namespace: 'testNamespace',
      overrides,
    });

    // 等待防抖动操作完成
    // await new Promise((resolve) => setTimeout(resolve, 300)); // 等待100毫秒

    const expected = {
      ...defaultPreferences,
      app: {
        ...defaultPreferences.app,
        ...overrides.app,
      },
    };

    expect(preferenceManager.getPreferences()).toEqual(expected);
  });

  it('updates theme mode correctly', () => {
    preferenceManager.updatePreferences({
      theme: {
        mode: 'light',
      },
    });

    expect(preferenceManager.getPreferences().theme.mode).toBe('light');
  });

  it('updates font scale CSS variables from theme preferences', () => {
    const preferences = structuredClone(defaultPreferences);
    preferences.theme.fontSize = 18;
    preferences.theme.headingFontSizeScale = 1.25;
    preferences.theme.sidebarMenuFontSizeScale = 0.8;
    preferences.theme.headerMenuFontSizeScale = 1.1;
    preferences.theme.tabbarFontSizeScale = 1.2;
    preferences.theme.breadcrumbFontSizeScale = 0.9;
    preferences.theme.footerFontSizeScale = 1.05;

    updateCSSVariables(preferences);

    const { style } = document.documentElement;
    expect(style.getPropertyValue('--font-size-base')).toBe('18px');
    expect(style.getPropertyValue('--font-size-heading')).toBe(
      'calc(18px * 1.25)',
    );
    expect(style.getPropertyValue('--font-size-sidebar-menu')).toBe(
      'calc(18px * 0.8)',
    );
    expect(style.getPropertyValue('--font-size-header-menu')).toBe(
      'calc(18px * 1.1)',
    );
    expect(style.getPropertyValue('--font-size-tabbar')).toBe(
      'calc(18px * 1.2)',
    );
    expect(style.getPropertyValue('--font-size-breadcrumb')).toBe(
      'calc(18px * 0.9)',
    );
    expect(style.getPropertyValue('--font-size-footer')).toBe(
      'calc(18px * 1.05)',
    );
    expect(style.getPropertyValue('--menu-font-size')).toBe(
      'var(--font-size-sidebar-menu)',
    );
  });

  it('applies header menu font scale updates through preference manager', () => {
    preferenceManager.updatePreferences({
      theme: { headerMenuFontSizeScale: 1.5 },
    });

    expect(
      preferenceManager.getPreferences().theme.headerMenuFontSizeScale,
    ).toBe(1.5);
    expect(
      document.documentElement.style.getPropertyValue(
        '--font-size-header-menu',
      ),
    ).toBe('calc(16px * 1.5)');
  });

  it('applies custom footer backgrounds through preference manager', () => {
    preferenceManager.updatePreferences({
      footer: {
        backgroundColor: '#123456',
        backgroundColorCustom: true,
      },
    });

    expect(
      document.documentElement.style.getPropertyValue('--footer-background'),
    ).toBe('hsl(210, 65%, 20%)');
  });

  it('uses frontend fallback styles when footer shell overrides are unset', () => {
    updateCSSVariables(defaultPreferences);

    for (const name of [
      '--footer-margin-bottom',
      '--footer-margin-left',
      '--footer-margin-right',
      '--footer-margin-top',
      '--footer-radius-bottom-left',
      '--footer-radius-bottom-right',
      '--footer-radius-top-left',
      '--footer-radius-top-right',
    ]) {
      expect(document.documentElement.style.getPropertyValue(name)).toBe('');
    }
  });

  it('updates semi dark area colors correctly', () => {
    preferenceManager.updatePreferences({
      theme: {
        headerMenuThemeColor: 'hsl(204 84% 44%)',
        headerMenuThemeColorCustom: true,
        semiDarkHeaderColor: 'hsl(220 40% 10%)',
        semiDarkSidebarColor: 'hsl(230 35% 12%)',
      },
    });

    expect(preferenceManager.getPreferences().theme.semiDarkHeaderColor).toBe(
      'hsl(220 40% 10%)',
    );
    expect(preferenceManager.getPreferences().theme.semiDarkSidebarColor).toBe(
      'hsl(230 35% 12%)',
    );
    expect(preferenceManager.getPreferences().theme).toMatchObject({
      headerMenuThemeColor: 'hsl(204 84% 44%)',
      headerMenuThemeColorCustom: true,
    });
  });

  it('uses navigation background for topbar popups and resolves the topbar theme by priority', () => {
    const preferences = structuredClone(defaultPreferences);
    preferences.theme.mode = 'light';
    preferences.theme.semiDarkHeader = true;
    preferences.theme.semiDarkSidebarColor = 'hsl(222 10% 12%)';
    preferences.theme.sidebarMenuBackgroundColorCustom = false;
    preferences.theme.headerMenuThemeColorCustom = false;

    updateCSSVariables(preferences);

    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-background',
      ),
    ).toBe('222 10% 12%');
    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-theme-color',
      ),
    ).toBe('222 10% 52%');

    preferences.theme.sidebarMenuBackgroundColorCustom = true;
    preferences.theme.sidebarMenuBackgroundColor = 'hsl(42 84% 61%)';
    preferences.theme.baseBackgroundColorCustom = true;
    preferences.theme.baseBackgroundColor = 'hsl(210 40% 96%)';

    updateCSSVariables(preferences);

    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-background',
      ),
    ).toBe('42 84% 61%');
    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-theme-color',
      ),
    ).toBe('210 40% 96%');

    preferences.theme.headerMenuBackgroundColorCustom = true;
    preferences.theme.headerMenuBackgroundColor = 'hsl(348 100% 61%)';

    updateCSSVariables(preferences);

    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-background',
      ),
    ).toBe('348 100% 61%');

    preferences.theme.headerMenuThemeColorCustom = true;
    preferences.theme.headerMenuThemeColor = 'hsl(204 84% 44%)';

    updateCSSVariables(preferences);

    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-background',
      ),
    ).toBe('348 100% 61%');
    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-theme-color',
      ),
    ).toBe('204 84% 44%');

    preferences.theme.semiDarkHeader = false;

    updateCSSVariables(preferences);

    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-background',
      ),
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue(
        '--header-menu-theme-color',
      ),
    ).toBe('');
  });

  it('updates the custom base layout background correctly', () => {
    preferenceManager.updatePreferences({
      theme: {
        baseBackgroundColor: 'hsl(210 40% 96%)',
        baseBackgroundColorCustom: true,
      },
    });

    expect(preferenceManager.getPreferences().theme.baseBackgroundColor).toBe(
      'hsl(210 40% 96%)',
    );
    expect(
      preferenceManager.getPreferences().theme.baseBackgroundColorCustom,
    ).toBe(true);
  });

  it('updates the custom content background correctly', () => {
    preferenceManager.updatePreferences({
      theme: {
        contentBackgroundColor: 'hsl(210 40% 96%)',
        contentBackgroundColorCustom: true,
      },
    });

    expect(preferenceManager.getPreferences().theme).toMatchObject({
      contentBackgroundColor: 'hsl(210 40% 96%)',
      contentBackgroundColorCustom: true,
    });
  });

  it('keeps new background and tabbar appearance fields compatible with partial settings', () => {
    preferenceManager.updatePreferences({
      tabbar: {
        backgroundColorCustom: true,
        backgroundTransparency: 36,
        borderBottomWidth: 2,
        height: 46,
        marginTop: 8,
        radiusTopLeft: 12,
      },
      theme: {
        baseBackgroundTransparency: 28,
      },
    });

    expect(preferenceManager.getPreferences()).toMatchObject({
      tabbar: {
        backgroundTransparency: 36,
        borderBottomWidth: 2,
        height: 46,
        marginTop: 8,
        radiusTopLeft: 12,
      },
      theme: {
        baseBackgroundTransparency: 28,
      },
    });
  });

  it('updates sidebar navigation menu colors correctly', () => {
    preferenceManager.updatePreferences({
      theme: {
        sidebarMenuBackgroundColor: 'hsl(218 22% 12%)',
        sidebarMenuBackgroundColorCustom: true,
      },
    });

    expect(preferenceManager.getPreferences().theme).toMatchObject({
      sidebarMenuBackgroundColor: 'hsl(218 22% 12%)',
      sidebarMenuBackgroundColorCustom: true,
    });
  });

  it('updates color modes correctly', () => {
    preferenceManager.updatePreferences({
      app: { colorGrayMode: true, colorWeakMode: true },
    });

    expect(preferenceManager.getPreferences().app.colorGrayMode).toBe(true);
    expect(preferenceManager.getPreferences().app.colorWeakMode).toBe(true);
  });

  it('resets preferences to default', () => {
    // 先更新一些偏好设置
    preferenceManager.updatePreferences({
      theme: {
        mode: 'light',
      },
    });

    // 然后重置偏好设置
    preferenceManager.resetPreferences();

    expect(preferenceManager.getPreferences()).toEqual(defaultPreferences);
  });

  it('updates isMobile correctly', () => {
    // 模拟移动端状态
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );

    preferenceManager.updatePreferences({
      app: { isMobile: true },
    });

    expect(preferenceManager.getPreferences().app.isMobile).toBe(true);
  });

  it('updates the locale preference correctly', () => {
    preferenceManager.updatePreferences({
      app: { locale: 'en-US' },
    });

    expect(preferenceManager.getPreferences().app.locale).toBe('en-US');
  });

  it('updates the sidebar width correctly', () => {
    preferenceManager.updatePreferences({
      sidebar: { width: 200 },
    });

    expect(preferenceManager.getPreferences().sidebar.width).toBe(200);
  });
  it('updates sidebar menu spacing preferences correctly', () => {
    preferenceManager.updatePreferences({
      sidebar: { menuItemGap: 7, mixedMenuGap: 9 },
    });

    expect(preferenceManager.getPreferences().sidebar).toMatchObject({
      menuItemGap: 7,
      mixedMenuGap: 9,
    });
  });
  it('updates the header height correctly', () => {
    preferenceManager.updatePreferences({
      header: { height: 58 },
    });

    expect(preferenceManager.getPreferences().header.height).toBe(58);
  });
  it('updates layout shell styles independently', () => {
    preferenceManager.updatePreferences({
      app: {
        contentBorderLeftWidth: 3,
        contentMarginTop: 16,
        contentRadiusTopLeft: 12,
      },
      header: {
        borderBottomWidth: 2,
        marginRight: 10,
        radiusTopRight: 8,
      },
      sidebar: {
        borderRightWidth: 1,
        marginLeft: 12,
        radiusBottomLeft: 10,
      },
    });

    expect(preferenceManager.getPreferences()).toMatchObject({
      app: {
        contentBorderLeftWidth: 3,
        contentMarginTop: 16,
        contentRadiusTopLeft: 12,
      },
      header: { borderBottomWidth: 2, marginRight: 10, radiusTopRight: 8 },
      sidebar: { borderRightWidth: 1, marginLeft: 12, radiusBottomLeft: 10 },
    });
  });
  it('persists layout shell styles after reloading preferences', async () => {
    const options = { namespace: 'layout-shell-test', overrides: {} };
    await preferenceManager.initPreferences(options);

    preferenceManager.updatePreferences({
      app: {
        contentBorderTopWidth: 2,
        contentMarginTop: 12,
        contentRadiusTopLeft: 14,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const reloadedManager = new PreferenceManager();
    await reloadedManager.initPreferences(options);

    expect(reloadedManager.getPreferences().app).toMatchObject({
      contentBorderTopWidth: 2,
      contentMarginTop: 12,
      contentRadiusTopLeft: 14,
    });
  });
  it('updates the sidebar collapse state correctly', () => {
    preferenceManager.updatePreferences({
      sidebar: { collapsed: true },
    });

    expect(preferenceManager.getPreferences().sidebar.collapsed).toBe(true);
  });
  it('updates the navigation style type correctly', () => {
    preferenceManager.updatePreferences({
      navigation: { styleType: 'flat' },
    } as any);

    expect(preferenceManager.getPreferences().navigation.styleType).toBe(
      'flat',
    );
  });

  it('resets preferences to default correctly', () => {
    // 先更新一些偏好设置
    preferenceManager.updatePreferences({
      app: { locale: 'en-US' },
      sidebar: { collapsed: true, width: 200 },
      theme: {
        mode: 'light',
      },
    });

    // 然后重置偏好设置
    preferenceManager.resetPreferences();

    expect(preferenceManager.getPreferences()).toEqual(defaultPreferences);
  });

  it('does not update undefined preferences', () => {
    const originalPreferences = preferenceManager.getPreferences();

    preferenceManager.updatePreferences({
      app: { nonexistentField: 'value' },
    } as any);

    expect(preferenceManager.getPreferences()).toEqual(originalPreferences);
  });

  it('reverts to default when a preference field is deleted', () => {
    preferenceManager.updatePreferences({
      app: { locale: 'en-US' },
    });

    preferenceManager.updatePreferences({
      app: { locale: undefined },
    });

    expect(preferenceManager.getPreferences().app.locale).toBe('en-US');
  });

  it('ignores updates with invalid preference value types', () => {
    const originalPreferences = preferenceManager.getPreferences();

    preferenceManager.updatePreferences({
      app: { isMobile: 'true' as unknown as boolean }, // 错误类型
    });

    expect(preferenceManager.getPreferences()).toEqual(originalPreferences);
  });

  it('merges nested preference objects correctly', () => {
    preferenceManager.updatePreferences({
      app: { name: 'New App Name' },
    });

    const expected = {
      ...defaultPreferences,
      app: {
        ...defaultPreferences.app,
        name: 'New App Name',
      },
    };

    expect(preferenceManager.getPreferences()).toEqual(expected);
  });

  it('applies updates immediately after initialization', async () => {
    const overrides: any = {
      app: {
        locale: 'en-US',
      },
    };

    await preferenceManager.initPreferences(overrides);

    preferenceManager.updatePreferences({
      theme: { mode: 'light' },
    });

    expect(preferenceManager.getPreferences().theme.mode).toBe('light');
  });
});

describe('isDarkTheme', () => {
  it('should return true for dark theme', () => {
    expect(isDarkTheme('dark')).toBe(true);
  });

  it('should return false for light theme', () => {
    expect(isDarkTheme('light')).toBe(false);
  });

  it('should return system preference for auto theme', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(), // Deprecated
      dispatchEvent: vi.fn(),
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(), // Deprecated
    }));

    expect(isDarkTheme('auto')).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith(
      '(prefers-color-scheme: dark)',
    );
  });
});
