import { describe, expect, it, vi } from 'vitest';

import { emailRelayRoutePageCrudConfig } from '../config';
import { EmailRelayRouteService } from '../../../api/email-relay-route-service';

describe('email relay route page config', () => {
  it('serializes typed relay targets with the stable provider protocol', async () => {
    const payload = await emailRelayRoutePageCrudConfig.transformSubmit?.({
      localPart: 'Support',
      mailDomain: 'Example.COM.',
      providerCode: 'forward-email',
      targetList: [
        { endpoint: ' OPS@example.com ', type: 'email' },
        { endpoint: 'https://hooks.example.com/inbound', type: 'mail-webhook' },
      ],
    });

    expect(payload).toMatchObject({
      localPart: 'support',
      mailDomain: 'example.com',
      targetList: [
        'email:OPS@example.com',
        'mail-webhook:https://hooks.example.com/inbound',
      ],
    });
  });

  it('rejects a route without a target', async () => {
    await expect(
      emailRelayRoutePageCrudConfig.transformSubmit?.({
        localPart: 'support',
        mailDomain: 'example.com',
        providerCode: 'forward-email',
        targetList: [],
      }),
    ).rejects.toThrow('至少需要一个投递目标');
  });

  it('converts persisted protocol strings back to editable typed rows', async () => {
    const service = new EmailRelayRouteService();
    vi.spyOn(service as any, 'get').mockResolvedValue({ data: { targetList: ['email:ops@example.com', 'notify-webhook:https://hooks.example.com/n'] } });
    await expect(service.retrieve({ id: 'route-1' })).resolves.toEqual({
      data: { targetList: [{ type: 'email', endpoint: 'ops@example.com' }, { type: 'notify-webhook', endpoint: 'https://hooks.example.com/n' }] },
    });
  });
});
