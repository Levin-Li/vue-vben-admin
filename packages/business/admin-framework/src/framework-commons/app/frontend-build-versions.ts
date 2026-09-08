import { packageVersion } from '../../../package-version.mjs';
import { frameworkDependencyPackages } from './framework-package-metadata';
import { getEnabledFrontendModules } from './options';

export interface FrontendBuildVersion {
  buildTime: string;
  category: '公共依赖' | '基础业务包' | '框架';
  id: string;
  name: string;
  version: string;
}

export function getFrontendBuildInfo(): { versions: FrontendBuildVersion[] } {
  const modulePackages = getEnabledFrontendModules()
    .flatMap((module) => (module.packageInfo ? [module.packageInfo] : []))
    .filter((info) => /^@(?:levin|vben|vben-core)\//.test(info.name));
  const packages = [
    { ...packageVersion, category: '框架' as const },
    ...modulePackages.map((pkg) => ({
      ...pkg,
      category: '基础业务包' as const,
    })),
    ...frameworkDependencyPackages.map((pkg) => ({
      ...pkg,
      category: '公共依赖' as const,
    })),
  ];

  return {
    versions: [
      ...new Map(
        packages.map((pkg) => [
          `${pkg.name}@${pkg.version}`,
          { ...pkg, id: pkg.name },
        ]),
      ).values(),
    ],
  };
}
