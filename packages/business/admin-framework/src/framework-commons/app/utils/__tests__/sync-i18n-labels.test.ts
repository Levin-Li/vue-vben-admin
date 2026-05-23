import { describe, expect, it } from 'vitest';

import {
  buildModuleUploadI18nLabelsPayload,
  buildSyncI18nModuleTree,
  flattenSyncI18nTreeNodes,
} from '../sync-i18n-labels';

describe('sync i18n labels payload', () => {
  it('builds a module and language-package tree for every locale in the current app modules', () => {
    const tree = buildSyncI18nModuleTree(
      [
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
      ],
    );

    expect(tree).toEqual([
      {
        children: [
          {
            key: 'lang:com.levin.oak.base:en-US',
            keyCount: 1,
            labels: {
              'common.save': 'Save',
            },
            language: 'en-US',
            moduleId: 'com.levin.oak.base',
            moduleTitle: '基础模块',
            nodeType: 'language',
          },
          {
            key: 'lang:com.levin.oak.base:zh-CN',
            keyCount: 2,
            labels: {
              'common.cancel': '取消',
              'common.save': '保存',
            },
            language: 'zh-CN',
            moduleId: 'com.levin.oak.base',
            moduleTitle: '基础模块',
            nodeType: 'language',
          },
        ],
        key: 'module:com.levin.oak.base',
        keyCount: 3,
        moduleId: 'com.levin.oak.base',
        moduleTitle: '基础模块',
        nodeType: 'module',
      },
      {
        children: [
          {
            key: 'lang:com.levin.contract:zh-CN',
            keyCount: 1,
            labels: {
              'contract.title': '合同',
            },
            language: 'zh-CN',
            moduleId: 'com.levin.contract',
            moduleTitle: '合同模块',
            nodeType: 'language',
          },
        ],
        key: 'module:com.levin.contract',
        keyCount: 1,
        moduleId: 'com.levin.contract',
        moduleTitle: '合同模块',
        nodeType: 'module',
      },
    ]);
  });

  it('matches the uploadModuleLabels request shape', () => {
    const tree = buildSyncI18nModuleTree(
      [
        {
          locales: {
            'en-US': {
              common: {
                save: 'Save',
              },
            },
            'zh-CN': {
              common: {
                save: '保存',
              },
            },
          },
          name: 'com.levin.oak.base',
          title: '基础模块',
        },
      ],
    );
    const languageNodes = flattenSyncI18nTreeNodes(tree).filter(
      (item) => item.nodeType === 'language',
    );

    const payload = buildModuleUploadI18nLabelsPayload(languageNodes, {
      appCode: 'levin-main-app',
      appVersion: '5.5.9',
      enable: true,
      overrideExisting: false,
      terminalType: 'Admin',
    });

    expect(payload).toEqual({
      appCode: 'levin-main-app',
      appVersion: '5.5.9',
      enable: true,
      overrideExisting: false,
      terminalType: 'Admin',
      modules: [
        {
          moduleId: 'com.levin.oak.base',
          languages: {
            'en-US': {
              'common.save': 'Save',
            },
            'zh-CN': {
              'common.save': '保存',
            },
          },
        },
      ],
    });
  });

  it('builds upload payload for every enabled module with locales', () => {
    const tree = buildSyncI18nModuleTree([
      {
        locales: {
          'zh-CN': {
            base: {
              title: '基础',
            },
          },
        },
        name: 'com.levin.oak.base',
        title: '基础模块',
      },
      {
        locales: {
          'en-US': {
            order: {
              title: 'Order',
            },
          },
          'zh-CN': {
            order: {
              title: '订单',
            },
          },
        },
        name: 'com.levin.order',
        title: '订单模块',
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
    const languageNodes = flattenSyncI18nTreeNodes(tree).filter(
      (item) => item.nodeType === 'language',
    );

    const payload = buildModuleUploadI18nLabelsPayload(languageNodes, {
      appCode: 'levin-main-app',
      appVersion: '5.5.9',
      terminalType: 'Admin',
    });

    expect(payload.modules.map((item) => item.moduleId)).toEqual([
      'com.levin.oak.base',
      'com.levin.order',
      'com.levin.contract',
    ]);
    expect(payload.modules).toEqual([
      {
        languages: {
          'zh-CN': {
            'base.title': '基础',
          },
        },
        moduleId: 'com.levin.oak.base',
      },
      {
        languages: {
          'en-US': {
            'order.title': 'Order',
          },
          'zh-CN': {
            'order.title': '订单',
          },
        },
        moduleId: 'com.levin.order',
      },
      {
        languages: {
          'zh-CN': {
            'contract.title': '合同',
          },
        },
        moduleId: 'com.levin.contract',
      },
    ]);
  });

  it('omits cleared optional upload context dimensions', () => {
    const tree = buildSyncI18nModuleTree([
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
    ]);
    const languageNodes = flattenSyncI18nTreeNodes(tree).filter(
      (item) => item.nodeType === 'language',
    );

    const payload = buildModuleUploadI18nLabelsPayload(languageNodes, {
      appCode: '   ',
      appVersion: '5.5.9',
      domain: '   ',
      tenantId: '',
      terminalType: undefined,
    });

    expect(payload.appVersion).toBe('5.5.9');
    expect(payload).not.toHaveProperty('appCode');
    expect(payload).not.toHaveProperty('domain');
    expect(payload).not.toHaveProperty('tenantId');
    expect(payload).not.toHaveProperty('terminalType');
  });

  it('deduplicates labels by module, language and resource key', () => {
    const tree = buildSyncI18nModuleTree(
      [
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
      ],
    );
    const languageNodes = flattenSyncI18nTreeNodes(tree).filter(
      (item) => item.nodeType === 'language',
    );

    expect(tree).toHaveLength(1);
    expect(languageNodes).toHaveLength(1);
    expect(languageNodes[0]?.labels?.['common.save']).toBe('保存');
    expect(languageNodes[0]?.keyCount).toBe(1);
  });
});
