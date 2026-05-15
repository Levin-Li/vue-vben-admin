const ROOT_HOME_PATH = '/index';
const LAST_VISITED_PATH_KEY = 'levin-admin-framework-root-last-visited-path';
const IGNORED_RESTORE_PATH_PREFIXES = ['/auth/'];
const IGNORED_RESTORE_PATHS = new Set(['/', '/auth']);

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

function rememberLastVisitedPath(fullPath: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  const restorePath = normalizeRestorePath(fullPath);
  if (restorePath) {
    window.sessionStorage.setItem(LAST_VISITED_PATH_KEY, restorePath);
  }
}

function resolveRootRedirectPath(defaultHomePath: string) {
  const normalizedPath = defaultHomePath.trim();
  return normalizedPath && normalizedPath !== '/'
    ? normalizedPath
    : readLastVisitedPath() || ROOT_HOME_PATH;
}

export { rememberLastVisitedPath, ROOT_HOME_PATH, resolveRootRedirectPath };
