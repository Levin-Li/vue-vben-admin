import type { AdminPageMap } from '@levin/admin-framework';

const viewModules = import.meta.glob('./views/**/*.vue') as AdminPageMap;

export const oakBaseAdminPageMap: AdminPageMap = Object.fromEntries(
  Object.entries(viewModules).map(([path, loader]) => [
    path.replace(/^\.\/views/, '/system/com_levin_oak_base'),
    loader,
  ]),
);
