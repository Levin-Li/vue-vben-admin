import type { AdminPageMap } from './page-registry';

import {
  mergeAdminPageMaps,
  normalizeAdminGlobPageMap,
} from './page-registry';

const sharedPageModules = import.meta.glob('./shared/**/*.vue') as AdminPageMap;
const corePageModules = import.meta.glob('./pages/**/*.vue') as AdminPageMap;

const sharedPageMap: AdminPageMap = Object.fromEntries(
  Object.entries(sharedPageModules).map(([path, loader]) => [
    path.replace(/^\.\/shared/, '/system/shared'),
    loader,
  ]),
);

const corePageMap = normalizeAdminGlobPageMap(corePageModules, './pages');

export const adminFrameworkPageMap: AdminPageMap = mergeAdminPageMaps(
  sharedPageMap,
  corePageMap,
);
