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
      '页面路由缺少完整映射：/example/V1/Example。请在 backendRouteMappings 中提供 viewPath 和 sourceFilePath。',
    );
  });

  it('rejects incomplete module page mappings', () => {
    expect(() =>
      buildModuleSyncMenuPayload([
        {
          backendRouteMappings: [
            {
              icon: 'lucide:file',
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
      '页面映射不完整：/example/V1/Example。必须同时提供 viewPath 和 sourceFilePath。',
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
              path: '/system/user',
              remark: '_system_user',
            },
          ],
          icon: 'lucide:settings',
          label: '系统管理',
          moduleId: 'com.levin.oak.base',
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
            icon: 'lucide:user',
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
            icon: 'lucide:file-text',
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
              path: '/clob/V1/User',
              remark: '_clob_V1_User',
              sourceFilePath: 'modules/com_levin_oak_base/views/user/index.vue',
              viewPath: '/system/com_levin_oak_base/user/index.vue',
            },
          ],
          icon: 'lucide:database',
          label: '基础模块',
          moduleId: 'com.levin.oak.base',
          path: '/oak-base',
          remark: '_oak-base',
        },
        {
          children: [],
          icon: 'lucide:file-text',
          label: '合同管理',
          moduleId: 'com.levin.contract',
          path: '/contract/V1/Contract',
          remark: '_contract_V1_Contract',
          sourceFilePath: 'modules/com_levin_contract/views/contract/index.vue',
          viewPath: '/system/com_levin_contract/contract/index.vue',
        },
      ],
    });
  });

  it('deduplicates uploaded menu items by module id and path', () => {
    const payload = buildModuleSyncMenuPayload([
      {
        backendRouteMappings: [
          {
            icon: 'lucide:home',
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
            icon: 'lucide:home',
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
            icon: 'lucide:home',
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
            icon: 'lucide:home',
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
});
