import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/runtime/types';

import { generateAccessible } from '@vben/runtime/access';

import { preferences } from '@vben-core/foundation/preferences';

import { collectAdminModuleBackendRouteMappings } from '@levin/admin-framework';
import { getAllMenusApi } from '@levin/admin-framework/framework-commons/app/api';
import {
  BasicLayout,
  IFrameView,
  RouteView,
} from '@levin/admin-framework/framework-commons/app/layouts';
import { $t } from '@levin/admin-framework/framework-commons/app/locales';
import { getEnabledFrontendModules } from '@levin/admin-framework/framework-commons/app/options';
import {
  getAdminPageMap,
  resolveAdminPage,
} from '@levin/admin-framework/framework-commons/app/pages';
import { message } from 'ant-design-vue';

import { groupAccessibleMenus } from './menu-display-groups';

const forbiddenComponent = resolveAdminPage('/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
    RouteView,
  };

  const result = await generateAccessible(preferences.app.accessMode, {
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
  return {
    ...result,
    accessibleMenus: groupAccessibleMenus(
      result.accessibleMenus,
      collectAdminModuleBackendRouteMappings(getEnabledFrontendModules()),
      result.accessibleRoutes,
    ),
  };
}

export { generateAccess };
