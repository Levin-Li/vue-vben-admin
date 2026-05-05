import {
  adminFrameworkPageMap,
  collectAdminModulePageMap,
  createAdminPageResolver,
  mergeAdminPageMaps,
  normalizeAdminGlobPageMap,
  type AdminPageMap,
} from '@levin/admin-framework';

import {
  getAdminPageOverrides,
  getEnabledFrontendModules,
} from './options';

const builtinAppPages = normalizeAdminGlobPageMap(
  import.meta.glob('./views/**/*.vue') as AdminPageMap,
  './views',
);

export function getAdminPageMap() {
  return mergeAdminPageMaps(
    adminFrameworkPageMap,
    collectAdminModulePageMap(getEnabledFrontendModules()),
    builtinAppPages,
    getAdminPageOverrides(),
  );
}

export function resolveAdminPage(pagePath: string) {
  return createAdminPageResolver(getAdminPageMap())(pagePath);
}
