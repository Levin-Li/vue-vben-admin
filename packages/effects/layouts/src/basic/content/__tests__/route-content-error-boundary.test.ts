import { mount } from '@vue/test-utils';
/* eslint-disable vue/one-component-per-file */
import { defineComponent, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouteContentErrorBoundary } from '../route-content-error-boundary';

const BrokenPage = defineComponent({
  name: 'BrokenPage',
  setup() {
    return () => {
      throw new Error('broken route page');
    };
  },
});

const HealthyPage = defineComponent({
  name: 'HealthyPage',
  setup: () => () => h('div', { 'data-testid': 'healthy-page' }, '正常页面'),
});

describe('routeContentErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isolates a route render error and recovers after route key changes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = mount({
      components: {
        BrokenPage,
        HealthyPage,
        RouteContentErrorBoundary,
      },
      data: () => ({
        routeKey: 'broken-route',
        showBrokenPage: true,
      }),
      template: `
        <RouteContentErrorBoundary :route-key="routeKey">
          <BrokenPage v-if="showBrokenPage" />
          <HealthyPage v-else />
        </RouteContentErrorBoundary>
      `,
    });

    await nextTick();

    expect(wrapper.text()).toContain('当前页面渲染失败');
    expect(wrapper.text()).toContain('broken route page');
    expect(wrapper.find('[data-testid="healthy-page"]').exists()).toBe(false);

    await wrapper.setData({
      routeKey: 'healthy-route',
      showBrokenPage: false,
    });
    await nextTick();

    expect(wrapper.text()).not.toContain('当前页面渲染失败');
    expect(wrapper.find('[data-testid="healthy-page"]').text()).toBe(
      '正常页面',
    );
  });
});
