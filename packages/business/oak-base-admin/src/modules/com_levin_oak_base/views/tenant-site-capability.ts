export interface TenantSiteProvider {
  domainApplyApi?: string;
  domainRenewBeforeDays?: number;
  name?: string;
  supportedDomainSuffixes?: string[];
}

export type TenantSiteOption = { label: string; value: string };

export interface TenantSiteCapabilityOptions {
  suffixApplyApiMap: Record<string, string>;
  suffixDomainRenewBeforeDaysMap: Record<string, number>;
  suffixOptions: TenantSiteOption[];
  suffixVendorMap: Record<string, string>;
  vendorApplyApiMap: Record<string, string>;
  vendorDomainRenewBeforeDaysMap: Record<string, number>;
  vendorOptions: TenantSiteOption[];
  vendorSuffixOptionsMap: Record<string, TenantSiteOption[]>;
}

function normalizeRenewBeforeDays(value: unknown, fallback = 30) {
  const days = Number(value);
  return Number.isFinite(days) && days >= 0 ? days : fallback;
}

export function buildTenantSiteCapabilityOptions(
  providers: TenantSiteProvider[],
): TenantSiteCapabilityOptions {
  const suffixOptions: TenantSiteOption[] = [];
  const vendorOptions: TenantSiteOption[] = [];
  const vendorNames = new Set<string>();
  const suffixOptionKeys = new Set<string>();
  const suffixApplyApiMap: Record<string, string> = {};
  const suffixDomainRenewBeforeDaysMap: Record<string, number> = {};
  const suffixVendorMap: Record<string, string> = {};
  const vendorApplyApiMap: Record<string, string> = {};
  const vendorDomainRenewBeforeDaysMap: Record<string, number> = {};
  const vendorSuffixOptionKeys: Record<string, Set<string>> = {};
  const vendorSuffixOptionsMap: Record<string, TenantSiteOption[]> = {};

  for (const provider of providers || []) {
    const vendorName = provider.name || '未知供应商';
    const domainRenewBeforeDays = normalizeRenewBeforeDays(
      provider.domainRenewBeforeDays,
    );
    const vendorSuffixOptions: TenantSiteOption[] = [];
    const vendorSuffixKeys =
      vendorSuffixOptionKeys[vendorName] ||
      (vendorSuffixOptionKeys[vendorName] = new Set<string>());

    if (!vendorNames.has(vendorName)) {
      vendorOptions.push({
        label: vendorName,
        value: vendorName,
      });
      vendorNames.add(vendorName);
    }

    if (provider.domainApplyApi) {
      vendorApplyApiMap[vendorName] = provider.domainApplyApi;
    }
    vendorDomainRenewBeforeDaysMap[vendorName] = domainRenewBeforeDays;

    for (const rawSuffix of provider.supportedDomainSuffixes || []) {
      const normalizedSuffix = rawSuffix.trim();
      const suffix = normalizedSuffix.startsWith('.')
        ? normalizedSuffix
        : `.${normalizedSuffix}`;
      const isNewSuffixOption = !suffixOptionKeys.has(suffix);
      const isNewVendorSuffixOption = !vendorSuffixKeys.has(suffix);

      if (isNewSuffixOption) {
        suffixVendorMap[suffix] = vendorName;
        suffixDomainRenewBeforeDaysMap[suffix] = domainRenewBeforeDays;
      }

      if (provider.domainApplyApi && isNewSuffixOption) {
        suffixApplyApiMap[suffix] = provider.domainApplyApi;
      }

      const option = {
        label: `${suffix} (${vendorName})`,
        value: suffix,
      };

      if (isNewSuffixOption) {
        suffixOptions.push(option);
        suffixOptionKeys.add(suffix);
      }

      if (isNewVendorSuffixOption) {
        vendorSuffixOptions.push(option);
        vendorSuffixKeys.add(suffix);
      }
    }

    vendorSuffixOptionsMap[vendorName] = [
      ...(vendorSuffixOptionsMap[vendorName] || []),
      ...vendorSuffixOptions,
    ];
  }

  return {
    suffixApplyApiMap,
    suffixDomainRenewBeforeDaysMap,
    suffixOptions,
    suffixVendorMap,
    vendorApplyApiMap,
    vendorDomainRenewBeforeDaysMap,
    vendorOptions,
    vendorSuffixOptionsMap,
  };
}
