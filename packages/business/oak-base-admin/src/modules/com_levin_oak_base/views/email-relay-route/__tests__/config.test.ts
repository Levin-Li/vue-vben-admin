import { describe, expect, it } from 'vitest';

import { emailRelayRoutePageCrudConfig } from '../config';

describe('email relay route page config', () => {
  it('normalizes enabled relay targets before submission', async () => {
    const payload = await emailRelayRoutePageCrudConfig.transformSubmit?.({
      localPart: 'Support',
      mailDomain: 'Example.COM.',
      providerCode: 'forward-email',
      targetList: [
        { enable: true, endpoint: ' OPS@example.com ', type: 'Email' },
        { enable: false, endpoint: 'https://hooks.example.com/inbound', type: 'Webhook' },
      ],
    });

    expect(payload).toMatchObject({
      localPart: 'support',
      mailDomain: 'example.com',
      targetList: [
        { enable: true, endpoint: 'OPS@example.com', type: 'Email' },
        { enable: false, endpoint: 'https://hooks.example.com/inbound', type: 'Webhook' },
      ],
    });
  });

  it('rejects a route without an enabled target', async () => {
    await expect(
      emailRelayRoutePageCrudConfig.transformSubmit?.({
        localPart: 'support',
        mailDomain: 'example.com',
        providerCode: 'forward-email',
        targetList: [{ enable: false, endpoint: 'ops@example.com', type: 'Email' }],
      }),
    ).rejects.toThrow('至少需要一个启用的投递目标');
  });
});
