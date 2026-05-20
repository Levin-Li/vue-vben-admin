import type { App } from 'vue';
import type { Locale } from 'vue-i18n';

import type {
  ImportLocaleFn,
  LoadMessageFn,
  LocaleSetupOptions,
  SupportedLanguagesType,
} from './typing';

import { unref } from 'vue';
import { createI18n } from 'vue-i18n';

import { useSimpleLocale } from '@vben-core/composables';

import enUSAuthentication from './langs/en-US/authentication.json';
import enUSCommon from './langs/en-US/common.json';
import enUSPreferences from './langs/en-US/preferences.json';
import enUSProfile from './langs/en-US/profile.json';
import enUSUi from './langs/en-US/ui.json';
import zhCNAuthentication from './langs/zh-CN/authentication.json';
import zhCNCommon from './langs/zh-CN/common.json';
import zhCNPreferences from './langs/zh-CN/preferences.json';
import zhCNProfile from './langs/zh-CN/profile.json';
import zhCNUi from './langs/zh-CN/ui.json';

const i18n = createI18n({
  fallbackLocale: 'zh-CN',
  globalInjection: true,
  legacy: false,
  locale: '',
  messages: {},
});

const baseLocaleMessages: Record<Locale, Record<string, any>> = {
  'en-US': {
    authentication: enUSAuthentication,
    common: enUSCommon,
    preferences: enUSPreferences,
    profile: enUSProfile,
    ui: enUSUi,
  },
  'zh-CN': {
    authentication: zhCNAuthentication,
    common: zhCNCommon,
    preferences: zhCNPreferences,
    profile: zhCNProfile,
    ui: zhCNUi,
  },
};

const { setSimpleLocale } = useSimpleLocale();

const localesMap = loadStaticLocalesMap(baseLocaleMessages);
const loadedLocales = new Set<Locale>();
let loadMessages: LoadMessageFn = async () => ({});
let defaultResolvedLocale: Locale = 'zh-CN';

const preferredLocaleByLanguageFamily: Record<string, Locale> = {
  en: 'en-US',
  zh: 'zh-CN',
};

function loadStaticLocalesMap(
  messagesByLocale: Record<Locale, Record<string, any>>,
): Record<Locale, ImportLocaleFn> {
  return Object.fromEntries(
    Object.entries(messagesByLocale).map(([locale, messages]) => [
      locale,
      async () => ({ default: messages }),
    ]),
  );
}

/**
 * Load locale modules
 * @param modules
 */
function loadLocalesMap(modules: Record<string, () => Promise<unknown>>) {
  const localesMap: Record<Locale, ImportLocaleFn> = {};

  for (const [path, loadLocale] of Object.entries(modules)) {
    const key = path.match(/([\w-]*)\.(json)/)?.[1];
    if (key) {
      localesMap[key] = loadLocale as ImportLocaleFn;
    }
  }
  return localesMap;
}

/**
 * Load locale modules with directory structure
 * @param regexp - Regular expression to match language and file names
 * @param modules - The modules object containing paths and import functions
 * @returns A map of locales to their corresponding import functions
 */
function loadLocalesMapFromDir(
  regexp: RegExp,
  modules: Record<string, () => Promise<unknown>>,
): Record<Locale, ImportLocaleFn> {
  const localesRaw: Record<Locale, Record<string, () => Promise<unknown>>> = {};
  const localesMap: Record<Locale, ImportLocaleFn> = {};

  // Iterate over the modules to extract language and file names
  for (const path in modules) {
    const match = path.match(regexp);
    if (match) {
      const [_, locale, fileName] = match;
      if (locale && fileName) {
        if (!localesRaw[locale]) {
          localesRaw[locale] = {};
        }
        if (modules[path]) {
          localesRaw[locale][fileName] = modules[path];
        }
      }
    }
  }

  // Convert raw locale data into async import functions
  for (const [locale, files] of Object.entries(localesRaw)) {
    localesMap[locale] = async () => {
      const messages: Record<string, any> = {};
      for (const [fileName, importFn] of Object.entries(files)) {
        messages[fileName] = ((await importFn()) as any)?.default;
      }
      return { default: messages };
    };
  }

  return localesMap;
}

function normalizeLocaleCode(locale?: string): Locale {
  const normalized = String(locale || '')
    .trim()
    .replaceAll('_', '-');

  if (!normalized) {
    return '';
  }

  const [language = '', ...segments] = normalized.split('-').filter(Boolean);

  return [
    language.toLowerCase(),
    ...segments.map((segment) => segment.toUpperCase()),
  ].join('-');
}

function getSupportedLocales(locales: Record<Locale, ImportLocaleFn>) {
  return Object.keys(locales).map((locale) => normalizeLocaleCode(locale));
}

function findLocaleIgnoreCase(
  locale: string,
  supportedLocales: Locale[],
): Locale | undefined {
  const normalized = normalizeLocaleCode(locale);

  return supportedLocales.find(
    (supportedLocale) =>
      supportedLocale.toLowerCase() === normalized.toLowerCase(),
  );
}

function getLocaleLoader(locale: Locale) {
  const exactLoader = localesMap[locale];

  if (exactLoader) {
    return exactLoader;
  }

  const actualLocaleKey = Object.keys(localesMap).find(
    (supportedLocale) =>
      normalizeLocaleCode(supportedLocale).toLowerCase() ===
      locale.toLowerCase(),
  );

  return actualLocaleKey ? localesMap[actualLocaleKey] : undefined;
}

function getLanguageFamily(locale: string) {
  return normalizeLocaleCode(locale).split('-')[0] || '';
}

function resolveLocale(
  locale: SupportedLanguagesType,
  options: {
    defaultLocale?: SupportedLanguagesType;
    supportedLocales?: Locale[];
  } = {},
): Locale {
  const supportedLocales =
    options.supportedLocales?.map((item) => normalizeLocaleCode(item)) ||
    getSupportedLocales(localesMap);

  if (supportedLocales.length === 0) {
    return normalizeLocaleCode(options.defaultLocale || locale);
  }

  const normalizedLocale = normalizeLocaleCode(locale);
  const exactLocale = findLocaleIgnoreCase(normalizedLocale, supportedLocales);

  if (exactLocale) {
    return exactLocale;
  }

  const languageFamily = getLanguageFamily(normalizedLocale);

  if (languageFamily) {
    const defaultFamilyLocale =
      getLanguageFamily(options.defaultLocale || '') === languageFamily
        ? findLocaleIgnoreCase(
            normalizeLocaleCode(options.defaultLocale),
            supportedLocales,
          )
        : undefined;
    const preferredFamilyLocale = findLocaleIgnoreCase(
      preferredLocaleByLanguageFamily[languageFamily] || '',
      supportedLocales,
    );
    const familyLocale =
      defaultFamilyLocale ||
      preferredFamilyLocale ||
      supportedLocales.find(
        (supportedLocale) =>
          getLanguageFamily(supportedLocale) === languageFamily,
      );

    if (familyLocale) {
      return familyLocale;
    }
  }

  const defaultLocale = findLocaleIgnoreCase(
    normalizeLocaleCode(options.defaultLocale),
    supportedLocales,
  );

  return defaultLocale || supportedLocales[0] || normalizedLocale;
}

/**
 * Set i18n language
 * @param locale
 */
function setI18nLanguage(locale: Locale) {
  i18n.global.locale.value = locale;

  document?.querySelector('html')?.setAttribute('lang', locale);
}

async function setupI18n(app: App, options: LocaleSetupOptions = {}) {
  const { defaultLocale = 'zh-CN' } = options;
  defaultResolvedLocale = resolveLocale(defaultLocale, { defaultLocale });
  i18n.global.fallbackLocale.value = defaultResolvedLocale;
  // app可以自行扩展一些第三方库和组件库的国际化
  loadMessages = options.loadMessages || (async () => ({}));
  app.use(i18n);
  await loadLocaleMessages(defaultLocale);

  // 在控制台打印警告
  i18n.global.setMissingHandler((locale, key) => {
    if (options.missingWarn && key.includes('.')) {
      console.warn(
        `[intlify] Not found '${key}' key in '${locale}' locale messages.`,
      );
    }
  });
}

/**
 * Load locale messages
 * @param lang
 */
async function loadLocaleMessages(lang: SupportedLanguagesType) {
  const locale = resolveLocale(lang, {
    defaultLocale: defaultResolvedLocale,
  });

  if (unref(i18n.global.locale) === locale && loadedLocales.has(locale)) {
    return setI18nLanguage(locale);
  }
  setSimpleLocale(locale as any);

  const message = await getLocaleLoader(locale)?.();

  if (message?.default) {
    i18n.global.setLocaleMessage(locale, message.default);
    loadedLocales.add(locale);
  }

  const mergeMessage = await loadMessages(locale);
  i18n.global.mergeLocaleMessage(locale, mergeMessage);
  loadedLocales.add(locale);

  return setI18nLanguage(locale);
}

export {
  getSupportedLocales,
  i18n,
  loadLocaleMessages,
  loadLocalesMap,
  loadLocalesMapFromDir,
  normalizeLocaleCode,
  resolveLocale,
  setupI18n,
};
