import type { CrudPageConfig } from '../shared/types';

import {
  FILE_STORAGE_MULTI_UPLOAD_PATH,
  FILE_STORAGE_SINGLE_UPLOAD_PATH,
  fetchCrudList,
  createCrudRecord,
  updateCrudRecord,
  deleteCrudRecord,
  fetchDictOptions,
  fetchEnumOptions,
  fetchOptions,
  postCrudAction,
} from '#/api';
import { requestClient } from '#/api/request';

export const OAK_BASE_API_MODULE = '/com.levin.oak.base/V1/api';
export const DEFAULT_CRUD_MODAL_WIDTH = 'min(70vw, 1280px)';
export const DEFAULT_PERMISSION_DOMAIN = 'com.levin.oak.base';
export { FILE_STORAGE_MULTI_UPLOAD_PATH, FILE_STORAGE_SINGLE_UPLOAD_PATH };

export function buildModulePermission(
  type: string,
  action: string,
  path?: string,
  domain = DEFAULT_PERMISSION_DOMAIN,
) {
  const permissions = [`${domain}:${type}::${action}`];

  if (path) {
    permissions.push(path);
  }

  return permissions;
}

export function withModuleCrudConfig<T extends CrudPageConfig>(config: T): T {
  return {
    ...config,
    apiModuleBase: OAK_BASE_API_MODULE,
  };
}

export function withOptionSearchParams(
  defaultParams: Record<string, any>,
  searchParamName = 'containsName',
  keyword?: string,
) {
  const params = { ...defaultParams };
  const normalizedKeyword = String(keyword || '').trim();

  if (normalizedKeyword) {
    params[searchParamName] = normalizedKeyword;
  }

  return params;
}

export function buildModuleOptionsLoader(
  path: string,
  labelKey: string = 'name',
  valueKey: string = 'id',
  defaultParams: Record<string, any> = {
    pageIndex: 1,
    pageSize: 500,
  },
  searchParamName = 'containsName',
) {
  return (keyword?: string) =>
    fetchOptions(
      path,
      labelKey,
      valueKey,
      withOptionSearchParams(defaultParams, searchParamName, keyword),
      OAK_BASE_API_MODULE,
    );
}

export const buildOptionsLoader = buildModuleOptionsLoader;

export function buildModuleEnumOptionsLoader(enumName: string) {
  return () => fetchEnumOptions(enumName, OAK_BASE_API_MODULE);
}

export const buildEnumOptionsLoader = buildModuleEnumOptionsLoader;

export function buildModuleDictOptionsLoader(dictCode: string) {
  return () => fetchDictOptions(dictCode, OAK_BASE_API_MODULE);
}

export const buildDictOptionsLoader = buildModuleDictOptionsLoader;

export const moduleFetchOptions = (
  path: string,
  labelKey: string = 'name',
  valueKey: string = 'id',
  params: Record<string, any> = {},
) => fetchOptions(path, labelKey, valueKey, params, OAK_BASE_API_MODULE);

export const moduleFetchEnumOptions = (enumName: string) =>
  fetchEnumOptions(enumName, OAK_BASE_API_MODULE);

export const moduleFetchDictOptions = (dictCode: string) =>
  fetchDictOptions(dictCode, OAK_BASE_API_MODULE);

export const moduleFetchCrudList = <T>(
  listPath: string,
  params: Record<string, any> = {},
) => fetchCrudList<T>(listPath, params, OAK_BASE_API_MODULE);

export const moduleCreateCrudRecord = <T>(path: string, payload: any) =>
  createCrudRecord<T>(path, payload, OAK_BASE_API_MODULE);

export const moduleUpdateCrudRecord = <T>(path: string, payload: any) =>
  updateCrudRecord<T>(path, payload, OAK_BASE_API_MODULE);

export const moduleDeleteCrudRecord = (
  path: string,
  id: string,
  key: string = 'id',
) => deleteCrudRecord(path, id, key, OAK_BASE_API_MODULE);

export const tenantOptionsLoader = buildModuleOptionsLoader('/Tenant/list');
export const areaOptionsLoader = buildModuleOptionsLoader('/Area/list');
export const articleChannelOptionsLoader = buildModuleOptionsLoader(
  '/ArticleChannel/list',
);
export const brandOptionsLoader = buildModuleOptionsLoader('/Brand/list');
export const jobPostOptionsLoader = buildModuleOptionsLoader('/JobPost/list');
export const menuOptionsLoader = buildModuleOptionsLoader('/Menu/list');
export const payChannelOptionsLoader =
  buildModuleOptionsLoader('/PayChannel/list');
export const tenantAppOptionsLoader =
  buildModuleOptionsLoader('/TenantApp/list');
export const userOptionsLoader = buildModuleOptionsLoader('/User/list');
export const menuPageTypeOptionsLoader = buildModuleEnumOptionsLoader(
  'com.levin.oak.base.entities.Menu$PageType',
);
export const orgStateOptionsLoader = buildModuleEnumOptionsLoader(
  'com.levin.oak.base.entities.Org$State',
);
export const orgTypeOptionsLoader = buildModuleEnumOptionsLoader(
  'com.levin.oak.base.entities.Org$Type',
);
export const orgLegalSubjectTypeOptionsLoader = buildModuleEnumOptionsLoader(
  'com.levin.oak.base.entities.Org$LegalSubjectType',
);
export const orgIndustriesOptionsLoader = buildModuleDictOptionsLoader(
  'com.levin.oak.base.entities.Org.industries',
);
export const orgLevelOptionsLoader = buildModuleDictOptionsLoader(
  'com.levin.oak.base.entities.Org.level',
);
export const orgCategoryOptionsLoader = buildModuleDictOptionsLoader(
  'com.levin.oak.base.entities.Org.category',
);
export const confidentialLevelOptionsLoader = buildModuleEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
export const nationCodeOptionsLoader =
  buildModuleDictOptionsLoader('NationCode');
export const currencyCodeOptionsLoader =
  buildModuleDictOptionsLoader('CurrencyCode');
export const languageCodeOptionsLoader =
  buildModuleDictOptionsLoader('LanguageCode');
export const payChannelTypeOptionsLoader =
  buildModuleDictOptionsLoader('PayChannel.type');
export const payChannelAgentCodeOptionsLoader = buildModuleDictOptionsLoader(
  'PayChannel.agentCode',
);

export const roleOptionsLoader = (keyword?: string) =>
  fetchOptions(
    '/Role/listUserRoleCode',
    'label',
    'value',
    withOptionSearchParams(
      {
        codeForKey: false,
        pageIndex: 1,
        pageSize: 500,
      },
      'containsName',
      keyword,
    ),
    OAK_BASE_API_MODULE,
  );

export const orgOptionsLoader = () =>
  fetchOptions(
    '/rbac/authorizedOrgList',
    'name',
    'id',
    {
      assembleTree: false,
    },
    OAK_BASE_API_MODULE,
  );

interface TenantSiteProvider {
  name?: string;
  supportedDomainSuffixes?: string[];
}

const tenantSiteCapabilityState: {
  publicIp: string;
  publicIpLoaded: boolean;
  suffixesLoaded: boolean;
  suffixOptions: Array<{ label: string; value: string }>;
  suffixVendorMap: Record<string, string>;
  vendorOptions: Array<{ label: string; value: string }>;
} = {
  publicIp: '',
  publicIpLoaded: false,
  suffixOptions: [],
  suffixVendorMap: {},
  suffixesLoaded: false,
  vendorOptions: [],
};

async function loadTenantSiteSuffixOptions() {
  if (tenantSiteCapabilityState.suffixesLoaded) {
    return tenantSiteCapabilityState.suffixOptions;
  }

  const providers = await requestClient.get<TenantSiteProvider[]>(
    `${OAK_BASE_API_MODULE}/TenantSite/availableSuffixes`,
    {
      baseURL: '',
    },
  );

  const suffixOptions: Array<{ label: string; value: string }> = [];
  const vendorOptions: Array<{ label: string; value: string }> = [];

  for (const provider of providers || []) {
    const vendorName = provider.name || '未知供应商';
    vendorOptions.push({
      label: vendorName,
      value: vendorName,
    });

    for (const rawSuffix of provider.supportedDomainSuffixes || []) {
      const suffix = rawSuffix.startsWith('.') ? rawSuffix : `.${rawSuffix}`;
      tenantSiteCapabilityState.suffixVendorMap[suffix] = vendorName;
      suffixOptions.push({
        label: `${suffix} (${vendorName})`,
        value: suffix,
      });
    }
  }

  tenantSiteCapabilityState.suffixOptions = suffixOptions;
  tenantSiteCapabilityState.vendorOptions = vendorOptions;
  tenantSiteCapabilityState.suffixesLoaded = true;

  return suffixOptions;
}

export const tenantSiteSuffixOptionsLoader = async () =>
  await loadTenantSiteSuffixOptions();

export const tenantSiteVendorOptionsLoader = async () => {
  if (!tenantSiteCapabilityState.suffixesLoaded) {
    await loadTenantSiteSuffixOptions();
  }

  return tenantSiteCapabilityState.vendorOptions;
};

export function getTenantSiteSuffixVendor(suffix?: string) {
  return suffix ? tenantSiteCapabilityState.suffixVendorMap[suffix] : '';
}

export async function loadTenantSitePublicIp() {
  if (tenantSiteCapabilityState.publicIpLoaded) {
    return tenantSiteCapabilityState.publicIp;
  }

  tenantSiteCapabilityState.publicIp = await requestClient.get<string>(
    `${OAK_BASE_API_MODULE}/TenantSite/publicIp`,
    {
      baseURL: '',
    },
  );
  tenantSiteCapabilityState.publicIpLoaded = true;
  return tenantSiteCapabilityState.publicIp;
}

export async function modulePostCrudAction(path: string, payload?: any) {
  return postCrudAction(path, payload, OAK_BASE_API_MODULE);
}

export function moduleGet<T>(path: string, config: Record<string, any> = {}) {
  return requestClient.get<T>(`${OAK_BASE_API_MODULE}${path}`, {
    ...config,
    baseURL: '',
  });
}

export function modulePost<T>(
  path: string,
  payload?: any,
  config: Record<string, any> = {},
) {
  return requestClient.post<T>(`${OAK_BASE_API_MODULE}${path}`, payload, {
    ...config,
    baseURL: '',
  });
}

export function modulePut<T>(
  path: string,
  payload?: any,
  config: Record<string, any> = {},
) {
  return requestClient.put<T>(`${OAK_BASE_API_MODULE}${path}`, payload, {
    ...config,
    baseURL: '',
  });
}
