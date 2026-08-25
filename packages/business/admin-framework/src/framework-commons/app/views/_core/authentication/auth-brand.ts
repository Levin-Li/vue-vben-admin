import { computed, readonly, ref } from 'vue';

import { preferences } from '@vben/preferences';

import {
  rbacService,
  type RbacApi,
} from '@levin/admin-framework/framework-commons/app/api/rbac-service';

import { getLoginHeroImage } from './login-hero-image';

type BrandRecord = RbacApi.TenantSiteInfo;

interface BrandState {
  copyright: string;
  domain: string;
  eyebrow: string;
  heroDesc: string;
  heroImage: string;
  titleImage: string;
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
  heroImage: '',
  titleImage: '',
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
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function getCurrentDomain() {
  return normalizeText(window.location.hostname).toLowerCase();
}

function getUiValue(record: BrandRecord | null | undefined, ...keys: string[]) {
  const uiExInfo = record?.uiExInfo;
  const stores = [
    uiExInfo,
    uiExInfo?.auth,
    uiExInfo?.brand,
    uiExInfo?.login,
    uiExInfo?.site,
  ].filter(Boolean);

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

function getNestedRecordValue(
  record: BrandRecord | null | undefined,
  nestedKey: string,
  valueKey: string,
) {
  const nested = record?.[nestedKey];
  return nested && typeof nested === 'object'
    ? normalizeText((nested as Record<string, any>)[valueKey])
    : '';
}

function getEnabledAdminUiSetting(record: BrandRecord | null | undefined) {
  const setting = record?.uiExInfo?.['admin-ui-base-setting'];
  return setting?.preferServerSetting === false ? undefined : setting?.setting;
}

function getAdminUiSettingValue(
  record: BrandRecord | null | undefined,
  section: string,
  key: string,
) {
  const sectionValue = getEnabledAdminUiSetting(record)?.[section];
  return sectionValue && typeof sectionValue === 'object'
    ? normalizeText(sectionValue[key])
    : '';
}

function getAdminUiSettingCopyright(record: BrandRecord | null | undefined) {
  const copyright = getEnabledAdminUiSetting(record)?.copyright;

  if (!copyright || copyright.enable !== true) {
    return '';
  }

  const date = normalizeText(copyright.date);
  const companyName = normalizeText(copyright.companyName);
  const icp = normalizeText(copyright.icp);
  const content = [date, companyName].filter(Boolean).join(' ');

  return [content ? `Copyright © ${content}` : '', icp]
    .filter(Boolean)
    .join(' · ');
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

async function fetchTenantSiteInfo() {
  try {
    return await rbacService.getTenantSiteInfo();
  } catch {
    return null;
  }
}

function mergeBrandState(
  record: BrandRecord | null,
  domain: string,
): BrandState {
  const siteDomain = getFirstText(
    record?.domain,
    record?.appAuthDomain,
    domain,
  );
  const name = getFirstText(
    getAdminUiSettingValue(record, 'login', 'systemName'),
    getAdminUiSettingValue(record, 'app', 'name'),
    record?.name,
    getUiValue(
      record,
      'siteName',
      'siteTitle',
      'name',
      'systemName',
      'sysName',
      'appName',
      'appTitle',
      'title',
    ),
    record?.sysName,
    getNestedRecordValue(record, 'brand', 'name'),
    defaultState.name,
  );
  const logo = getFirstText(
    getAdminUiSettingValue(record, 'login', 'systemLogo'),
    getAdminUiSettingValue(record, 'logo', 'source'),
    record?.logo,
    getUiValue(record, 'logo', 'sysLogo', 'siteLogo', 'appLogo'),
    record?.sysLogo,
    getNestedRecordValue(record, 'brand', 'logo'),
    defaultState.logo,
  );
  const shortcutIcon = getFirstText(
    record?.shortcutIcon,
    getUiValue(record, 'shortcutIcon', 'favicon', 'siteIcon', 'appIcon'),
    logo,
  );
  const techSupport = getFirstText(
    record?.techSupport,
    getUiValue(record, 'techSupport', 'support', 'supportText'),
  );
  const copyright = getFirstText(
    getAdminUiSettingCopyright(record),
    record?.copyright,
    getUiValue(record, 'copyright', 'copyrightText'),
    defaultState.copyright,
  );

  return {
    copyright,
    domain: siteDomain,
    eyebrow: getFirstText(
      siteDomain,
      getUiValue(record, 'brandName', 'eyebrow'),
      defaultState.eyebrow,
    ),
    heroDesc: getFirstText(
      getUiValue(record, 'loginDesc', 'heroDesc'),
      techSupport,
      defaultState.heroDesc,
    ),
    heroImage: getLoginHeroImage(record?.uiExInfo),
    titleImage: getAdminUiSettingValue(record, 'login', 'titleImage'),
    heroTitle: getFirstText(
      getUiValue(record, 'loginTitle', 'heroTitle'),
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
    const tenantSiteInfo = await fetchTenantSiteInfo();
    const nextState = mergeBrandState(tenantSiteInfo, domain);

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
    heroImage: computed(() => brandState.value.heroImage),
    titleImage: computed(() => brandState.value.titleImage),
    heroTitle: computed(() => brandState.value.heroTitle),
    loadAuthBrand,
    logo: computed(() => brandState.value.logo),
    techSupport: computed(() => brandState.value.techSupport),
  };
}
