import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { message } from 'ant-design-vue';

import { getAllMenusApi } from '@levin/admin-framework/framework-commons/app/api';
import { BasicLayout, IFrameView } from '@levin/admin-framework/framework-commons/app/layouts';
import { $t } from '@levin/admin-framework/framework-commons/app/locales';
import { getAdminPageMap, resolveAdminPage } from '@levin/admin-framework/framework-commons/app/pages';

const forbiddenComponent = resolveAdminPage('/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      message.loading({
        content: `${$t('common.loadingMenu')}...`,
        duration: 1.5,
      });
      return await getAllMenusApi();
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap: getAdminPageMap(),
  });
}

export { generateAccess };
