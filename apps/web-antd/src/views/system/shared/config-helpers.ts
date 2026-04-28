import { fetchDictOptions, fetchEnumOptions, fetchOptions } from '#/api';
import { requestClient } from '#/api/request';

export const DEFAULT_CRUD_MODAL_WIDTH = 'min(70vw, 1280px)';

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

export function buildOptionsLoader(
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
    );
}

export function buildEnumOptionsLoader(enumName: string) {
  return () => fetchEnumOptions(enumName);
}

export function buildDictOptionsLoader(dictCode: string) {
  return () => fetchDictOptions(dictCode);
}

export const tenantOptionsLoader = buildOptionsLoader('/Tenant/list');
export const areaOptionsLoader = buildOptionsLoader('/Area/list');
export const articleChannelOptionsLoader = buildOptionsLoader(
  '/ArticleChannel/list',
);
export const brandOptionsLoader = buildOptionsLoader('/Brand/list');
export const jobPostOptionsLoader = buildOptionsLoader('/JobPost/list');
export const menuOptionsLoader = buildOptionsLoader('/Menu/list');
export const payChannelOptionsLoader = buildOptionsLoader('/PayChannel/list');
export const tenantAppOptionsLoader = buildOptionsLoader('/TenantApp/list');
export const userOptionsLoader = buildOptionsLoader('/User/list');
export const menuPageTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Menu$PageType',
);
export const orgStateOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Org$State',
);
export const orgTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Org$Type',
);
export const orgLegalSubjectTypeOptionsLoader = buildEnumOptionsLoader(
  'com.levin.oak.base.entities.Org$LegalSubjectType',
);
export const orgIndustriesOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.Org.industries',
);
export const orgLevelOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.Org.level',
);
export const orgCategoryOptionsLoader = buildDictOptionsLoader(
  'com.levin.oak.base.entities.Org.category',
);
export const confidentialLevelOptionsLoader = buildEnumOptionsLoader(
  'com.levin.commons.rbac.ConfidentialLevel',
);
export const nationCodeOptionsLoader = buildDictOptionsLoader('NationCode');
export const currencyCodeOptionsLoader = buildDictOptionsLoader('CurrencyCode');
export const languageCodeOptionsLoader = buildDictOptionsLoader('LanguageCode');

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
  );

export const orgOptionsLoader = () =>
  fetchOptions('/rbac/authorizedOrgList', 'name', 'id', {
    assembleTree: false,
  });

export async function loadEnumValueOptions(enumName: string) {
  return await fetchEnumOptions(enumName);
}

export async function loadDictValueOptions(dictCode: string) {
  return await fetchDictOptions(dictCode);
}

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
    '/TenantSite/availableSuffixes',
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
    '/TenantSite/publicIp',
  );
  tenantSiteCapabilityState.publicIpLoaded = true;
  return tenantSiteCapabilityState.publicIp;
}
