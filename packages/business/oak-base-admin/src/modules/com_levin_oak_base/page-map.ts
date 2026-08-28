import type { AdminPageMap } from '@levin/admin-framework';

const viewModules = import.meta.glob('./views/**/*.vue') as AdminPageMap;

const pageMap: AdminPageMap = Object.fromEntries(
  Object.entries(viewModules).map(([path, loader]) => [
    path.replace(/^\.\/views/, '/system/com_levin_oak_base'),
    loader,
  ]),
);

/**
 * 兼容已同步到服务端的短实体名路由。新同步使用 backend-route-mappings 的完整领域目录，
 * 已存在菜单仍能在前端热更新后立即访问，不需要等待服务端重启或菜单重建。
 */
const CONTRACT_VIEW_ALIASES: Readonly<Record<string, string>> = {
  '/system/com_levin_oak_base/e-contract/index.vue':
    '/system/com_levin_oak_base/electronic-contract/index.vue',
  '/system/com_levin_oak_base/e-contract-template/index.vue':
    '/system/com_levin_oak_base/electronic-contract-template/index.vue',
};

for (const [alias, source] of Object.entries(CONTRACT_VIEW_ALIASES)) {
  const loader = pageMap[source];
  if (loader) {
    pageMap[alias] = loader;
  }
}

export const oakBaseAdminPageMap: AdminPageMap = pageMap;
