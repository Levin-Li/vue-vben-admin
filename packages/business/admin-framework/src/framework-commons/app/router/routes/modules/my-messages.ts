import type { RouteRecordRaw } from 'vue-router';

import { resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';

import { toPathRouteName } from '../../../../page-registry';

const path = '/clob/V1/MyMessages';
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
    name: toPathRouteName(path),
    path,
  },
];

export default routes;
