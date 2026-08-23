export type AdminPageLoader = () => Promise<any>;
export type AdminPageMap = Record<string, AdminPageLoader>;

/**
 * 从完整路由路径生成内部唯一标识。
 *
 * 路径是路由的唯一来源，保留路径其余字符，仅将每个斜杠替换为下划线。
 */
export function toPathRouteName(path: string): string {
  return path.replaceAll('/', '_');
}

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

export function defineAdminPageOverrides(
  pageMap: AdminPageMap,
  sourcePrefix = './pages',
): AdminPageMap {
  return normalizeAdminGlobPageMap(pageMap, sourcePrefix);
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
