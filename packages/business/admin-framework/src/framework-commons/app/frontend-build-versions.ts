import { getEnabledFrontendModules } from './options';

export interface FrontendBuildVersion {
  category: '应用' | '已启用模块' | '构建依赖' | '运行依赖';
  id: string;
  name: string;
  version: string;
}

export interface FrontendBuildMetadata {
  buildTime?: string;
  dependencies?: Record<string, string | undefined>;
  devDependencies?: Record<string, string | undefined>;
  version?: string;
}

export interface FrontendBuildInfo {
  buildTime: string;
  versions: FrontendBuildVersion[];
}

declare const __VBEN_ADMIN_METADATA__: FrontendBuildMetadata | undefined;

function normalizeText(value: unknown, fallback: string) {
  const text = String(value || '').trim();
  return text || fallback;
}

function toDependencyVersions(
  dependencies: Record<string, string | undefined>,
  category: '构建依赖' | '运行依赖',
) {
  return Object.entries(dependencies)
    .map(([name, version]) => ({
      category,
      id: name,
      name,
      version: normalizeText(version, '未声明'),
    }))
    .toSorted((left, right) => left.name.localeCompare(right.name));
}

function readBuildMetadata() {
  return typeof __VBEN_ADMIN_METADATA__ === 'undefined'
    ? undefined
    : __VBEN_ADMIN_METADATA__;
}

export function getFrontendBuildInfo(
  applicationName: string,
  applicationVersion: string,
  metadata: FrontendBuildMetadata | undefined = readBuildMetadata(),
): FrontendBuildInfo {
  return {
    buildTime: normalizeText(metadata?.buildTime, '开发模式'),
    versions: [
      {
        category: '应用',
        id: 'application',
        name: normalizeText(applicationName, '当前应用'),
        version: normalizeText(
          applicationVersion || metadata?.version,
          '未声明',
        ),
      },
      ...getEnabledFrontendModules()
        .map((module) => ({
          category: '已启用模块' as const,
          id: normalizeText(module.name, '未声明模块'),
          name: normalizeText(module.title, module.name || '未命名模块'),
          version: normalizeText(module.version, '未声明'),
        }))
        .toSorted((left, right) =>
          left.name.localeCompare(right.name, 'zh-CN'),
        ),
      ...toDependencyVersions(metadata?.dependencies || {}, '运行依赖'),
      ...toDependencyVersions(metadata?.devDependencies || {}, '构建依赖'),
    ],
  };
}
