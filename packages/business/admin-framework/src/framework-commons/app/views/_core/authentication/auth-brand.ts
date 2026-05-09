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
  const stores = [record?.uiExInfo].filter(Boolean);

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
  const name = getFirstText(
    getUiValue(record, 'systemName', 'sysName', 'appName', 'name'),
    record?.sysName,
    record?.name,
    defaultState.name,
  );
  const logo = getFirstText(
    getUiValue(record, 'logo', 'sysLogo'),
    record?.sysLogo,
    record?.logo,
    defaultState.logo,
  );
  const shortcutIcon = getFirstText(
    getUiValue(record, 'shortcutIcon', 'favicon'),
    record?.shortcutIcon,
    logo,
  );
  const techSupport = getFirstText(
    record?.techSupport,
    getUiValue(record, 'techSupport', 'support', 'supportText'),
  );
  const copyright = getFirstText(
    record?.copyright,
    getUiValue(record, 'copyright'),
    `Copyright © ${currentYear} ${name} · 多租户后台管理平台`,
  );

  return {
    copyright,
    domain: getFirstText(record?.domain, domain),
    eyebrow: getFirstText(
      getUiValue(record, 'brandName', 'eyebrow'),
      record?.domain,
      domain,
      defaultState.eyebrow,
    ),
    heroDesc: getFirstText(
      getUiValue(record, 'loginDesc', 'heroDesc'),
      techSupport,
      defaultState.heroDesc,
    ),
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
    heroTitle: computed(() => brandState.value.heroTitle),
    loadAuthBrand,
    logo: computed(() => brandState.value.logo),
    techSupport: computed(() => brandState.value.techSupport),
  };
}
