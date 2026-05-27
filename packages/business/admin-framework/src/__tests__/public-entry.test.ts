import { describe, expect, it } from 'vitest';

import {
  defineAdminModuleLocales,
  defineAdminPageOverrides,
  matchPatternList,
  PatternListEditor,
  useDraggableFloatingPanels,
  useLayoutHeaderExtensionArea,
  useUserDropdownMenuItems,
} from '../index';

describe('@levin/admin-framework public entry', () => {
  it('exports downstream extension helpers from the package root', () => {
    expect(typeof defineAdminModuleLocales).toBe('function');
    expect(typeof defineAdminPageOverrides).toBe('function');
    expect(typeof matchPatternList).toBe('function');
    expect(PatternListEditor).toBeTruthy();
    expect(typeof useDraggableFloatingPanels).toBe('function');
    expect(typeof useLayoutHeaderExtensionArea).toBe('function');
    expect(typeof useUserDropdownMenuItems).toBe('function');
  });

  it('lets downstream modules define merged locale files through the root helper', () => {
    const locales = defineAdminModuleLocales({
      './locales/en-US/common.json': { default: { save: 'Save' } },
      './locales/zh-CN.json': {
        default: { common: { cancel: '取消' }, page: { title: '标题' } },
      },
      './locales/zh-CN/common.json': { default: { save: '保存' } },
    });

    expect(locales).toEqual({
      'en-US': {
        common: {
          save: 'Save',
        },
      },
      'zh-CN': {
        common: {
          cancel: '取消',
          save: '保存',
        },
        page: {
          title: '标题',
        },
      },
    });
  });
});
