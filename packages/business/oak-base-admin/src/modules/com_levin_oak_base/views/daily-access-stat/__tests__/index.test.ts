import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DailyAccessStatPage from '../index.vue';

const { top20, overview } = vi.hoisted(() => ({
  top20: vi.fn(),
  overview: vi.fn(),
}));

vi.mock('../../../api/daily-access-stat-service', () => ({
  dailyAccessStatService: { top20, overview },
}));
vi.mock('@levin/admin-framework/framework-commons/rbac-access', () => ({
  useRbacAccess: () => ({ hasPermission: () => true }),
}));
vi.mock(
  '@levin/admin-framework/framework-commons/shared/crud-permissions',
  () => ({
    buildApiMethodPermissions: () => [],
  }),
);
vi.mock('@vben/common-ui', () => ({
  Page: { props: ['title'], template: '<div>{{ title }}<slot /></div>' },
}));
vi.mock('ant-design-vue', () => ({
  Alert: {
    props: ['message', 'description'],
    template: '<div>{{ message }} {{ description }}</div>',
  },
  Button: { template: '<button><slot /></button>' },
  DatePicker: {
    props: ['value'],
    emits: ['change', 'update:value'],
    template:
      '<input :value="value" @change="$emit(\'update:value\', $event.target.value); $emit(\'change\')" />',
  },
  Descriptions: Object.assign(
    { template: '<div><slot /></div>' },
    { Item: { template: '<div><slot /></div>' } },
  ),
  Empty: { template: '<div />' },
  Select: { props: ['options'], template: '<div />' },
  Table: { template: '<div />' },
  Tabs: Object.assign(
    {
      props: ['activeKey'],
      emits: ['update:activeKey'],
      template: `<div>
        <button data-tab="network" @click="$emit('update:activeKey', 'network')">网络访问</button>
        <button data-tab="os" @click="$emit('update:activeKey', 'os')">OS</button>
        <button data-tab="java" @click="$emit('update:activeKey', 'java')">Java</button>
        <button data-tab="database" @click="$emit('update:activeKey', 'database')">数据库</button>
        <slot />
      </div>`,
    },
    { TabPane: { template: '<section><slot /></section>' } },
  ),
}));

describe('性能监控页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    top20.mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  it('今天自动重新查询，选择历史日期和卸载后停止定时查询', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T08:00:00+08:00'));
    overview.mockResolvedValue({
      collectionIncomplete: false,
      totalVisitCount: 1,
      peakConcurrency: 1,
      slowUrls: [],
      hosts: [],
    });
    const wrapper = mount(DailyAccessStatPage);
    await vi.advanceTimersByTimeAsync(0);
    expect(overview).toHaveBeenCalledTimes(1);

    overview.mockResolvedValue({
      collectionIncomplete: false,
      totalVisitCount: 2,
      peakConcurrency: 1,
      slowUrls: [],
      hosts: [],
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(overview).toHaveBeenCalledTimes(2);
    expect(overview).toHaveBeenLastCalledWith({
      statDate: '2026-10-25',
      accessSide: 'Backend',
    });
    expect(top20).toHaveBeenCalledTimes(4);
    expect(wrapper.text()).toContain('2');

    await wrapper.get('input').setValue('2026-10-24');
    await vi.advanceTimersByTimeAsync(0);
    expect(overview).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(5000);
    expect(overview).toHaveBeenCalledTimes(3);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(overview).toHaveBeenCalledTimes(3);
  });

  it.each([true, false])(
    'collectionIncomplete=%s 时警告显隐正确',
    async (incomplete) => {
      overview.mockResolvedValue({
        collectionIncomplete: incomplete,
        totalVisitCount: 19,
        peakConcurrency: 3,
        slowUrls: [],
        hosts: [],
      });
      const wrapper = mount(DailyAccessStatPage);
      await flushPromises();
      expect(wrapper.text()).toContain('19');
      expect(wrapper.text().includes('本日维度统计不完整')).toBe(incomplete);
      if (incomplete) {
        expect(wrapper.text()).toContain('容量上限或采集异常');
      }
      wrapper.unmount();
    },
  );

  it('四个标签切换复用已加载的概览数据', async () => {
    overview.mockResolvedValue({
      collectionIncomplete: false,
      totalVisitCount: 19,
      peakConcurrency: 3,
      slowUrls: [],
      hosts: [],
    });
    const wrapper = mount(DailyAccessStatPage);
    await flushPromises();

    expect(wrapper.text()).toContain('性能监控');
    for (const tab of ['os', 'java', 'database', 'network']) {
      await wrapper.get(`[data-tab="${tab}"]`).trigger('click');
    }
    expect(top20).toHaveBeenCalledTimes(2);
    expect(overview).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
