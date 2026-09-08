import { beforeEach, describe, expect, it, vi } from 'vitest';

import { packageVersion } from '../../../../package-version.mjs';
import { getFrontendBuildInfo } from '../frontend-build-versions';
import { configureAdminApplication } from '../options';

const { name, version, buildTime } = packageVersion;

const { dependencyPackages } = vi.hoisted(() => ({
  dependencyPackages: [] as {
    buildTime: string;
    name: string;
    version: string;
  }[],
}));

vi.mock('../framework-package-metadata', () => ({
  frameworkDependencyPackages: dependencyPackages,
}));

describe('框架实际包版本', () => {
  beforeEach(() => {
    configureAdminApplication({ modules: [] });
    dependencyPackages.splice(0);
    vi.unstubAllGlobals();
  });

  it('无构建元数据时读取框架自身版本，不展示子项目或构建时间', () => {
    configureAdminApplication({
      modules: [{ name: 'com.example.app', title: '子项目', version: '0.1.0' }],
    });
    expect(getFrontendBuildInfo()).toEqual({
      versions: [{ buildTime, category: '框架', id: name, name, version }],
    });
  });

  it('展示实际解析版本，不受子项目构建元数据和版本要求影响', () => {
    vi.stubGlobal('__VBEN_ADMIN_METADATA__', {
      dependencies: { '@vben/stores': '99.0.0' },
    });
    dependencyPackages.push({
      buildTime,
      name: '@vben/stores',
      version: '0.0.1',
    });
    expect(getFrontendBuildInfo().versions[1]).toEqual({
      buildTime,
      category: '公共依赖',
      id: '@vben/stores',
      name: '@vben/stores',
      version: '0.0.1',
    });
  });

  it('基础业务包来自包元数据，同包同版本去重且不同版本分别保留', () => {
    configureAdminApplication({
      modules: [
        {
          name: 'one',
          title: '模块一',
          version: '5.6.18',
          packageInfo: {
            buildTime,
            name: '@levin/oak-base-admin',
            version: '5.6.99',
          },
        },
        {
          name: 'two',
          title: '模块二',
          packageInfo: {
            buildTime,
            name: '@levin/oak-base-admin',
            version: '5.6.99',
          },
        },
        {
          name: 'three',
          title: '模块三',
          packageInfo: {
            buildTime,
            name: '@levin/oak-base-admin',
            version: '5.6.98',
          },
        },
        {
          name: 'custom',
          title: '外部模块',
          packageInfo: { buildTime, name: '@example/custom', version: '1.0.0' },
        },
      ],
    });
    expect(getFrontendBuildInfo().versions.slice(1)).toEqual([
      {
        buildTime,
        category: '基础业务包',
        id: '@levin/oak-base-admin',
        name: '@levin/oak-base-admin',
        version: '5.6.99',
      },
      {
        buildTime,
        category: '基础业务包',
        id: '@levin/oak-base-admin',
        name: '@levin/oak-base-admin',
        version: '5.6.98',
      },
    ]);
  });
});
