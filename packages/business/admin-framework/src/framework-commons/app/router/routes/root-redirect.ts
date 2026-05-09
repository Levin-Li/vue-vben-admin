const ROOT_HOME_PATH = '/index';

function resolveRootRedirectPath(defaultHomePath: string) {
  const normalizedPath = defaultHomePath.trim();
  return normalizedPath && normalizedPath !== '/'
    ? normalizedPath
    : ROOT_HOME_PATH;
}

export { ROOT_HOME_PATH, resolveRootRedirectPath };
