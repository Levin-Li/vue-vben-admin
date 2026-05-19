import type { RouteRecordRaw } from 'vue-router';

import { $t } from '@levin/admin-framework/framework-commons/app/locales';
import { resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'ic:baseline-view-in-ar',
      keepAlive: true,
      order: 1000,
      title: $t('demos.title'),
    },
    name: 'Demos',
    path: '/demos',
    children: [
      {
        meta: {
          title: $t('demos.antd'),
        },
        name: 'AntDesignDemos',
        path: '/demos/ant-design',
        component: resolveAdminPage('/demos/antd/index.vue'),
      },
      {
        meta: {
          title: $t('demos.publicComponents'),
        },
        name: 'PublicComponentDemos',
        path: '/demos/public-components',
        redirect: '/demos/public-components/user-org-selector',
        children: [
          {
            meta: {
              title: $t('demos.userOrgSelector'),
            },
            name: 'UserOrgSelectorDemos',
            path: '/demos/public-components/user-org-selector',
            component: resolveAdminPage('/demos/public-components/index.vue'),
          },
          {
            meta: {
              title: $t('demos.permissions'),
            },
            name: 'PermissionDemos',
            path: '/demos/public-components/permissions',
            component: resolveAdminPage('/demos/public-components/permissions.vue'),
          },
        ],
      },
    ],
  },
];

export default routes;
