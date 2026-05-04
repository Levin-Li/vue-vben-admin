import { computed, readonly, ref } from 'vue';

import { preferences } from '@vben/preferences';

import { buildModuleRequestPath } from '@levin/admin-framework/framework-commons/app/api';
import { baseRequestClient } from '@levin/admin-framework/framework-commons/app/api/request';

interface BrandRecord {
  appAuthDomain?: null | string;
  copyright?: null | string;
  domain?: null | string;
  exInfo?: null | Record<string, any>;
  id?: null | string;
  logo?: null | string;
  name?: null | string;
  shortcutIcon?: null | string;
  sysLogo?: null | string;
  sysName?: null | string;
  techSupport?: null | string;
  tenantId?: null | string;
  uiExInfo?: null | Record<string, any>;
}

interface BrandState {
  copyright: string;
  domain: string;
  eyebrow: string;
  heroDesc: string;
  heroTitle: string;
  loaded: boolean;
  loading: boolean;
  logo: string;
  name: string;
  shortcutIcon: string;
  techSupport: string;
}

const currentYear = new Date().getFullYear();
const defaultState: BrandState = {
  copyright: `Copyright © ${currentYear} ${preferences.app.name} · 多租户后台管理平台`,
  domain: '',
  eyebrow: 'Framework Base',
  heroDesc: '工程化、高性能、跨组件库的前端模版',
  heroTitle: '开箱即用的大型中后台管理系统',
  loaded: false,
  loading: false,
  logo: preferences.logo.source,
  name: preferences.app.name,
  shortcutIcon: preferences.logo.source,
  techSupport: '',
};

const brandState = ref<BrandState>({ ...defaultState });
let loadingPromise: null | Promise<void> = null;

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function getCurrentDomain() {
  return normalizeText(window.location.hostname).toLowerCase();
}

function getUiValue(record: BrandRecord | null | undefined, ...keys: string[]) {
  const stores = [record?.uiExInfo, record?.exInfo].filter(Boolean);

  for (const store of stores) {
    for (const key of keys) {
      const value = normalizeText(store?.[key]);
      if (value) {
        return value;
      }
    }
  }

  return '';
}

function getFirstText(...values: unknown[]) {
  return values.map((value) => normalizeText(value)).find(Boolean) || '';
}

function getListItems(data: any): BrandRecord[] {
  const items = Array.isArray(data)
    ? data
    : data?.items || data?.records || data?.list || data?.data || [];

  return Array.isArray(items) ? items.filter(Boolean) : [];
}

async function requestList(path: string, params: Record<string, any>) {
  try {
    return await baseRequestClient.get<any>(buildModuleRequestPath(path), {
      __silentError: true,
      baseURL: '',
      params: {
        requireResultList: true,
        requireTotals: true,
        ...params,
      },
    } as any);
  } catch {
    return null;
  }
}

async function fetchTenantSiteByDomain(domain: string) {
  if (!domain) {
    return null;
  }

  const data = await requestList('/TenantSite/list', {
    domain,
    enable: true,
    pageIndex: 1,
    pageSize: 1,
  });

  return getListItems(data)[0] || null;
}

async function fetchTenantFallback(site: BrandRecord | null, domain: string) {
  const tenantId = normalizeText(site?.tenantId);

  if (tenantId) {
    const data = await requestList('/Tenant/list', {
      id: tenantId,
      pageIndex: 1,
      pageSize: 1,
    });
    const tenant = getListItems(data)[0];
    if (tenant) {
      return tenant;
    }
  }

  if (!domain) {
    return null;
  }

  const data = await requestList('/Tenant/list', {
    appAuthDomain: domain,
    enable: true,
    pageIndex: 1,
    pageSize: 1,
  });

  return getListItems(data)[0] || null;
}

function updateFavicon(shortcutIcon: string) {
  if (!shortcutIcon) {
    return;
  }

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.append(link);
  }

  link.href = shortcutIcon;
}

function mergeBrandState(
  site: BrandRecord | null,
  tenant: BrandRecord | null,
  domain: string,
): BrandState {
  const name = getFirstText(
    getUiValue(site, 'systemName', 'sysName', 'appName', 'name'),
    site?.name,
    getUiValue(tenant, 'systemName', 'sysName', 'appName', 'name'),
    tenant?.sysName,
    tenant?.name,
    defaultState.name,
  );
  const logo = getFirstText(
    getUiValue(site, 'logo', 'sysLogo'),
    site?.logo,
    getUiValue(tenant, 'logo', 'sysLogo'),
    tenant?.sysLogo,
    tenant?.logo,
    defaultState.logo,
  );
  const shortcutIcon = getFirstText(
    getUiValue(site, 'shortcutIcon', 'favicon'),
    site?.shortcutIcon,
    getUiValue(tenant, 'shortcutIcon', 'favicon'),
    tenant?.shortcutIcon,
    logo,
  );
  const techSupport = getFirstText(
    site?.techSupport,
    getUiValue(site, 'techSupport', 'support', 'supportText'),
    tenant?.techSupport,
    getUiValue(tenant, 'techSupport', 'support', 'supportText'),
  );
  const copyright = getFirstText(
    site?.copyright,
    getUiValue(site, 'copyright'),
    tenant?.copyright,
    getUiValue(tenant, 'copyright'),
    `Copyright © ${currentYear} ${name} · 多租户后台管理平台`,
  );

  return {
    copyright,
    domain,
    eyebrow: getFirstText(
      getUiValue(site, 'brandName', 'eyebrow'),
      getUiValue(tenant, 'brandName', 'eyebrow'),
      domain,
      defaultState.eyebrow,
    ),
    heroDesc: getFirstText(
      getUiValue(site, 'loginDesc', 'heroDesc'),
      getUiValue(tenant, 'loginDesc', 'heroDesc'),
      techSupport,
      defaultState.heroDesc,
    ),
    heroTitle: getFirstText(
      getUiValue(site, 'loginTitle', 'heroTitle'),
      getUiValue(tenant, 'loginTitle', 'heroTitle'),
      name,
      defaultState.heroTitle,
    ),
    loaded: true,
    loading: false,
    logo,
    name,
    shortcutIcon,
    techSupport,
  };
}

async function loadAuthBrand() {
  if (brandState.value.loading) {
    return loadingPromise;
  }

  if (brandState.value.loaded) {
    return;
  }

  brandState.value = {
    ...brandState.value,
    domain: getCurrentDomain(),
    loading: true,
  };

  loadingPromise = (async () => {
    const domain = getCurrentDomain();
    const site = await fetchTenantSiteByDomain(domain);
    const tenant = await fetchTenantFallback(site, domain);
    const nextState = mergeBrandState(site, tenant, domain);

    brandState.value = nextState;
    updateFavicon(nextState.shortcutIcon);
  })().finally(() => {
    loadingPromise = null;
    brandState.value = {
      ...brandState.value,
      loaded: true,
      loading: false,
    };
  });

  return loadingPromise;
}

export function useAuthBrand() {
  return {
    appName: computed(() => brandState.value.name),
    brand: readonly(brandState),
    copyright: computed(() => brandState.value.copyright),
    heroDesc: computed(() => brandState.value.heroDesc),
    heroTitle: computed(() => brandState.value.heroTitle),
    loadAuthBrand,
    logo: computed(() => brandState.value.logo),
    techSupport: computed(() => brandState.value.techSupport),
  };
}
