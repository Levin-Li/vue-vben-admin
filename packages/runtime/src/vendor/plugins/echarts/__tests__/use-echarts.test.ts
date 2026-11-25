import type { EchartsUIType } from '../use-echarts';

import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, onUnmounted, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { useEcharts } from '../use-echarts';

const mocks = vi.hoisted(() => ({
  chart: {
    clear: vi.fn(),
    dispose: vi.fn(),
    getDom: vi.fn(),
    getOption: vi.fn(() => ({})),
    setOption: vi.fn(),
    resize: vi.fn(),
  },
  init: vi.fn(),
}));
vi.mock('../echarts', () => ({ default: { init: mocks.init } }));
const dark = ref(false);
vi.mock('@vben-core/foundation/preferences', () => ({
  usePreferences: () => ({ isDark: dark }),
}));
vi.mock('@vueuse/core', () => ({
  tryOnUnmounted: (fn: () => void) => onUnmounted(fn),
  useDebounceFn: (fn: () => void) => fn,
  useResizeObserver: vi.fn(),
  useWindowSize: () => ({ width: ref(1000), height: ref(800) }),
}));

describe('共享图表控件生命周期', () => {
  afterEach(() => {
    dark.value = false;
    vi.useRealTimers();
    vi.resetAllMocks();
    mocks.chart.getOption.mockReturnValue({});
  });

  it('隐藏时可等待，组件销毁会取消重试并结束等待', async () => {
    vi.useFakeTimers();
    const element = document.createElement('div');
    const component = defineComponent({
      setup() {
        const hook = useEcharts(
          ref({ $el: element } as unknown as EchartsUIType),
        );
        return { hook };
      },
      template: '<div />',
    });
    const wrapper = mount(component);
    const pending = wrapper.vm.hook.renderEcharts({ series: [] });
    await nextTick();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    wrapper.vm.hook.clearEcharts();
    expect(await pending).toBeNull();
    const pendingAtUnmount = wrapper.vm.hook.renderEcharts({ series: [] });
    await nextTick();
    wrapper.unmount();
    expect(await pendingAtUnmount).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it('新渲染覆盖旧等待，清理数据不恢复旧图', async () => {
    vi.useFakeTimers();
    const element = document.createElement('div');
    let visible = false;
    Object.defineProperty(element, 'offsetWidth', {
      get: () => (visible ? 320 : 0),
    });
    Object.defineProperty(element, 'offsetHeight', {
      get: () => (visible ? 240 : 0),
    });
    mocks.chart.getDom.mockReturnValue(element);
    mocks.init.mockReturnValue(mocks.chart);
    const component = defineComponent({
      setup() {
        return {
          hook: useEcharts(ref({ $el: element } as unknown as EchartsUIType)),
        };
      },
      template: '<div />',
    });
    const wrapper = mount(component);
    const first = wrapper.vm.hook.renderEcharts({ title: { text: '旧数据' } });
    await nextTick();
    const second = wrapper.vm.hook.renderEcharts({ title: { text: '新数据' } });
    expect(await first).toBeNull();
    visible = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(100);
    expect(await second).toBe(mocks.chart);
    expect(mocks.chart.setOption).toHaveBeenCalledOnce();
    expect(mocks.chart.setOption).toHaveBeenCalledWith(
      expect.objectContaining({ title: { text: '新数据' } }),
    );
    wrapper.vm.hook.clearEcharts();
    expect(mocks.chart.clear).toHaveBeenCalled();
    wrapper.unmount();
    expect(mocks.chart.dispose).toHaveBeenCalledOnce();
  });

  it('增量更新后切换主题保留完整最新配置，隐藏时延迟重建', async () => {
    vi.useFakeTimers();
    const element = document.createElement('div');
    let visible = true;
    Object.defineProperty(element, 'offsetWidth', { get: () => visible ? 320 : 0 });
    Object.defineProperty(element, 'offsetHeight', { get: () => visible ? 240 : 0 });
    mocks.chart.getDom.mockReturnValue(element);
    mocks.init.mockReturnValue(mocks.chart);
    const full = { title: { text: '标题' }, series: [{ data: [2] }] };
    mocks.chart.getOption.mockReturnValue(full);
    const component = defineComponent({
      setup: () => ({ hook: useEcharts(ref({ $el: element } as unknown as EchartsUIType)) }),
      template: '<div />',
    });
    const wrapper = mount(component);
    await wrapper.vm.hook.renderEcharts({ title: { text: '标题' }, series: [{ data: [1] }] });
    await wrapper.vm.hook.updateData({ series: [{ data: [2] }] });
    visible = false;
    dark.value = true;
    await nextTick();
    expect(mocks.init).toHaveBeenCalledTimes(1);
    visible = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(mocks.init).toHaveBeenCalledTimes(2);
    expect(mocks.chart.setOption).toHaveBeenLastCalledWith(expect.objectContaining(full));
    wrapper.unmount();
  });

  it('新更新取消旧等待，并向调用者传递初始化错误', async () => {
    vi.useFakeTimers();
    const element = document.createElement('div');
    let visible = false;
    Object.defineProperty(element, 'offsetWidth', { get: () => visible ? 320 : 0 });
    Object.defineProperty(element, 'offsetHeight', { get: () => visible ? 240 : 0 });
    const component = defineComponent({
      setup: () => ({ hook: useEcharts(ref({ $el: element } as unknown as EchartsUIType)) }),
      template: '<div />',
    });
    const wrapper = mount(component);
    const old = wrapper.vm.hook.renderEcharts({ title: { text: '旧' } });
    await nextTick();
    const next = wrapper.vm.hook.updateData({ title: { text: '新' } });
    expect(await old).toBeNull();
    mocks.init.mockImplementation(() => { throw new Error('初始化失败'); });
    visible = true;
    await expect(next).rejects.toThrow('初始化失败');
    wrapper.unmount();
  });

  it('保留已有增量更新参数并在销毁后拒绝继续渲染', async () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'offsetWidth', { value: 320 });
    Object.defineProperty(element, 'offsetHeight', { value: 240 });
    mocks.chart.getDom.mockReturnValue(element);
    mocks.init.mockReturnValue(mocks.chart);
    const component = defineComponent({
      setup: () => ({ hook: useEcharts(ref(element as unknown as EchartsUIType)) }),
      template: '<div />',
    });
    const wrapper = mount(component);
    await wrapper.vm.hook.renderEcharts({ series: [{ type: 'bar', data: [1] }] }, false);
    expect(mocks.chart.clear).not.toHaveBeenCalled();
    await wrapper.vm.hook.updateData({ series: [{ type: 'bar', data: [2] }] }, true, true);
    expect(mocks.chart.setOption).toHaveBeenLastCalledWith(
      expect.objectContaining({ series: [{ type: 'bar', data: [2] }] }),
      { notMerge: true, lazyUpdate: true },
    );
    const hook = wrapper.vm.hook;
    wrapper.unmount();
    expect(mocks.chart.dispose).toHaveBeenCalledOnce();
    expect(await hook.renderEcharts({ series: [] })).toBeNull();
    expect(await hook.updateData({ series: [] })).toBeNull();
    expect(mocks.init).toHaveBeenCalledOnce();
  });
});
