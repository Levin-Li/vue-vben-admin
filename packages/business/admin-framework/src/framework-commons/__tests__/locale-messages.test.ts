import { describe, expect, it } from 'vitest';

import {
  collectAdminModuleLocales,
  defineAdminModuleLocales,
  mergeAdminLocaleMessages,
} from '../locale-utils';

describe('admin locale message merging', () => {
  it('deep-merges partial overrides without replacing sibling keys', () => {
    const messages = mergeAdminLocaleMessages(
      {
        common: {
          cancel: '取消',
          login: '登录',
        },
      },
      {
        common: {
          login: '立即登录',
        },
      },
    );

    expect(messages).toEqual({
      common: {
        cancel: '取消',
        login: '立即登录',
      },
    });
  });

  it('deep-merges locale messages from multiple enabled modules', () => {
    const locales = collectAdminModuleLocales([
      {
        locales: {
          'zh-CN': {
            common: {
              cancel: '取消',
              login: '登录',
            },
          },
        },
        name: 'base-module',
        title: 'Base Module',
      },
      {
        locales: {
          'zh-CN': {
            common: {
              login: '立即登录',
            },
          },
        },
        name: 'override-module',
        title: 'Override Module',
      },
    ]);

    expect(locales['zh-CN']).toEqual({
      common: {
        cancel: '取消',
        login: '立即登录',
      },
    });
  });

  it('loads module locale files from the standard locales glob', () => {
    const locales = defineAdminModuleLocales({
      './locales/en-US/common.json': {
        default: {
          cancel: 'Cancel',
          login: 'Login',
        },
      },
      './locales/zh-CN.json': {
        default: {
          common: {
            cancel: '取消',
            login: '登录',
          },
        },
      },
      './locales/zh-CN/common.json': {
        default: {
          login: '立即登录',
        },
      },
    });

    expect(locales).toEqual({
      'en-US': {
        common: {
          cancel: 'Cancel',
          login: 'Login',
        },
      },
      'zh-CN': {
        common: {
          cancel: '取消',
          login: '立即登录',
        },
      },
    });
  });
});
