import { describe, expect, it } from 'vitest';

import {
  collectChangedPackages,
  expandExactConsumerClosure,
  preparePackageVersions,
  topologicalLayers,
} from '../on-demand-release-plan.mjs';

const packages = [
  {
    name: '@vben-core/foundation',
    path: 'packages/@core/foundation',
    packageJson: {},
  },
  {
    name: '@vben-core/ui',
    path: 'packages/@core/ui',
    packageJson: { dependencies: { '@vben-core/foundation': 'workspace:*' } },
  },
  {
    name: '@vben/runtime',
    path: 'packages/runtime',
    packageJson: { dependencies: { '@vben-core/ui': 'workspace:*' } },
  },
  {
    name: '@vben/common-ui',
    path: 'packages/effects/common-ui',
    packageJson: { dependencies: { '@vben/runtime': 'workspace:*' } },
  },
  {
    name: '@vben/layouts',
    path: 'packages/effects/layouts',
    packageJson: { dependencies: { '@vben/runtime': 'workspace:*' } },
  },
  {
    name: '@levin/admin-framework',
    path: 'packages/business/admin-framework',
    packageJson: {
      peerDependencies: {
        '@vben/common-ui': '5.6.119',
        '@vben/layouts': '5.6.119',
      },
    },
  },
  {
    name: '@levin/oak-base-admin',
    path: 'packages/business/oak-base-admin',
    packageJson: { peerDependencies: { '@levin/admin-framework': '5.6.119' } },
  },
];

const versions = {
  packages: Object.fromEntries(packages.map(({ name }) => [name, '5.6.119'])),
};

describe('按需发布候选', () => {
  it('只选择有交付变更的叶子包，忽略测试和临时产物', () => {
    expect(
      collectChangedPackages(packages, [
        'packages/business/oak-base-admin/src/index.ts',
        'packages/business/oak-base-admin/src/__tests__/index.test.ts',
        'packages/business/oak-base-admin/dist/index.mjs',
        'scripts/publish-packages.mjs',
      ]),
    ).toEqual(['@levin/oak-base-admin']);
    expect(
      expandExactConsumerClosure(packages, ['@levin/oak-base-admin']),
    ).toEqual(['@levin/oak-base-admin']);
  });

  it('精确依赖的上游变更会递归纳入实际消费者', () => {
    expect(
      expandExactConsumerClosure(packages, ['@vben-core/foundation']),
    ).toEqual(packages.map(({ name }) => name));
    expect(
      topologicalLayers(
        packages,
        packages.map(({ name }) => name),
      ),
    ).toEqual([
      ['@vben-core/foundation'],
      ['@vben-core/ui'],
      ['@vben/runtime'],
      ['@vben/common-ui', '@vben/layouts'],
      ['@levin/admin-framework'],
      ['@levin/oak-base-admin'],
    ]);
  });

  it('各包独立升补丁版本，已准备的版本不再次递增', () => {
    const first = preparePackageVersions(versions, versions, [
      '@levin/oak-base-admin',
    ]);
    expect(first.packages['@levin/oak-base-admin']).toBe('5.6.120');
    expect(first.packages['@vben-core/foundation']).toBe('5.6.119');
    expect(
      preparePackageVersions(first, versions, ['@levin/oak-base-admin']),
    ).toEqual(first);
  });
});
