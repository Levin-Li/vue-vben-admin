import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usableMailboxSource } from '../views/support-options';
import { isQueueHandlerRoleOption } from '../views/ticket-queue/handler-options';

const actor = vi.hoisted(() => ({ userInfo: { platformUser: false } }));
vi.mock('@vben/runtime/stores', () => ({ useUserStore: () => actor }));
const domain = {
  tenantId: 'tenant',
  enable: true,
  lifecycleStatus: 'Active',
  emailReceivingEnabled: true,
};
const relay = {
  tenantId: 'tenant',
  enable: true,
  syncStatus: 'Synced',
  providerRouteId: 'provider-id',
};

describe('mailbox source options follow source validation and masked fields', () => {
  beforeEach(() => {
    actor.userInfo.platformUser = false;
  });
  it('requires exact tenant ownership for platform queue roles', () => {
    actor.userInfo.platformUser = true;
    expect(
      isQueueHandlerRoleOption(
        { tenantId: 'tenant', publicRole: false },
        'tenant',
      ),
    ).toBe(true);
    for (const tenantId of [null, undefined, 'other'])
      expect(isQueueHandlerRoleOption({ tenantId }, 'tenant')).toBe(false);
    expect(
      isQueueHandlerRoleOption(
        { tenantId: 'tenant', publicRole: true },
        'tenant',
      ),
    ).toBe(false);
  });
  it('keeps masked tenant-owned roles but rejects explicit public and foreign roles', () => {
    expect(isQueueHandlerRoleOption({ tenantId: undefined }, 'tenant')).toBe(
      true,
    );
    expect(isQueueHandlerRoleOption({ tenantId: null }, 'tenant')).toBe(true);
    expect(
      isQueueHandlerRoleOption(
        { tenantId: undefined, publicRole: true },
        'tenant',
      ),
    ).toBe(false);
    expect(
      isQueueHandlerRoleOption(
        { tenantId: 'other', publicRole: false },
        'tenant',
      ),
    ).toBe(false);
  });
  it('rejects inactive, nonreceiving, expired and wrong-tenant domains', () => {
    expect(usableMailboxSource(domain, true, 'tenant')).toBe(true);
    for (const override of [
      { enable: false },
      { lifecycleStatus: 'Pending' },
      { emailReceivingEnabled: false },
      { domainExpiredTime: '2000-01-01T00:00:00' },
      { tenantId: 'other' },
    ]) {
      expect(
        usableMailboxSource({ ...domain, ...override }, true, 'tenant'),
      ).toBe(false);
    }
  });
  it('rejects unsynced, unbound and explicitly non-webhook relay routes', () => {
    expect(usableMailboxSource(relay, false, 'tenant')).toBe(true);
    for (const override of [
      { enable: false },
      { syncStatus: 'Pending' },
      { providerRouteId: '' },
      { targetList: [] },
      { targetList: ['email:recipient'] },
      { tenantId: 'other' },
    ]) {
      expect(
        usableMailboxSource({ ...relay, ...override }, false, 'tenant'),
      ).toBe(false);
    }
    expect(
      usableMailboxSource(
        { ...relay, targetList: ['mail-webhook:reference'] },
        false,
        'tenant',
      ),
    ).toBe(true);
  });
  it('does not require masked tenant or private webhook target fields for tenant actors', () => {
    expect(
      usableMailboxSource(
        { ...relay, tenantId: null, targetList: null },
        false,
        'tenant',
      ),
    ).toBe(true);
    expect(
      usableMailboxSource({ ...domain, tenantId: undefined }, true, 'tenant'),
    ).toBe(true);
  });
  it('rejects platform public and missing tenant rows for platform actors', () => {
    actor.userInfo.platformUser = true;
    expect(usableMailboxSource(relay, false, 'tenant')).toBe(true);
    expect(
      usableMailboxSource({ ...relay, tenantId: null }, false, 'tenant'),
    ).toBe(false);
    expect(
      usableMailboxSource({ ...relay, tenantId: undefined }, false, 'tenant'),
    ).toBe(false);
  });
});
