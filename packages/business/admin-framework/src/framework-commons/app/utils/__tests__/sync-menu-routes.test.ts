import type { RouteRecordRaw } from 'vue-router';

import { describe, expect, it } from 'vitest';

import {
  buildModuleSyncMenuPayload,
  buildSyncMenuPayload,
} from '../sync-menu-routes';

describe('buildSyncMenuPayload', () => {
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
            name: 'User',
            path: 'user',
          },
          {
            component: {},
            meta: {
              hideInMenu: true,
              title: '隐藏页面',
            },
            name: 'Hidden',
            path: 'hidden',
          },
          {
            component: {},
            meta: {
              link: 'https://example.com',
              title: '外链',
            },
            name: 'Link',
            path: 'link',
          },
        ],
        meta: {
          icon: 'lucide:settings',
          title: '系统管理',
        },
        name: 'System',
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
              remark: 'User',
            },
          ],
          icon: 'lucide:settings',
          label: '系统管理',
          moduleId: 'com.levin.oak.base',
          path: '/system',
          remark: 'System',
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
            name: 'UserCrudPage',
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
                name: 'User',
                path: '/clob/V1/User',
              },
            ],
            meta: {
              icon: 'lucide:database',
              title: '基础模块',
            },
            name: 'OakBase',
            path: '/oak-base',
          },
        ],
        title: '基础模块',
      },
      {
        backendRouteMappings: [
          {
            icon: 'lucide:file-text',
            name: 'ContractCrudPage',
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
              remark: 'User',
              sourceFilePath: 'modules/com_levin_oak_base/views/user/index.vue',
              viewPath: '/system/com_levin_oak_base/user/index.vue',
            },
          ],
          icon: 'lucide:database',
          label: '基础模块',
          moduleId: 'com.levin.oak.base',
          path: '/oak-base',
          remark: 'OakBase',
        },
        {
          children: [],
          icon: 'lucide:file-text',
          label: '合同管理',
          moduleId: 'com.levin.contract',
          path: '/contract/V1/Contract',
          remark: 'ContractCrudPage',
          sourceFilePath: 'modules/com_levin_contract/views/contract/index.vue',
          viewPath: '/system/com_levin_contract/contract/index.vue',
        },
      ],
    });
  });
});
