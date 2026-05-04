import type { RouteRecordRaw } from 'vue-router';

import { describe, expect, it } from 'vitest';

import { buildSyncMenuPayload } from '../sync-menu-routes';

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
});
