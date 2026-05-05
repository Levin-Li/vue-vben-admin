import type { RouteRecordRaw } from 'vue-router';

import { resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      hideInMenu: true,
      title: '数据权限分配预览',
    },
    name: 'DataPermissionPreview',
    path: '/system/com_levin_oak_base/data-permission-preview',
    component: resolveAdminPage(
      '/system/com_levin_oak_base/data-permission-preview/index.vue',
    ),
  },
];

export default routes;
