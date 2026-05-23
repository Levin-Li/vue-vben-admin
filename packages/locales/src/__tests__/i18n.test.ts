import { beforeEach, describe, expect, it } from 'vitest';

import {
  getBaseLocaleMessages,
  i18n,
  loadLocaleMessages,
  normalizeLocaleCode,
  resolveLocale,
} from '../i18n';

describe('locale fallback resolution', () => {
  const supportedLocales = ['zh-CN', 'en-US'];

  beforeEach(() => {
    i18n.global.locale.value = '';
    i18n.global.setLocaleMessage('zh-CN', {});
  });

  it('normalizes underscores and locale segment case without changing the API', () => {
    expect(normalizeLocaleCode('zh_cn')).toBe('zh-CN');
    expect(normalizeLocaleCode('ZH_cn')).toBe('zh-CN');
    expect(normalizeLocaleCode('en_us')).toBe('en-US');
    expect(normalizeLocaleCode('EN_uk')).toBe('en-UK');
    expect(normalizeLocaleCode('en-gb')).toBe('en-GB');
  });

  it('keeps exact supported locales before applying family fallback', () => {
    expect(
      resolveLocale('zh-tw', {
        defaultLocale: 'zh-CN',
        supportedLocales: ['zh-CN', 'zh-TW', 'en-US'],
      }),
    ).toBe('zh-TW');
  });

  it('falls back zh variants to the supported zh family locale', () => {
    expect(
      resolveLocale('zh', {
        defaultLocale: 'en-US',
        supportedLocales,
      }),
    ).toBe('zh-CN');
    expect(
      resolveLocale('zh-TW', {
        defaultLocale: 'en-US',
        supportedLocales,
      }),
    ).toBe('zh-CN');
  });

  it('falls back en variants and non-standard en-UK to the supported en family locale', () => {
    expect(
      resolveLocale('en', {
        defaultLocale: 'zh-CN',
        supportedLocales,
      }),
    ).toBe('en-US');
    expect(
      resolveLocale('en-UK', {
        defaultLocale: 'zh-CN',
        supportedLocales,
      }),
    ).toBe('en-US');
    expect(
      resolveLocale('en-gb', {
        defaultLocale: 'zh-CN',
        supportedLocales,
      }),
    ).toBe('en-US');
  });

  it('uses the configured default locale when no same-language family exists', () => {
    expect(
      resolveLocale('fr-FR', {
        defaultLocale: 'zh-CN',
        supportedLocales,
      }),
    ).toBe('zh-CN');
  });

  it('falls back to the first supported locale if the configured default is unavailable', () => {
    expect(
      resolveLocale('fr-FR', {
        defaultLocale: 'de-DE',
        supportedLocales,
      }),
    ).toBe('zh-CN');
  });

  it('loads base zh-CN messages when callers pass the zh language family', async () => {
    await loadLocaleMessages('zh');

    expect(i18n.global.locale.value).toBe('zh-CN');
    expect(i18n.global.t('authentication.welcomeBack')).toBe('欢迎回来');
    expect(i18n.global.t('common.login')).toBe('登录');
  });

  it('exposes the full base locale messages for application-level uploads', () => {
    const messages = getBaseLocaleMessages();

    expect(messages['zh-CN']?.common?.login).toBe('登录');
    expect(messages['en-US']?.common?.login).toBe('Login');
    expect(Object.keys(messages['zh-CN'] || {})).toContain('preferences');
  });
});
