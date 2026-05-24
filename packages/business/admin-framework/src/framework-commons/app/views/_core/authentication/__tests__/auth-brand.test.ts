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

vi.mock('@levin/admin-framework/framework-commons/app/api/rbac-service', () => ({
  rbacService: {
    getTenantSiteInfo: mocks.getTenantSiteInfo,
  },
}));

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
});
