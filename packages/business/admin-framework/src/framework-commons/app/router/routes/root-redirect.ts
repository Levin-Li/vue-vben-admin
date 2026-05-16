const ROOT_HOME_PATH = '/index';
const LAST_VISITED_PATH_KEY = 'levin-admin-framework-root-last-visited-path';
const FALLBACK_NOT_FOUND_ROUTE_NAME = 'FallbackNotFound';
const IGNORED_RESTORE_PATH_PREFIXES = ['/auth/'];
const IGNORED_RESTORE_PATHS = new Set(['/', '/auth']);

type RouteName = null | string | symbol | undefined;

interface RestorableRouteLike {
  fullPath?: unknown;
  matched?: Array<{ name?: RouteName }>;
  name?: RouteName;
}

interface RouteResolverLike {
  resolve: (path: string) => RestorableRouteLike;
}

function isRouteLike(route: unknown): route is RestorableRouteLike {
  return typeof route === 'object' && route !== null;
}

function isFallbackNotFoundRoute(route: unknown) {
  if (!isRouteLike(route)) {
    return false;
  }

  if (route.name === FALLBACK_NOT_FOUND_ROUTE_NAME) {
    return true;
  }

  return route.matched?.some(
    (matchedRoute) => matchedRoute.name === FALLBACK_NOT_FOUND_ROUTE_NAME,
  );
}

function getRouteFullPath(routeOrPath: unknown) {
  if (isRouteLike(routeOrPath) && typeof routeOrPath.fullPath === 'string') {
    return routeOrPath.fullPath;
  }

  return routeOrPath;
}

function normalizeRestorePath(rawPath: unknown) {
  if (typeof window === 'undefined') {
    return '';
  }

  if (typeof rawPath !== 'string') {
    return '';
  }

  const trimmedPath = rawPath.trim();
  if (
    !trimmedPath ||
    !trimmedPath.startsWith('/') ||
    trimmedPath.startsWith('//')
  ) {
    return '';
  }

  try {
    const url = new URL(trimmedPath, window.location.origin);
    if (url.origin !== window.location.origin) {
      return '';
    }

    const path = `${url.pathname}${url.search}${url.hash}`;
    if (
      IGNORED_RESTORE_PATHS.has(path) ||
      IGNORED_RESTORE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
    ) {
      return '';
    }

    return path;
  } catch {
    return '';
  }
}

function readLastVisitedPath() {
  if (typeof window === 'undefined') {
    return '';
  }

  return normalizeRestorePath(
    window.sessionStorage.getItem(LAST_VISITED_PATH_KEY),
  );
}

function rememberLastVisitedPath(routeOrPath: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  if (isFallbackNotFoundRoute(routeOrPath)) {
    return;
  }

  const restorePath = normalizeRestorePath(getRouteFullPath(routeOrPath));
  if (restorePath) {
    window.sessionStorage.setItem(LAST_VISITED_PATH_KEY, restorePath);
  }
}

function resolveRestorablePath(
  rawPath: unknown,
  routeResolver?: RouteResolverLike,
  fallbackPath = ROOT_HOME_PATH,
) {
  const restorePath = normalizeRestorePath(rawPath);
  if (!restorePath) {
    return fallbackPath;
  }

  if (!routeResolver) {
    return restorePath;
  }

  try {
    return isFallbackNotFoundRoute(routeResolver.resolve(restorePath))
      ? fallbackPath
      : restorePath;
  } catch {
    return fallbackPath;
  }
}

function resolveRootRedirectPath(defaultHomePath: string) {
  const normalizedPath = defaultHomePath.trim();
  return normalizedPath && normalizedPath !== '/'
    ? normalizedPath
    : readLastVisitedPath() || ROOT_HOME_PATH;
}

export {
  rememberLastVisitedPath,
  ROOT_HOME_PATH,
  resolveRestorablePath,
  resolveRootRedirectPath,
};
