import type { SelectOption } from '#/api';
import type {
  DomainDnsRecord,
  DomainRecord,
} from '#/api/com_levin_oak_base/domain';
import type { CrudPageConfig } from '../shared/types';
import type {
  TenantSiteOption,
  TenantSiteProvider,
} from './tenant-site-capability';

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
} from '#/api';
import { requestClient } from '#/api/request';

import { buildTenantSiteCapabilityOptions } from './tenant-site-capability';

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
export const domainOptionsLoader = buildModuleOptionsLoader(
  '/Domain/list',
  'name',
  'name',
);
export const tenantSiteDnsDomainOptionsLoader = async () => {
  const rootDomains = await moduleFetchCrudList<DomainRecord>('/Domain/list', {
    enable: true,
    pageIndex: 1,
    pageSize: 500,
  });
  const optionMap = new Map<string, SelectOption>();

  await Promise.all(
    rootDomains.items
      .filter((domain) => domain?.id && domain?.name && domain.enable !== false)
      .map(async (domain) => {
        const rootDomain = String(domain.name || '')
          .trim()
          .replace(/\.$/, '');

        if (!rootDomain || !isProviderManagedDomain(rootDomain)) {
          return;
        }

        optionMap.set(rootDomain, {
          label: rootDomain,
          value: rootDomain,
        });

        for (const record of domain.dnsRecords || []) {
          const fullDomain = getDnsRecordFullDomain(rootDomain, record);

          if (!fullDomain || !canUseAsTenantSiteDomain(record)) {
            continue;
          }

          optionMap.set(fullDomain, {
            label: fullDomain,
            value: fullDomain,
          });
        }
      }),
  );

  return [...optionMap.values()].sort((left, right) =>
    String(left.label).localeCompare(String(right.label)),
  );
};
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

function canUseAsTenantSiteDomain(record: DomainDnsRecord) {
  const recordType = String(record?.recordType || '').toUpperCase();
  return (
    (recordType === 'A' || recordType === 'CNAME') && record.enable !== false
  );
}

function isProviderManagedDomain(domain: string) {
  const host = normalizeDomainHost(domain);

  return Boolean(
    host && host.includes('.') && !isLocalHostDomain(host) && !isIpAddress(host),
  );
}

function isLocalHostDomain(domain: string) {
  const host = normalizeDomainHost(domain);
  return host === 'localhost' || host.endsWith('.localhost');
}

function isIpAddress(domain: string) {
  const host = normalizeDomainHost(domain);

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return host.split('.').every((part) => {
      const value = Number(part);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
  }

  return host.includes(':');
}

function normalizeDomainHost(domain: string) {
  let host = String(domain || '')
    .trim()
    .toLowerCase();

  try {
    host = new URL(host.includes('://') ? host : `http://${host}`).hostname;
  } catch {
    host = host.split('/')[0] || '';
  }

  return host.replace(/^\[(.*)]$/, '$1').replace(/\.$/, '');
}

function getDnsRecordFullDomain(rootDomain: string, record: DomainDnsRecord) {
  const host = String(record?.host || '')
    .trim()
    .replace(/\.$/, '');

  if (!host || host === '@') {
    return rootDomain;
  }

  if (host === rootDomain || host.endsWith(`.${rootDomain}`)) {
    return host;
  }

  return `${host}.${rootDomain}`;
}

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

const tenantSiteCapabilityState: {
  loadSuffixesPromise: null | Promise<TenantSiteOption[]>;
  loadSslRenewBeforeDaysPromise: null | Promise<number>;
  publicIp: string;
  publicIpLoaded: boolean;
  sslRenewBeforeDays: number;
  sslRenewBeforeDaysLoaded: boolean;
  suffixApplyApiMap: Record<string, string>;
  suffixDomainRenewBeforeDaysMap: Record<string, number>;
  suffixesLoaded: boolean;
  suffixOptions: TenantSiteOption[];
  suffixVendorMap: Record<string, string>;
  vendorApplyApiMap: Record<string, string>;
  vendorDomainRenewBeforeDaysMap: Record<string, number>;
  vendorOptions: TenantSiteOption[];
  vendorSuffixOptionsMap: Record<string, TenantSiteOption[]>;
} = {
  loadSuffixesPromise: null,
  loadSslRenewBeforeDaysPromise: null,
  publicIp: '',
  publicIpLoaded: false,
  sslRenewBeforeDays: 30,
  sslRenewBeforeDaysLoaded: false,
  suffixApplyApiMap: {},
  suffixDomainRenewBeforeDaysMap: {},
  suffixOptions: [],
  suffixVendorMap: {},
  suffixesLoaded: false,
  vendorApplyApiMap: {},
  vendorDomainRenewBeforeDaysMap: {},
  vendorOptions: [],
  vendorSuffixOptionsMap: {},
};

async function loadTenantSiteSuffixOptions() {
  if (tenantSiteCapabilityState.suffixesLoaded) {
    return tenantSiteCapabilityState.suffixOptions;
  }

  if (tenantSiteCapabilityState.loadSuffixesPromise) {
    return tenantSiteCapabilityState.loadSuffixesPromise;
  }

  tenantSiteCapabilityState.loadSuffixesPromise =
    doLoadTenantSiteSuffixOptions().finally(() => {
      tenantSiteCapabilityState.loadSuffixesPromise = null;
    });
  return tenantSiteCapabilityState.loadSuffixesPromise;
}

async function doLoadTenantSiteSuffixOptions() {
  let providers: TenantSiteProvider[] = [];

  try {
    providers = await requestClient.get<TenantSiteProvider[]>(
      `${OAK_BASE_API_MODULE}/Domain/availableSuffixes`,
      {
        baseURL: '',
      },
    );
  } catch {
    providers = [];
  }

  const capabilityOptions = buildTenantSiteCapabilityOptions(providers || []);

  tenantSiteCapabilityState.suffixApplyApiMap =
    capabilityOptions.suffixApplyApiMap;
  tenantSiteCapabilityState.suffixDomainRenewBeforeDaysMap =
    capabilityOptions.suffixDomainRenewBeforeDaysMap;
  tenantSiteCapabilityState.suffixOptions = capabilityOptions.suffixOptions;
  tenantSiteCapabilityState.suffixVendorMap = capabilityOptions.suffixVendorMap;
  tenantSiteCapabilityState.vendorApplyApiMap =
    capabilityOptions.vendorApplyApiMap;
  tenantSiteCapabilityState.vendorDomainRenewBeforeDaysMap =
    capabilityOptions.vendorDomainRenewBeforeDaysMap;
  tenantSiteCapabilityState.vendorOptions = capabilityOptions.vendorOptions;
  tenantSiteCapabilityState.vendorSuffixOptionsMap =
    capabilityOptions.vendorSuffixOptionsMap;
  tenantSiteCapabilityState.suffixesLoaded = true;

  return tenantSiteCapabilityState.suffixOptions;
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

export function getTenantSiteSuffixApplyApi(suffix?: string) {
  return suffix ? tenantSiteCapabilityState.suffixApplyApiMap[suffix] : '';
}

export function getTenantSiteVendorApplyApi(vendor?: string) {
  return vendor ? tenantSiteCapabilityState.vendorApplyApiMap[vendor] : '';
}

export function getTenantSiteVendorDomainRenewBeforeDays(vendor?: string) {
  return vendor
    ? (tenantSiteCapabilityState.vendorDomainRenewBeforeDaysMap[vendor] ?? 30)
    : 30;
}

export function getTenantSiteSuffixDomainRenewBeforeDays(suffix?: string) {
  return suffix
    ? (tenantSiteCapabilityState.suffixDomainRenewBeforeDaysMap[suffix] ?? 30)
    : 30;
}

export async function loadTenantSiteSslRenewBeforeDays() {
  if (tenantSiteCapabilityState.sslRenewBeforeDaysLoaded) {
    return tenantSiteCapabilityState.sslRenewBeforeDays;
  }

  if (tenantSiteCapabilityState.loadSslRenewBeforeDaysPromise) {
    return tenantSiteCapabilityState.loadSslRenewBeforeDaysPromise;
  }

  tenantSiteCapabilityState.loadSslRenewBeforeDaysPromise = requestClient
    .get<number>(`${OAK_BASE_API_MODULE}/Domain/sslRenewBeforeDays`, {
      baseURL: '',
    })
    .then((days) => {
      const normalizedDays = Number(days);
      tenantSiteCapabilityState.sslRenewBeforeDays =
        Number.isFinite(normalizedDays) && normalizedDays >= 0
          ? normalizedDays
          : 30;
      tenantSiteCapabilityState.sslRenewBeforeDaysLoaded = true;
      return tenantSiteCapabilityState.sslRenewBeforeDays;
    })
    .finally(() => {
      tenantSiteCapabilityState.loadSslRenewBeforeDaysPromise = null;
    });

  return tenantSiteCapabilityState.loadSslRenewBeforeDaysPromise;
}

export function getTenantSiteSslRenewBeforeDays() {
  return tenantSiteCapabilityState.sslRenewBeforeDays;
}

export function getTenantSiteVendorSuffixOptions(vendor?: string) {
  if (!vendor) {
    return tenantSiteCapabilityState.suffixOptions;
  }

  return tenantSiteCapabilityState.vendorSuffixOptionsMap[vendor] || [];
}

export async function loadTenantSitePublicIp() {
  if (tenantSiteCapabilityState.publicIpLoaded) {
    return tenantSiteCapabilityState.publicIp;
  }

  tenantSiteCapabilityState.publicIp = await requestClient.get<string>(
    `${OAK_BASE_API_MODULE}/Domain/publicIp`,
    {
      baseURL: '',
    },
  );
  tenantSiteCapabilityState.publicIpLoaded = true;
  return tenantSiteCapabilityState.publicIp;
}

export async function modulePostCrudAction(
  path: string,
  payload?: any,
  config: Record<string, any> = {},
) {
  return requestClient.post(`${OAK_BASE_API_MODULE}${path}`, payload ?? {}, {
    ...config,
    baseURL: '',
  });
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
