import { computed, readonly, ref } from 'vue';

import { preferences } from '@vben/preferences';

import {
  rbacService,
  type RbacApi,
} from '@levin/admin-framework/framework-commons/app/api/rbac-service';

type BrandRecord = RbacApi.TenantSiteInfo;

interface BrandState {
  copyright: string;
  domain: string;
  eyebrow: string;
  heroDesc: string;
  heroImage: string;
  heroImageCandidates: string[];
  titleImage: string;
  titleImageCandidates: string[];
  heroTitle: string;
  loaded: boolean;
  loading: boolean;
  logo: string;
  logoCandidates: string[];
  name: string;
  shortcutIcon: string;
  techSupport: string;
}

const defaultState: BrandState = {
  copyright: '',
  domain: '',
  eyebrow: 'Framework Base',
  heroDesc: '工程化、高性能、跨组件库的前端模版',
  heroImage: '',
  heroImageCandidates: [],
  titleImage: '',
  titleImageCandidates: [],
  heroTitle: '开箱即用的大型中后台管理系统',
  loaded: false,
  loading: false,
  logo: preferences.logo.source,
  logoCandidates: [preferences.logo.source].filter(Boolean),
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

function getFirstText(...values: unknown[]) {
  return values.map((value) => normalizeText(value)).find(Boolean) || '';
}

/**
 * The server has already applied the TenantSite → Brand → Tenant fallback.
 * Only null may use the browser's built-in presentation default; an empty
 * string is an explicit clearing value and must not be replaced here.
 */
function resolveSiteInfoText(value: unknown, defaultValue = '') {
  return value === null || value === undefined
    ? defaultValue
    : normalizeText(value);
}

function getSiteInfoImageCandidates(value: unknown, defaultValue?: string) {
  if (value === null || value === undefined) {
    return defaultValue ? [defaultValue] : [];
  }

  const normalizedValue = normalizeText(value);
  return normalizedValue ? [normalizedValue] : [];
}

function updateFavicon(shortcutIcon: string) {
  if (!shortcutIcon) {
    document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.remove();
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
  const siteInfo = record?.siteInfo;
  const siteDomain = getFirstText(record?.domain, record?.appAuthDomain, domain);
  const name = getFirstText(siteInfo?.title, record?.name, defaultState.name);
  const logoCandidates = getSiteInfoImageCandidates(siteInfo?.logo, defaultState.logo);
  const heroImageCandidates = getSiteInfoImageCandidates(siteInfo?.mainImg);
  const titleImageCandidates = getSiteInfoImageCandidates(siteInfo?.titleImg);
  const logo = resolveSiteInfoText(siteInfo?.logo, defaultState.logo);
  const shortcutIcon = resolveSiteInfoText(
    siteInfo?.shortcutIcon,
    defaultState.shortcutIcon,
  );
  const techSupport = resolveSiteInfoText(siteInfo?.techSupport);
  const copyright = resolveSiteInfoText(siteInfo?.copyright);

  return {
    copyright,
    domain: siteDomain,
    eyebrow: getFirstText(siteDomain, defaultState.eyebrow),
    heroDesc:
      siteInfo?.techSupport === null || siteInfo?.techSupport === undefined
        ? defaultState.heroDesc
        : techSupport,
    heroImage: heroImageCandidates[0] || '',
    heroImageCandidates,
    titleImage: titleImageCandidates[0] || '',
    titleImageCandidates,
    heroTitle:
      siteInfo?.title === null || siteInfo?.title === undefined
        ? defaultState.heroTitle
        : name,
    loaded: true,
    loading: false,
    logo,
    logoCandidates,
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

async function refreshAuthBrand() {
  brandState.value = {
    ...brandState.value,
    loaded: false,
  };
  await loadAuthBrand();
}


export function useAuthBrand() {
  return {
    appName: computed(() => brandState.value.name),
    brand: readonly(brandState),
    copyright: computed(() => brandState.value.copyright),
    heroDesc: computed(() => brandState.value.heroDesc),
    heroImage: computed(() => brandState.value.heroImage),
    heroImageCandidates: computed(() => brandState.value.heroImageCandidates),
    titleImage: computed(() => brandState.value.titleImage),
    titleImageCandidates: computed(() => brandState.value.titleImageCandidates),
    heroTitle: computed(() => brandState.value.heroTitle),
    loadAuthBrand,
    logo: computed(() => brandState.value.logo),
    logoCandidates: computed(() => brandState.value.logoCandidates),
    refreshAuthBrand,
    techSupport: computed(() => brandState.value.techSupport),
  };
}
