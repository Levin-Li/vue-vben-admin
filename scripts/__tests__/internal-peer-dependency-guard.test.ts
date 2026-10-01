import { describe, expect, it } from 'vitest';

import { validateInternalPeerVersions } from '../internal-peer-dependency-guard.mjs';

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
