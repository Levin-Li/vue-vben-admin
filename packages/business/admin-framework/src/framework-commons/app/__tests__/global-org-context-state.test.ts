import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyCurrentGlobalOrgIdToParams,
  applyCurrentGlobalUserOrgContextToParams,
  getCurrentGlobalOrgId,
  getCurrentGlobalOwnerId,
  onGlobalOrgIdChange,
  setCurrentGlobalOrgId,
  setCurrentGlobalUserOrgRecord,
} from '../global-org-context-state';

describe('global organization context state', () => {
  beforeEach(() => {
    setCurrentGlobalOrgId(undefined);
  });

  it('adds the selected organization to request parameters and overrides stale caller input', () => {
    setCurrentGlobalOrgId('org-b');

    expect(
      applyCurrentGlobalOrgIdToParams({
        orgId: 'org-a',
        orgIdList: ['org-a'],
        pageIndex: 1,
      }),
    ).toEqual({
      orgId: 'org-b',
      orgIdList: ['org-b'],
      pageIndex: 1,
    });
  });

  it('does not create request parameters without a current organization', () => {
    expect(applyCurrentGlobalOrgIdToParams(undefined)).toBeUndefined();
    expect(applyCurrentGlobalOrgIdToParams({ pageIndex: 1 })).toEqual({
      pageIndex: 1,
    });
  });

  it('keeps selector candidate request parameters when context injection is skipped', () => {
    setCurrentGlobalOrgId('org-b');

    expect(
      applyCurrentGlobalUserOrgContextToParams(
        { orgId: 'candidate-org', pageIndex: 1 },
        { skip: true },
      ),
    ).toEqual({
      orgId: 'candidate-org',
      pageIndex: 1,
    });
  });

  it('uses the selected user organization and ID as orgId and ownerId', () => {
    setCurrentGlobalUserOrgRecord({
      id: 'user-b',
      kind: 'user',
      name: '用户 B',
      orgId: 'org-b',
    });

    expect(
      applyCurrentGlobalUserOrgContextToParams({
        orgId: 'org-a',
        orgIdList: ['org-a'],
        ownerId: 'user-a',
        pageIndex: 1,
      }),
    ).toEqual({
      orgId: 'org-b',
      orgIdList: ['org-b'],
      ownerId: 'user-b',
      pageIndex: 1,
    });
    expect(getCurrentGlobalOrgId()).toBe('org-b');
    expect(getCurrentGlobalOwnerId()).toBe('user-b');
  });

  it('notifies listeners only when the organization context actually changes', () => {
    const listener = vi.fn();
    const dispose = onGlobalOrgIdChange(listener);

    expect(setCurrentGlobalOrgId('org-a')).toBe(true);
    expect(setCurrentGlobalOrgId('org-a')).toBe(false);
    expect(setCurrentGlobalOrgId(undefined)).toBe(true);

    expect(listener).toHaveBeenNthCalledWith(1, 'org-a');
    expect(listener).toHaveBeenNthCalledWith(2, undefined);
    expect(getCurrentGlobalOrgId()).toBeUndefined();
    dispose();
  });
});
