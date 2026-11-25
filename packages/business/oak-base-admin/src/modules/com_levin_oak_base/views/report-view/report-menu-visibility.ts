/** 只移除当前独立报表路由，保留其他菜单及其原有层级。 */
export function omitReportMenu<T extends { children?: T[]; path: string }>(menus: T[], path: string): T[] {
  if (!path.startsWith('/menu/')) return menus;
  return menus.filter((menu) => menu.path !== path).map((menu) => {
    if (!menu.children?.length) return menu;
    const children = omitReportMenu(menu.children, path);
    return { ...menu, children };
  });
}
