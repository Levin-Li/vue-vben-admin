import { describe, expect, it } from 'vitest';

import {
  API_REQUEST_EVENT_TYPE,
  emitApiRequestEvent,
  onApiRequestTopic,
} from '../app/api/request-events';
import {
  FrameworkEventBus,
  matchFrameworkEventTopic,
  onFrameworkEvent,
} from '../event-bus';

describe('framework event bus', () => {
  it('matches topic with * and ? wildcards', () => {
    expect(
      matchFrameworkEventTopic(
        '*/rbac/tenantSiteInf?',
        '/api/rbac/tenantSiteInfo',
      ),
    ).toBe(true);
    expect(matchFrameworkEventTopic('/rbac/*', '/rbac/login')).toBe(true);
    expect(matchFrameworkEventTopic('/rbac/?', '/rbac/login')).toBe(false);
  });

  it('adds listeners with remark and removes listeners by id', () => {
    const eventBus = new FrameworkEventBus();
    const received: string[] = [];

    const listenerId = eventBus.addListener(
      'tenant',
      'site.*',
      (type, topic, data) => {
        expect(type).toBe('tenant');
        expect(data).toEqual({ id: 'site-1' });
        received.push(topic);
      },
      '同步租户站点变更',
    );

    expect(eventBus.emit('tenant', 'site.changed', { id: 'site-1' })).toBe(1);
    expect(eventBus.getListeners()).toEqual([
      {
        enabled: true,
        id: listenerId,
        remark: '同步租户站点变更',
        topicPattern: 'site.*',
        type: 'tenant',
      },
    ]);
    expect(eventBus.removeListener(listenerId)).toBe(true);
    expect(eventBus.emit('tenant', 'site.changed', {})).toBe(0);
    expect(received).toEqual(['site.changed']);
  });

  it('disables and enables listeners without removing them', () => {
    const eventBus = new FrameworkEventBus();
    const received: string[] = [];

    const listenerId = eventBus.addListener(
      'tenant',
      'site.*',
      (_type, topic) => {
        received.push(topic);
      },
      '同步租户站点变更',
    );

    expect(eventBus.setListenerEnabled(listenerId, false)).toBe(true);
    expect(eventBus.getListeners()).toMatchObject([
      {
        enabled: false,
        id: listenerId,
      },
    ]);
    expect(eventBus.emit('tenant', 'site.disabled', {})).toBe(0);
    expect(received).toEqual([]);

    expect(eventBus.setListenerEnabled(listenerId, true)).toBe(true);
    expect(eventBus.emit('tenant', 'site.enabled', {})).toBe(1);
    expect(received).toEqual(['site.enabled']);
  });

  it('keeps unsubscribe function as a convenience cleanup handle', () => {
    const eventBus = new FrameworkEventBus();
    const received: string[] = [];

    const unsubscribe = eventBus.on('tenant', 'site.*', (event) => {
      received.push(`${event.type}:${event.topic}`);
    });

    expect(eventBus.emit('tenant', 'site.changed', {})).toBe(1);
    unsubscribe();
    expect(eventBus.emit('tenant', 'site.changed', {})).toBe(0);
    expect(received).toEqual(['tenant:site.changed']);
  });

  it('uses request url as topic and complete payload as data for api events', () => {
    const received: any[] = [];
    const unsubscribe = onApiRequestTopic(
      '*/rbac/tenantSiteInfo',
      (event) => {
        received.push(event);
      },
      '监听租户站点信息接口',
    );

    emitApiRequestEvent({
      config: {
        url: '/api/rbac/tenantSiteInfo',
      },
      data: {
        name: 'demo',
      },
      rawData: {
        data: {
          name: 'demo',
        },
      },
      response: {
        status: 200,
      },
    });

    unsubscribe();

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe(API_REQUEST_EVENT_TYPE);
    expect(received[0].topic).toBe('/api/rbac/tenantSiteInfo');
    expect(received[0].data).toMatchObject({
      config: {
        url: '/api/rbac/tenantSiteInfo',
      },
      data: {
        name: 'demo',
      },
      rawData: {
        data: {
          name: 'demo',
        },
      },
      response: {
        status: 200,
      },
    });
    expect(received[0].data).not.toHaveProperty('state');
  });

  it('exposes public onFrameworkEvent with api.request type', () => {
    const received: any[] = [];
    const unsubscribe = onFrameworkEvent('api.request', '/rbac/*', (event) => {
      received.push(event.data);
    });

    emitApiRequestEvent({
      config: {
        url: '/rbac/userInfo',
      },
      data: {
        id: 'u1',
      },
    });

    unsubscribe();

    expect(received).toEqual([
      {
        config: {
          url: '/rbac/userInfo',
        },
        data: {
          id: 'u1',
        },
      },
    ]);
  });
});
