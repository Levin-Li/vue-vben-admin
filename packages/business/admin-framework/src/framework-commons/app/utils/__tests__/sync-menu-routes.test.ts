import type { RouteRecordRaw } from 'vue-router';

import { describe, expect, it } from 'vitest';

import {
  buildModuleSyncMenuPayload,
  buildSyncMenuPayload,
} from '../sync-menu-routes';

describe('buildSyncMenuPayload', () => {
  it('rejects module leaf routes without a complete page mapping', () => {
    expect(() =>
      buildModuleSyncMenuPayload([
        {
          backendRouteMappings: [],
          name: 'com.levin.example',
          routes: [
            {
              component: {},
              meta: { title: '示例页面' },
              name: '_example_V1_Example',
              path: '/example/V1/Example',
            },
          ],
          title: '示例模块',
        },
      ]),
    ).toThrow(
      '页面路由缺少完整映射：/example/V1/Example。请在 backendRouteMappings 中提供 name、title、description、viewPath 和 sourceFilePath。',
    );
  });

  it('rejects incomplete module page mappings', () => {
    expect(() =>
      buildModuleSyncMenuPayload([
        {
          backendRouteMappings: [
            {
              description: '维护示例页面。',
              icon: 'lucide:file',
              name: 'Example',
              path: '/example/V1/Example',
              resource: 'Example',
              sourceFilePath: '',
              title: '示例页面',
              viewPath: '/system/com_levin_example/example/index.vue',
            },
          ],
          name: 'com.levin.example',
          routes: [],
          title: '示例模块',
        },
      ]),
    ).toThrow(
      '页面映射不完整：/example/V1/Example。必须同时提供 name、title、description、viewPath 和 sourceFilePath。',
    );
  });

  it('converts visible local routes to sync menu items', () => {
    const routes: RouteRecordRaw[] = [
      {
        children: [
          {
            component: {},
            meta: {
              icon: 'lucide:user',
              title: '用户管理',
            },
            name: '_system_user',
            path: 'user',
          },
          {
            component: {},
            meta: {
              hideInMenu: true,
              title: '隐藏页面',
            },
            name: '_system_hidden',
            path: 'hidden',
          },
          {
            component: {},
            meta: {
              link: 'https://example.com',
              title: '外链',
            },
            name: '_system_link',
            path: 'link',
          },
        ],
        meta: {
          icon: 'lucide:settings',
          title: '系统管理',
        },
        name: '_system',
        path: '/system',
      },
    ];

    expect(buildSyncMenuPayload(routes)).toEqual({
      menuList: [
        {
          children: [
            {
              children: [],
              icon: 'lucide:user',
              label: '用户管理',
              moduleId: 'com.levin.oak.base',
              name: '用户管理',
              path: '/system/user',
              remark: '_system_user',
            },
          ],
          icon: 'lucide:settings',
          label: '系统管理',
          moduleId: 'com.levin.oak.base',
          name: '系统管理',
          path: '/system',
          remark: '_system',
        },
      ],
    });
  });

  it('converts all enabled modules and includes mapped page locations', () => {
    const payload = buildModuleSyncMenuPayload([
      {
        backendRouteMappings: [
          {
            description: '维护用户信息。',
            icon: 'lucide:user',
            name: 'User',
            resource: 'User',
            sourceFilePath: 'modules/com_levin_oak_base/views/user/index.vue',
            path: '/clob/V1/User',
            title: '用户管理',
            viewPath: '/system/com_levin_oak_base/user/index.vue',
          },
        ],
        name: 'com.levin.oak.base',
        routes: [
          {
            children: [
              {
                component: {},
                meta: {
                  icon: 'lucide:user',
                  title: '用户管理',
                },
                name: '_clob_V1_User',
                path: '/clob/V1/User',
              },
            ],
            meta: {
              icon: 'lucide:database',
              title: '基础模块',
            },
            name: '_oak-base',
            path: '/oak-base',
          },
        ],
        title: '基础模块',
      },
      {
        backendRouteMappings: [
          {
            description: '维护合同信息。',
            icon: 'lucide:file-text',
            name: 'Contract',
            resource: 'Contract',
            sourceFilePath:
              'modules/com_levin_contract/views/contract/index.vue',
            path: '/contract/V1/Contract',
            title: '合同管理',
            viewPath: '/system/com_levin_contract/contract/index.vue',
          },
        ],
        name: 'com.levin.contract',
        routes: [],
        title: '合同模块',
      },
    ]);

    expect(payload).toEqual({
      menuList: [
        {
          children: [
            {
              children: [],
              icon: 'lucide:user',
              label: '用户管理',
              moduleId: 'com.levin.oak.base',
              name: 'User',
              path: '/clob/V1/User',
              remark: '维护用户信息。',
              sourceFilePath: 'modules/com_levin_oak_base/views/user/index.vue',
              viewPath: '/system/com_levin_oak_base/user/index.vue',
            },
          ],
          icon: 'lucide:database',
          label: '基础模块',
          moduleId: 'com.levin.oak.base',
          name: '基础模块',
          path: '/oak-base',
          remark: '_oak-base',
        },
        {
          children: [],
          icon: 'lucide:file-text',
          label: '合同管理',
          moduleId: 'com.levin.contract',
          name: 'Contract',
          path: '/contract/V1/Contract',
          remark: '维护合同信息。',
          sourceFilePath: 'modules/com_levin_contract/views/contract/index.vue',
          viewPath: '/system/com_levin_contract/contract/index.vue',
        },
      ],
    });
  });

  it('keeps every page operation and resource permission in the upload payload', () => {
    const payload = buildModuleSyncMenuPayload([
      {
        backendRouteMappings: [
          {
            description: '维护客户资料。',
            icon: 'lucide:users',
            name: 'Customer',
            operations: [
              {
                apiMethods: ['create'],
                description: '新增客户。',
                label: '新增',
                opName: 'create',
                requireAuthorizations: ['com.levin.oak.base:客户:新增'],
              },
              {
                apiMethods: ['export'],
                description: '导出客户。',
                label: '导出',
                opName: 'export',
                requireAuthorizations: [
                  'com.levin.oak.base:客户:查看',
                  'com.levin.oak.base:客户:导出',
                ],
              },
            ],
            path: '/clob/V1/Customer',
            resource: 'Customer',
            sourceFilePath:
              'modules/com_levin_oak_base/views/customer/index.vue',
            title: '客户',
            viewPath: '/system/com_levin_oak_base/customer/index.vue',
          },
        ],
        name: 'com.levin.oak.base',
        routes: [
          {
            component: {},
            meta: { title: '客户' },
            name: '_clob_V1_Customer',
            path: '/clob/V1/Customer',
          },
        ],
        title: '基础模块',
      },
    ]);

    expect(payload.menuList[0]?.opButtonList).toEqual([
      {
        label: '新增',
        opName: 'create',
        remark: '新增客户。',
        requireAuthorizations: ['com.levin.oak.base:客户:新增'],
      },
      {
        label: '导出',
        opName: 'export',
        remark: '导出客户。',
        requireAuthorizations: [
          'com.levin.oak.base:客户:查看',
          'com.levin.oak.base:客户:导出',
        ],
      },
    ]);
  });

  it('deduplicates uploaded menu items by module id and path', () => {
    const payload = buildModuleSyncMenuPayload([
      {
        backendRouteMappings: [
          {
            description: '展示后台首页。',
            icon: 'lucide:home',
            name: 'Home',
            resource: 'Home',
            sourceFilePath: 'modules/com_levin_oak_base/views/home/index.vue',
            path: '/clob/V1/index',
            title: '首页映射',
            viewPath: '/system/com_levin_oak_base/home/index.vue',
          },
        ],
        name: 'com.levin.oak.base',
        routes: [
          {
            component: {},
            meta: {
              icon: 'lucide:home',
              title: '首页',
            },
            name: '_clob_V1_index',
            path: '/clob/V1/index',
          },
        ],
        title: '基础模块',
      },
      {
        backendRouteMappings: [
          {
            description: '展示后台首页。',
            icon: 'lucide:home',
            name: 'Home',
            path: '/clob/V1/index',
            resource: 'Home',
            sourceFilePath: 'modules/com_levin_oak_base/views/home/index.vue',
            title: '首页映射',
            viewPath: '/system/com_levin_oak_base/home/index.vue',
          },
        ],
        name: 'com.levin.oak.base',
        routes: [
          {
            component: {},
            meta: {
              icon: 'lucide:home',
              title: '重复首页',
            },
            name: '_clob_V1_index',
            path: '/clob/V1/index',
          },
        ],
        title: '基础模块重复注册',
      },
    ]);

    expect(payload.menuList).toHaveLength(1);
    expect(payload.menuList[0]).toEqual(
      expect.objectContaining({
        label: '首页',
        moduleId: 'com.levin.oak.base',
        name: 'Home',
        path: '/clob/V1/index',
        sourceFilePath: 'modules/com_levin_oak_base/views/home/index.vue',
        viewPath: '/system/com_levin_oak_base/home/index.vue',
      }),
    );
  });

  it('keeps the same path for different modules', () => {
    const payload = buildModuleSyncMenuPayload([
      {
        backendRouteMappings: [
          {
            description: '展示基础首页。',
            icon: 'lucide:home',
            name: 'OakSharedHome',
            path: '/shared/index',
            resource: 'OakSharedHome',
            sourceFilePath: 'modules/com_levin_oak_base/views/shared/index.vue',
            title: '基础首页',
            viewPath: '/system/com_levin_oak_base/shared/index.vue',
          },
        ],
        name: 'com.levin.oak.base',
        routes: [
          {
            component: {},
            meta: {
              title: '基础首页',
            },
            name: '_shared_index',
            path: '/shared/index',
          },
        ],
        title: '基础模块',
      },
      {
        backendRouteMappings: [
          {
            description: '展示合同首页。',
            icon: 'lucide:home',
            name: 'ContractSharedHome',
            path: '/shared/index',
            resource: 'ContractSharedHome',
            sourceFilePath: 'modules/com_levin_contract/views/shared/index.vue',
            title: '合同首页',
            viewPath: '/system/com_levin_contract/shared/index.vue',
          },
        ],
        name: 'com.levin.contract',
        routes: [
          {
            component: {},
            meta: {
              title: '合同首页',
            },
            name: '_shared_index',
            path: '/shared/index',
          },
        ],
        title: '合同模块',
      },
    ]);

    expect(payload.menuList).toHaveLength(2);
    expect(payload.menuList.map((item) => item.moduleId)).toEqual([
      'com.levin.oak.base',
      'com.levin.contract',
    ]);
  });

  it('truncates uploaded page descriptions to the menu remark limit', () => {
    const description = '页'.repeat(513);
    const payload = buildModuleSyncMenuPayload([
      {
        backendRouteMappings: [
          {
            description,
            icon: 'lucide:file',
            name: 'Example',
            path: '/example/V1/Example',
            resource: 'Example',
            sourceFilePath: 'modules/example/views/example/index.vue',
            title: '示例页面',
            viewPath: '/system/example/example/index.vue',
          },
        ],
        name: 'com.levin.example',
        routes: [],
        title: '示例模块',
      },
    ]);

    expect(payload.menuList[0]?.remark).toHaveLength(512);
  });
});
