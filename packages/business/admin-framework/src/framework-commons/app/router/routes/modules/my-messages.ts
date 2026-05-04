import type { RouteRecordRaw } from 'vue-router';

import { resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';

const routes: RouteRecordRaw[] = [
  {
    component: resolveAdminPage(
      '/system/com_levin_oak_base/my-messages/index.vue',
    ),
    meta: {
      hideInMenu: true,
      icon: 'lucide:bell',
      title: '我的消息',
    },
    name: 'MyMessages',
    path: '/clob/V1/MyMessages',
  },
];

export default routes;
