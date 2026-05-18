const AUTH_ROUTE_PREFIX = '/auth';

export function shouldShowDraggableFloatingPanelHost(
  accessToken: null | string | undefined,
  path: string,
) {
  return Boolean(accessToken) && !isAuthenticationRoute(path);
}

function isAuthenticationRoute(path: string) {
  return path === AUTH_ROUTE_PREFIX || path.startsWith(`${AUTH_ROUTE_PREFIX}/`);
}
