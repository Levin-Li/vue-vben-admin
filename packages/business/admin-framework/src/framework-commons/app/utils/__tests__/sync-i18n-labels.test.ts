import { describe, expect, it } from 'vitest';

import { buildModuleSyncI18nLabelsPayload } from '../sync-i18n-labels';

describe('buildModuleSyncI18nLabelsPayload', () => {
  it('collects flattened locale labels from all enabled modules', () => {
    const payload = buildModuleSyncI18nLabelsPayload([
      {
        locales: {
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
          },
        },
        name: 'com.levin.oak.base',
        title: '基础模块',
      },
      {
        locales: {
          'zh-CN': {
            contract: {
              title: '合同',
            },
          },
        },
        name: 'com.levin.contract',
        title: '合同模块',
      },
    ]);

    expect(payload.labelList).toEqual([
      {
        category: 'common',
        label: 'Save',
        language: 'en-US',
        moduleId: 'com.levin.oak.base',
        moduleTitle: '基础模块',
        resKey: 'common.save',
      },
      {
        category: 'common',
        label: '取消',
        language: 'zh-CN',
        moduleId: 'com.levin.oak.base',
        moduleTitle: '基础模块',
        resKey: 'common.cancel',
      },
      {
        category: 'common',
        label: '保存',
        language: 'zh-CN',
        moduleId: 'com.levin.oak.base',
        moduleTitle: '基础模块',
        resKey: 'common.save',
      },
      {
        category: 'contract',
        label: '合同',
        language: 'zh-CN',
        moduleId: 'com.levin.contract',
        moduleTitle: '合同模块',
        resKey: 'contract.title',
      },
    ]);
  });

  it('deduplicates labels by module, language and resource key', () => {
    const payload = buildModuleSyncI18nLabelsPayload([
      {
        locales: {
          'zh-CN': {
            common: {
              save: '保存',
            },
          },
        },
        name: 'com.levin.oak.base',
        title: '基础模块',
      },
      {
        locales: {
          'zh-CN': {
            common: {
              save: '重复保存',
            },
          },
        },
        name: 'com.levin.oak.base',
        title: '基础模块重复注册',
      },
    ]);

    expect(payload.labelList).toHaveLength(1);
    expect(payload.labelList[0]?.label).toBe('保存');
  });
});
