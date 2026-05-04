export type AdminPageLoader = () => Promise<any>;
export type AdminPageMap = Record<string, AdminPageLoader>;

export function mergeAdminPageMaps(...pageMaps: AdminPageMap[]): AdminPageMap {
  return Object.assign({}, ...pageMaps);
}

export function normalizeAdminGlobPageMap(
  pageMap: AdminPageMap,
  sourcePrefix: string,
): AdminPageMap {
  const normalizedPrefix = sourcePrefix.replace(/\/$/, '');

  return Object.fromEntries(
    Object.entries(pageMap).map(([path, loader]) => [
      path
        .replace(normalizedPrefix, '')
        .replace(/^\./, '')
        .replaceAll(/\/+/g, '/'),
      loader,
    ]),
  );
}

export function createAdminPageResolver(pageMap: AdminPageMap) {
  return (pagePath: string, fallback?: AdminPageLoader): AdminPageLoader => {
    const normalizedPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
    const loader = pageMap[normalizedPath];
    if (loader) {
      return loader;
    }

    if (fallback) {
      return fallback;
    }

    throw new Error(`Admin page is not registered: ${normalizedPath}`);
  };
}
