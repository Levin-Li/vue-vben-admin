interface UserAccessSessionStore {
  setAccessCodes(codes: []): void;
  setAccessMenus(menus: []): void;
  setAccessRoutes(routes: []): void;
  setIsAccessChecked(isAccessChecked: boolean): void;
}

export function clearPreviousUserAccessState(
  accessStore: UserAccessSessionStore,
  resetRoutes: () => void,
) {
  accessStore.setAccessCodes([]);
  accessStore.setAccessMenus([]);
  accessStore.setAccessRoutes([]);
  accessStore.setIsAccessChecked(false);
  resetRoutes();
}
