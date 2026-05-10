import { describe, expect, it } from 'vitest';

import RbacPermissionMatchUtils from '../rbac-permission-match';
import SpringPatternMatchUtils from '../spring-pattern-match';

describe('SpringPatternMatchUtils', () => {
  it('matches exact text and wildcard patterns', () => {
    expect(SpringPatternMatchUtils.simpleMatch('user:list', 'user:list')).toBe(
      true,
    );
    expect(SpringPatternMatchUtils.simpleMatch('user:*', 'user:list')).toBe(
      true,
    );
    expect(SpringPatternMatchUtils.simpleMatch('*:read', 'user:read')).toBe(
      true,
    );
    expect(
      SpringPatternMatchUtils.simpleMatch('user:*:edit', 'user:1:edit'),
    ).toBe(true);
  });

  it('rejects missing values and non-matching patterns', () => {
    expect(SpringPatternMatchUtils.simpleMatch('', 'user:list')).toBe(false);
    expect(SpringPatternMatchUtils.simpleMatch('user:*', '')).toBe(false);
    expect(SpringPatternMatchUtils.simpleMatch('user:edit', 'user:list')).toBe(
      false,
    );
  });
});

describe('RbacPermissionMatchUtils', () => {
  it('allows empty required permissions', () => {
    expect(RbacPermissionMatchUtils.simpleMatch(undefined, undefined)).toBe(
      true,
    );
    expect(RbacPermissionMatchUtils.simpleMatchList('', [])).toBe(true);
  });

  it('matches exact permissions and trims whitespace', () => {
    expect(
      RbacPermissionMatchUtils.simpleMatch(' user:list ', 'user:list'),
    ).toBe(true);
    expect(
      RbacPermissionMatchUtils.simpleMatchList('user:list', [
        'other',
        'user:list',
      ]),
    ).toBe(true);
  });

  it('matches segmented permission wildcards from owner permissions', () => {
    expect(
      RbacPermissionMatchUtils.simpleMatch(
        'com.demo:User::delete',
        'com.demo:User::*',
      ),
    ).toBe(true);
    expect(
      RbacPermissionMatchUtils.simpleMatch(
        'com.demo:User::delete',
        'com.demo:*',
      ),
    ).toBe(true);
  });

  it('matches role permissions only against role permissions', () => {
    expect(RbacPermissionMatchUtils.simpleMatch('R_ADMIN', 'R_*')).toBe(true);
    expect(RbacPermissionMatchUtils.simpleMatch('R_ADMIN', 'com.demo:*')).toBe(
      false,
    );
    expect(RbacPermissionMatchUtils.simpleMatch('com.demo:User', 'R_*')).toBe(
      false,
    );
  });

  it('supports multiple text patterns separated by pipe', () => {
    expect(
      RbacPermissionMatchUtils.simpleMatch('user:read', 'admin|user:*'),
    ).toBe(true);
    expect(
      RbacPermissionMatchUtils.simpleMatch('guest:read', 'admin|user:*'),
    ).toBe(false);
  });
});
