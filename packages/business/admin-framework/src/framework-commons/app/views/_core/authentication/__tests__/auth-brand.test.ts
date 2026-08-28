import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTenantSiteInfo: vi.fn(),
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      name: 'Levin Main App',
    },
    logo: {
      source: '/logo.svg',
    },
  },
}));

vi.mock(
  '@levin/admin-framework/framework-commons/app/api/rbac-service',
  () => ({
    rbacService: {
      getTenantSiteInfo: mocks.getTenantSiteInfo,
    },
  }),
);

async function loadBrand(tenantSiteInfo: any) {
  vi.resetModules();
  mocks.getTenantSiteInfo.mockReset();
  mocks.getTenantSiteInfo.mockResolvedValueOnce(tenantSiteInfo);
  window.history.pushState({}, '', '/auth/login');

  const { useAuthBrand } = await import('../auth-brand');
  const brand = useAuthBrand();

  await brand.loadAuthBrand();

  return brand;
}

describe('auth brand tenant site mapping', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('uses tenant site values for the login brand and copyright', async () => {
    const brand = await loadBrand({
      domain: 'tenant.example.com',
      siteInfo: {
        copyright: 'Copyright © 2026 Tenant Portal',
        logo: '/tenant-logo.svg',
        shortcutIcon: '/tenant-favicon.ico',
        title: '租户门户',
      },
    });

    expect(brand.brand.value.eyebrow).toBe('tenant.example.com');
    expect(brand.brand.value.domain).toBe('tenant.example.com');
    expect(brand.appName.value).toBe('租户门户');
    expect(brand.logo.value).toBe('/tenant-logo.svg');
    expect(brand.brand.value.shortcutIcon).toBe('/tenant-favicon.ico');
    expect(brand.copyright.value).toBe('Copyright © 2026 Tenant Portal');
  });

  it('keeps the current defaults when the merged site info is absent', async () => {
    const brand = await loadBrand({
      domain: '',
    });

    expect(brand.brand.value.eyebrow).toBe('localhost');
    expect(brand.brand.value.domain).toBe('localhost');
    expect(brand.appName.value).toBe('Levin Main App');
    expect(brand.logo.value).toBe('/logo.svg');
    expect(brand.brand.value.shortcutIcon).toBe('/logo.svg');
    expect(brand.copyright.value).toBe('');
  });

  it('does not synthesize copyright from a site title when copyright is empty', async () => {
    const brand = await loadBrand({
      domain: 'tenant.example.com',
      siteInfo: {
        copyright: '',
        title: '租户门户',
      },
    });

    expect(brand.appName.value).toBe('租户门户');
    expect(brand.copyright.value).toBe('');
  });

  it('reads the login illustration from the tenant site main image', async () => {
    const brand = await loadBrand({
      siteInfo: { mainImg: '/tenant-login-hero.png' },
    });

    expect(brand.heroImage.value).toBe('/tenant-login-hero.png');
  });

  it('uses tenant site copyright for the login footer', async () => {
    const brand = await loadBrand({
      siteInfo: { copyright: 'Copyright © 2026 Levin · ICP备案号' },
    });

    expect(brand.copyright.value).toBe('Copyright © 2026 Levin · ICP备案号');
  });

  it('uses tenant site title and logo for the login name and logo', async () => {
    const brand = await loadBrand({
      siteInfo: {
        logo: '/tenant-logo.svg',
        title: '站点标题',
      },
    });

    expect(brand.appName.value).toBe('站点标题');
    expect(brand.logo.value).toBe('/tenant-logo.svg');
  });

  it('uses merged site info before legacy fields and never reads the brand object', async () => {
    const brand = await loadBrand({
      brand: { name: '不应使用的品牌名称' },
      logo: '/legacy-logo.svg',
      siteInfo: {
        logo: '/site-info-logo.svg',
        title: '站点展示标题',
      },
      title: '旧标题',
    });

    expect(brand.appName.value).toBe('站点展示标题');
    expect(brand.logo.value).toBe('/site-info-logo.svg');
  });

  it('reads all login-brand settings from merged site info', async () => {
    const brand = await loadBrand({
      siteInfo: {
        logo: '/login-logo.png',
        mainImg: '/login-hero.png',
        title: '登录站点',
        titleImg: '/login-title.png',
      },
    });

    expect(brand.appName.value).toBe('登录站点');
    expect(brand.heroImage.value).toBe('/login-hero.png');
    expect(brand.logo.value).toBe('/login-logo.png');
    expect(brand.titleImage.value).toBe('/login-title.png');
  });

  it('falls back to site branding when interface settings are disabled', async () => {
    const brand = await loadBrand({
      siteInfo: {
        logo: '/tenant-logo.svg',
        title: '租户门户',
      },
      uiExInfo: {
        'admin-ui-base-setting': {
          preferServerSetting: false,
          setting: {
            app: { name: '界面设置名称' },
            logo: { source: '/interface-settings-logo.svg' },
          },
        },
      },
    });

    expect(brand.appName.value).toBe('租户门户');
    expect(brand.logo.value).toBe('/tenant-logo.svg');
  });

  it('does not use UI settings over the tenant site branding', async () => {
    const brand = await loadBrand({
      siteInfo: { title: '站点名称' },
      uiExInfo: {
        'admin-ui-base-setting': {
          setting: {
            login: { systemName: 'UI 设置名称' },
          },
        },
      },
    });

    expect(brand.appName.value).toBe('站点名称');
  });

  it('uses only the tenant site main image candidate', async () => {
    const brand = await loadBrand({
      siteInfo: { mainImg: '/tenant-site-hero.png' },
    });

    expect(brand.heroImageCandidates.value).toEqual(['/tenant-site-hero.png']);
  });

});
