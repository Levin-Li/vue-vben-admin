interface MenuLoadFailureAccessStore {
  setAccessMenus(menus: []): void;
  setAccessRoutes(routes: []): void;
  setIsAccessChecked(isAccessChecked: boolean): void;
}

/**
 * 服务端菜单不可用时保留当前登录会话，但绝不保留或回退展示任何菜单。
 * 标记本次启动已尝试加载，避免同一次路由跳转循环请求；下一次冷启动会重置。
 */
function keepSessionWithoutMenus(accessStore: MenuLoadFailureAccessStore) {
  accessStore.setAccessMenus([]);
  accessStore.setAccessRoutes([]);
  accessStore.setIsAccessChecked(true);
}

export { keepSessionWithoutMenus };
