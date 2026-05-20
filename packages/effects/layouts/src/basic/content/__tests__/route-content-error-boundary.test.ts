import { mount } from '@vue/test-utils';
/* eslint-disable vue/one-component-per-file */
import { defineComponent, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouteContentErrorBoundary } from '../route-content-error-boundary';

const alert = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const refresh = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@vben-core/popup-ui', () => ({
  alert,
}));

vi.mock('@vben/hooks', () => ({
  useRefresh: () => ({
    refresh,
  }),
}));

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

const EventErrorPage = defineComponent({
  name: 'EventErrorPage',
  setup: () => () =>
    h(
      'button',
      {
        'data-testid': 'event-error-button',
        onClick() {
          throw Object.assign(new Error('接口保存失败'), {
            response: {
              data: {
                msg: '接口保存失败',
              },
            },
          });
        },
      },
      '保存',
    ),
});

describe('routeContentErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    alert.mockReset();
    alert.mockResolvedValue(undefined);
    refresh.mockReset();
  });

  async function flushAsyncWork() {
    await nextTick();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('prompts to refresh the current route for render errors and recovers after route key changes', async () => {
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

    await flushAsyncWork();

    expect(wrapper.text()).toContain('当前页面渲染失败');
    expect(wrapper.text()).toContain('broken route page');
    expect(alert).toHaveBeenCalledWith({
      confirmText: '确定',
      content: '发生未知错误，点击确定后将刷新当前页面。',
      icon: 'error',
      title: '未知错误',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
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

  it('does not replace the route content for event or request errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = mount({
      components: {
        EventErrorPage,
        RouteContentErrorBoundary,
      },
      data: () => ({
        routeKey: 'event-error-route',
      }),
      template: `
        <RouteContentErrorBoundary :route-key="routeKey">
          <EventErrorPage />
        </RouteContentErrorBoundary>
      `,
    });

    await wrapper.find('[data-testid="event-error-button"]').trigger('click');
    await nextTick();

    expect(wrapper.text()).not.toContain('当前页面渲染失败');
    expect(alert).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="event-error-button"]').exists()).toBe(
      true,
    );
  });
});
