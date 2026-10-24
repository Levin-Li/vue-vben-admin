import type { MenuRecordRaw, RouteRecordRaw } from '@vben/runtime/types';

import type { AdminBackendRouteMapping } from '../../module-contract';

type MenuGroup = NonNullable<AdminBackendRouteMapping['menuGroup']>;

/** Reorganize authorized menu leaves only. The router and its authorization tree stay intact. */
export function groupAccessibleMenus(
  menus: MenuRecordRaw[],
  mappings: AdminBackendRouteMapping[],
  routes: RouteRecordRaw[],
): MenuRecordRaw[] {
  // 只读授权后的路由索引，403、隐藏、禁用及其子页面均不参与搬移。
  const routeAccess = new Map<string, boolean>();
  const pageParents = new Set<string>();
  function indexRoutes(items: RouteRecordRaw[], visible = true) {
    for (const route of items) {
      const allowed =
        visible &&
        !route.meta?.hideInMenu &&
        !route.meta?.disabled &&
        !route.meta?.menuVisibleWithForbidden &&
        !route.meta?.menuRouteForbidden;
      routeAccess.set(
        route.path,
        (routeAccess.get(route.path) ?? true) && allowed,
      );
      if (
        route.component ||
        route.meta?.preserveComponentWhenChildren ||
        route.meta?.navigateOnClick
      ) {
        pageParents.add(route.path);
      }
      if (route.children) indexRoutes(route.children, allowed);
    }
  }
  indexRoutes(routes);

  // 克隆菜单树，收集已启用模块明确声明的展示归属，不创建页面。
  const result = menus.map((menu) => cloneMenu(menu));
  const groups = new Map<string, { config: MenuGroup; paths: Set<string> }>();
  for (const mapping of mappings) {
    if (!mapping.menuGroup) continue;
    const { menuGroup } = mapping;
    const key = `${menuGroup.parentPath}\n${menuGroup.path}`;
    const group = groups.get(key) ?? {
      config: menuGroup,
      paths: new Set<string>(),
    };
    group.paths.add(mapping.path);
    groups.set(key, group);
  }

  for (const { config, paths } of groups.values()) {
    const parent = findVisibleMenu(result, config.parentPath);
    if (
      !parent ||
      config.path === config.parentPath ||
      routeAccess.get(config.parentPath) === false
    )
      continue;
    const existing = parent.children?.find((menu) => menu.path === config.path);
    if (
      existing &&
      (existing.show === false ||
        existing.disabled ||
        existing.navigateOnClick ||
        pageParents.has(existing.path))
    )
      continue;
    // 仅搬移已有的可见叶子菜单，保留页面元数据与原路由权限关系。
    const selected: MenuRecordRaw[] = [];
    const seen = new Set<string>();
    function takeLeaves(
      items: MenuRecordRaw[],
      visible = true,
    ): MenuRecordRaw[] {
      return items.flatMap((menu) => {
        const allowed = visible && menu.show !== false && !menu.disabled;
        if (
          allowed &&
          !menu.children?.length &&
          paths.has(menu.path) &&
          routeAccess.get(menu.path) === true
        ) {
          if (!seen.has(menu.path)) {
            selected.push(menu);
            seen.add(menu.path);
          }
          return [];
        }
        const hadChildren = !!menu.children?.length;
        if (menu.children) menu.children = takeLeaves(menu.children, allowed);
        if (
          hadChildren &&
          !menu.children?.length &&
          menu !== parent &&
          menu !== existing &&
          !menu.navigateOnClick &&
          !pageParents.has(menu.path)
        )
          return [];
        return [menu];
      });
    }
    const updated = takeLeaves(result);
    result.splice(0, result.length, ...updated);
    if (selected.length === 0) continue;
    const group: MenuRecordRaw = existing ?? {
      name: config.title,
      path: config.path,
      show: true,
      ...(config.icon ? { icon: config.icon } : {}),
      children: [],
    };
    // 更新展示树的父关系，供侧栏展开与当前位置使用，不写入路由树。
    group.parent = parent.path;
    group.parents = [...(parent.parents ?? []), parent.path];
    group.children = [...(group.children ?? []), ...selected];
    for (const child of group.children) {
      child.parent = group.path;
      child.parents = [...group.parents, group.path];
    }
    if (!existing) parent.children = [...(parent.children ?? []), group];
  }
  return result;
}

function cloneMenu(menu: MenuRecordRaw): MenuRecordRaw {
  return {
    ...menu,
    ...(menu.parents ? { parents: [...menu.parents] } : {}),
    ...(menu.children
      ? { children: menu.children.map((child) => cloneMenu(child)) }
      : {}),
  };
}

function findVisibleMenu(
  menus: MenuRecordRaw[],
  path: string,
): MenuRecordRaw | undefined {
  for (const menu of menus) {
    if (menu.show === false || menu.disabled) continue;
    if (menu.path === path) return menu;
    const child = menu.children && findVisibleMenu(menu.children, path);
    if (child) return child;
  }
}
