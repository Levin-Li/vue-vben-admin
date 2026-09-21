import { describe, expect, it } from 'vitest';

import { validateInternalPeerVersions } from '../internal-peer-dependency-guard.mjs';
import {
  incrementPatchVersion,
  nextFullReleaseVersions,
} from '../prepare-full-frontend-release.mjs';

const versionConfig = {
  default: '5.6.8',
  packages: {
    '@levin/admin-framework': '5.6.68',
  },
};

describe('internal peer dependency guard', () => {
  it('accepts the version configured for an internal peer dependency', () => {
    expect(() =>
      validateInternalPeerVersions(
        {
          name: '@levin/oak-base-admin',
          packageJson: {
            peerDependencies: { '@levin/admin-framework': '5.6.68' },
          },
        },
        new Map(),
        versionConfig,
      ),
    ).not.toThrow();
  });

  it('rejects an outdated internal peer dependency before publication', () => {
    expect(() =>
      validateInternalPeerVersions(
        {
          name: '@levin/oak-base-admin',
          packageJson: {
            peerDependencies: { '@levin/admin-framework': '5.6.67' },
          },
        },
        new Map(),
        versionConfig,
      ),
    ).toThrow('@levin/admin-framework: 5.6.67 -> 5.6.68');
  });
});

describe('完整前端发布版本批次', () => {
  it('sets one releaseVersion for every configured internal package', () => {
    expect(incrementPatchVersion('5.6.28')).toBe('5.6.29');
    expect(
      nextFullReleaseVersions({
        default: '5.6.8',
        packages: {
          '@levin/admin-framework': '5.6.101',
          '@vben/layouts': '5.6.28',
        },
      }).releaseVersion,
    ).toBe('5.6.102');
  });
});
