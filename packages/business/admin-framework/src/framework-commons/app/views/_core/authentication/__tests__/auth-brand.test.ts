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

const currentYear = new Date().getFullYear();
const defaultCopyright = `Copyright © ${currentYear} Levin Main App · 多租户后台管理平台`;

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
      copyright: 'Copyright © 2026 Tenant Portal',
      domain: 'tenant.example.com',
      logo: '/tenant-logo.svg',
      name: '租户门户',
      shortcutIcon: '/tenant-favicon.ico',
    });

    expect(brand.brand.value.eyebrow).toBe('tenant.example.com');
    expect(brand.brand.value.domain).toBe('tenant.example.com');
    expect(brand.appName.value).toBe('租户门户');
    expect(brand.logo.value).toBe('/tenant-logo.svg');
    expect(brand.brand.value.shortcutIcon).toBe('/tenant-favicon.ico');
    expect(brand.copyright.value).toBe('Copyright © 2026 Tenant Portal');
  });

  it('keeps the current defaults when tenant site fields are blank', async () => {
    const brand = await loadBrand({
      copyright: ' ',
      domain: '',
      logo: ' ',
      name: ' ',
      shortcutIcon: '',
    });

    expect(brand.brand.value.eyebrow).toBe('localhost');
    expect(brand.brand.value.domain).toBe('localhost');
    expect(brand.appName.value).toBe('Levin Main App');
    expect(brand.logo.value).toBe('/logo.svg');
    expect(brand.brand.value.shortcutIcon).toBe('/logo.svg');
    expect(brand.copyright.value).toBe(defaultCopyright);
  });

  it('does not synthesize copyright from a tenant site name when copyright is empty', async () => {
    const brand = await loadBrand({
      copyright: '',
      domain: 'tenant.example.com',
      name: '租户门户',
    });

    expect(brand.appName.value).toBe('租户门户');
    expect(brand.copyright.value).toBe(defaultCopyright);
  });

  it('reads the login illustration from the merged admin UI setting', async () => {
    const brand = await loadBrand({
      uiExInfo: {
        'admin-ui-base-setting': {
          setting: {
            login: {
              heroImage: '/tenant-login-hero.png',
            },
          },
        },
      },
    });

    expect(brand.heroImage.value).toBe('/tenant-login-hero.png');
  });

  it('uses the enabled interface-settings copyright for the login footer', async () => {
    const brand = await loadBrand({
      uiExInfo: {
        'admin-ui-base-setting': {
          setting: {
            copyright: {
              companyName: 'Levin',
              date: '2026',
              enable: true,
              icp: 'ICP备案号',
            },
          },
        },
      },
    });

    expect(brand.copyright.value).toBe('Copyright © 2026 Levin · ICP备案号');
  });

  it('uses enabled interface settings for the login name and logo', async () => {
    const brand = await loadBrand({
      logo: '/tenant-logo.svg',
      name: '租户门户',
      uiExInfo: {
        'admin-ui-base-setting': {
          preferServerSetting: true,
          setting: {
            app: { name: '界面设置名称' },
            logo: { source: '/interface-settings-logo.svg' },
          },
        },
      },
    });

    expect(brand.appName.value).toBe('界面设置名称');
    expect(brand.logo.value).toBe('/interface-settings-logo.svg');
  });

  it('reads all login-brand settings from the merged interface setting', async () => {
    const brand = await loadBrand({
      uiExInfo: {
        'admin-ui-base-setting': {
          setting: {
            login: {
              heroImage: '/login-hero.png',
              systemLogo: '/login-logo.png',
              systemName: '登录站点',
              titleImage: '/login-title.png',
            },
          },
        },
      },
    });

    expect(brand.appName.value).toBe('登录站点');
    expect(brand.heroImage.value).toBe('/login-hero.png');
    expect(brand.logo.value).toBe('/login-logo.png');
    expect(brand.titleImage.value).toBe('/login-title.png');
  });

  it('falls back to site branding when interface settings are disabled', async () => {
    const brand = await loadBrand({
      logo: '/tenant-logo.svg',
      name: '租户门户',
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
});
