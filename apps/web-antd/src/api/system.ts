import { encodeUrlParamValue } from '#/api/common/url-encoding';
import { requestClient } from '#/api/request';

export interface CrudListQuery {
  [key: string]: any;
  pageIndex?: number;
  pageSize?: number;
}

export interface CrudListResult<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totals: number;
}

export interface SelectOption {
  [key: string]: any;
  children?: SelectOption[];
  disabled?: boolean;
  label: string;
  value: boolean | number | string;
}

interface EnumInfo {
  fullName?: string;
  name?: string;
  options?: any[];
}

const enumInfoCacheMap = new Map<string, Record<string, EnumInfo>>();
const enumInfoCachePromiseMap = new Map<
  string,
  Promise<Record<string, EnumInfo>>
>();

function getOptionLabel(item: any, labelKey: string, valueKey: string) {
  return (
    item[labelKey] ?? item.name ?? item.code ?? item[valueKey] ?? String(item)
  );
}

function normalizeListResult<T>(data: any): CrudListResult<T> {
  if (Array.isArray(data)) {
    return {
      items: data,
      pageIndex: 1,
      pageSize: data.length || 10,
      totals: data.length,
    };
  }

  return {
    items: data?.items || data?.records || data?.list || [],
    pageIndex: data?.pageIndex ?? data?.current ?? data?.pageNo ?? 1,
    pageSize: data?.pageSize ?? data?.size ?? 10,
    totals: data?.totals ?? data?.total ?? data?.count ?? 0,
  };
}

function normalizeOptions(
  data: any,
  labelKey: string = 'name',
  valueKey: string = 'id',
): SelectOption[] {
  if (Array.isArray(data)) {
    return data.filter(Boolean).map((item) => ({
      label: getOptionLabel(item, labelKey, valueKey),
      value: item[valueKey] ?? item.id ?? item.code ?? String(item),
    }));
  }

  if (data && typeof data === 'object') {
    return Object.entries(data).map(([label, value]) => ({
      label,
      value: String(value),
    }));
  }

  return [];
}

function normalizeTreeOptions(
  data: any,
  labelKey: string = 'name',
  valueKey: string = 'id',
): SelectOption[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(Boolean).map((item) => {
    const children =
      item.children || item.childList || item.subList || item.orgList || [];
    const option: SelectOption = {
      label: getOptionLabel(item, labelKey, valueKey),
      value: item[valueKey] ?? item.id ?? item.code ?? String(item),
    };

    if (Array.isArray(children) && children.length > 0) {
      option.children = normalizeTreeOptions(children, labelKey, valueKey);
    }

    return option;
  });
}

function normalizeModuleBase(moduleBase?: string) {
  const normalized = String(moduleBase || '')
    .trim()
    .replace(/\/$/, '');
  return normalized;
}

export function buildModuleRequestPath(path: string, moduleBase?: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedModuleBase = normalizeModuleBase(moduleBase);

  if (!normalizedModuleBase) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith(normalizedModuleBase)) {
    return normalizedPath;
  }

  return `${normalizedModuleBase}${normalizedPath}`;
}

function getEnumCacheKey(moduleBase?: string) {
  return normalizeModuleBase(moduleBase) || '__default__';
}

export async function fetchCrudList<T>(
  listPath: string,
  params: CrudListQuery = {},
  moduleBase?: string,
) {
  const requestParams = {
    requireResultList: true,
    requireTotals: true,
    ...params,
  };
  const data = await requestClient.get<any>(
    buildModuleRequestPath(listPath, moduleBase),
    {
      params: requestParams,
      baseURL: '',
    },
  );

  return normalizeListResult<T>(data);
}

export async function createCrudRecord<T>(
  path: string,
  payload: any,
  moduleBase?: string,
) {
  return requestClient.post<T>(
    buildModuleRequestPath(path, moduleBase),
    payload,
    {
      baseURL: '',
    },
  );
}

export async function updateCrudRecord<T>(
  path: string,
  payload: any,
  moduleBase?: string,
) {
  return requestClient.put<T>(
    buildModuleRequestPath(path, moduleBase),
    payload,
    {
      baseURL: '',
    },
  );
}

export async function deleteCrudRecord(
  path: string,
  id: string,
  key: string = 'id',
  moduleBase?: string,
) {
  return requestClient.delete(buildModuleRequestPath(path, moduleBase), {
    baseURL: '',
    params: { [key]: id },
  });
}

export async function postCrudAction<T>(
  path: string,
  payload?: any,
  moduleBase?: string,
) {
  return requestClient.post<T>(
    buildModuleRequestPath(path, moduleBase),
    payload ?? {},
    {
      baseURL: '',
    },
  );
}

export async function fetchOptions(
  path: string,
  labelKey: string = 'name',
  valueKey: string = 'id',
  params: Record<string, any> = {},
  moduleBase?: string,
) {
  const data = await requestClient.get<any>(
    buildModuleRequestPath(path, moduleBase),
    {
      baseURL: '',
      params,
    },
  );

  return normalizeOptions(data?.items || data, labelKey, valueKey);
}

export async function fetchTreeOptions(
  path: string,
  labelKey: string = 'name',
  valueKey: string = 'id',
  params: Record<string, any> = {},
  moduleBase?: string,
) {
  const data = await requestClient.get<any>(
    buildModuleRequestPath(path, moduleBase),
    {
      baseURL: '',
      params,
    },
  );

  return normalizeTreeOptions(data?.items || data, labelKey, valueKey);
}

async function fetchAllEnumInfo(moduleBase?: string) {
  const cacheKey = getEnumCacheKey(moduleBase);
  const cachedEnumInfo = enumInfoCacheMap.get(cacheKey);

  if (cachedEnumInfo) {
    return cachedEnumInfo;
  }

  if (!enumInfoCachePromiseMap.has(cacheKey)) {
    enumInfoCachePromiseMap.set(
      cacheKey,
      requestClient
        .get<Record<string, EnumInfo>>(
          buildModuleRequestPath('/enums', moduleBase),
          {
            baseURL: '',
            __silentError: true,
          } as any,
        )
        .then((data) => {
          const nextCache = data || {};
          enumInfoCacheMap.set(cacheKey, nextCache);
          return nextCache;
        })
        .catch(() => {
          enumInfoCachePromiseMap.delete(cacheKey);
          enumInfoCacheMap.set(cacheKey, {});
          return {};
        }),
    );
  }

  const enumInfoCachePromise = enumInfoCachePromiseMap.get(cacheKey);
  if (!enumInfoCachePromise) {
    return {};
  }

  return enumInfoCachePromise;
}

async function fetchSingleEnumInfo(enumName: string, moduleBase?: string) {
  const cacheKey = getEnumCacheKey(moduleBase);
  const data = await requestClient.get<EnumInfo>(
    buildModuleRequestPath(
      `/enums?enumName=${encodeUrlParamValue(enumName)}`,
      moduleBase,
    ),
    {
      baseURL: '',
    },
  );

  const cachedEnumInfo = enumInfoCacheMap.get(cacheKey) || {};
  cachedEnumInfo[enumName] = data;

  if (data?.fullName) {
    cachedEnumInfo[data.fullName] = data;
  }

  enumInfoCacheMap.set(cacheKey, cachedEnumInfo);
  return data;
}

export async function fetchEnumOptions(enumName: string, moduleBase?: string) {
  const enumInfoMap = await fetchAllEnumInfo(moduleBase);
  const cachedEnumInfo =
    enumInfoMap[enumName] ||
    Object.values(enumInfoMap).find((item) => item.fullName === enumName);
  const enumInfo =
    cachedEnumInfo || (await fetchSingleEnumInfo(enumName, moduleBase));

  return normalizeOptions(enumInfo?.options || [], 'label', 'value');
}

export async function fetchDictOptions(dictCode: string, moduleBase?: string) {
  const data = await requestClient.get<any>(
    buildModuleRequestPath('/Dict/retrieveByCode', moduleBase),
    {
      baseURL: '',
      params: {
        code: dictCode,
      },
    },
  );

  return normalizeOptions(data?.itemList || [], 'name', 'code');
}
