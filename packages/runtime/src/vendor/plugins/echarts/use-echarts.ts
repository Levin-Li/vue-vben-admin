import type { EChartsOption } from 'echarts';

import type { Ref } from 'vue';

import type { Nullable } from '@vben/runtime/types';

import type EchartsUI from './echarts-ui.vue';

import { computed, nextTick, watch } from 'vue';

import { usePreferences } from '@vben-core/foundation/preferences';

import {
  tryOnUnmounted,
  useDebounceFn,
  useResizeObserver,
  useWindowSize,
} from '@vueuse/core';

import echarts from './echarts';

type EchartsUIType = typeof EchartsUI | undefined;

type EchartsThemeType = 'dark' | 'light' | null;

function useEcharts(chartRef: Ref<EchartsUIType>) {
  let chartInstance: echarts.ECharts | null = null;
  let cacheOptions: EChartsOption = {};
  let disposed = false;
  let revision = 0;
  let pending:
    | undefined
    | { resolve: (value: null) => void; timer?: ReturnType<typeof setTimeout> };

  const { isDark } = usePreferences();
  const { height, width } = useWindowSize();
  const resizeHandler: () => void = useDebounceFn(resize, 200);

  const getChartEl = (): HTMLElement | null => {
    const refValue = chartRef?.value as unknown;
    if (!refValue) return null;
    if (refValue instanceof HTMLElement) {
      return refValue;
    }
    const maybeComponent = refValue as { $el?: HTMLElement };
    return maybeComponent.$el ?? null;
  };

  const isElHidden = (el: HTMLElement | null): boolean => {
    if (!el) return true;
    return el.offsetHeight === 0 || el.offsetWidth === 0;
  };

  const getOptions = computed((): EChartsOption => {
    if (!isDark.value) {
      return {};
    }

    return {
      backgroundColor: 'transparent',
    };
  });

  const initCharts = (t?: EchartsThemeType) => {
    const el = getChartEl();
    if (!el) {
      return;
    }
    chartInstance = echarts.init(el, t ?? (isDark.value ? 'dark' : null));

    return chartInstance;
  };

  function cancelPending() {
    const old = pending;
    pending = undefined;
    if (!old) return;
    if (old.timer) clearTimeout(old.timer);
    old.resolve(null);
  }

  const renderEcharts = (
    options: EChartsOption,
    clear = true,
  ): Promise<Nullable<echarts.ECharts>> => {
    revision += 1;
    cancelPending();
    cacheOptions = options;
    if (disposed) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const job = {
        resolve: () => resolve(null),
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
      };
      pending = job;
      const attempt = () => {
        if (disposed || pending !== job) return;
        const el = getChartEl();
        if (isElHidden(el)) {
          job.timer = setTimeout(attempt, 100);
          return;
        }
        try {
          if (!chartInstance || chartInstance?.getDom() !== el) {
            chartInstance?.dispose();
            const instance = initCharts();
            if (!instance) {
              pending = undefined;
              resolve(null);
              return;
            }
          }
          clear && chartInstance?.clear();
          chartInstance?.setOption({ ...options, ...getOptions.value });
          if (chartInstance) cacheOptions = chartInstance.getOption() as EChartsOption;
          pending = undefined;
          resolve(chartInstance);
        } catch (error) {
          pending = undefined;
          reject(error);
        }
      };
      void nextTick(attempt);
    });
  };

  /** 取消未完成渲染并清空旧数据，避免条件变化时保留过期图表。 */
  function clearEcharts() {
    revision += 1;
    cancelPending();
    cacheOptions = {};
    chartInstance?.clear();
  }

  const updateData = (
    option: EChartsOption,
    notMerge = false, // false = 合并（保留动画），true = 完全替换
    lazyUpdate = false, // true 时不立即重绘，适合短时间内多次调用
  ): Promise<echarts.ECharts | null> => {
    // 新更新立即使旧的隐藏等待失效；异步回调不得覆盖更晚的调用。
    cancelPending();
    const current = ++revision;
    return nextTick().then(() => {
      if (disposed || current !== revision) return null;
      if (!chartInstance) return renderEcharts(option);

      chartInstance.setOption({ ...option, ...getOptions.value }, { notMerge, lazyUpdate });
      // ECharts 返回合并后的完整配置，主题重建时不能只使用最后一次局部更新。
      cacheOptions = chartInstance.getOption() as EChartsOption;
      return chartInstance;
    });
  };

  function resize() {
    const el = getChartEl();
    if (isElHidden(el)) {
      return;
    }
    chartInstance?.resize({
      animation: {
        duration: 300,
        easing: 'quadraticIn',
      },
    });
  }

  watch([width, height], () => {
    resizeHandler?.();
  });

  useResizeObserver(chartRef as never, resizeHandler);

  watch(isDark, () => {
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
      // 隐藏容器等到可见再重建，失败不产生未处理的异步拒绝。
      void renderEcharts(cacheOptions).then(() => resize()).catch(() => {});
    }
  });

  tryOnUnmounted(() => {
    // 销毁实例，释放资源
    disposed = true;
    revision += 1;
    cancelPending();
    chartInstance?.dispose();
    chartInstance = null;
  });
  return {
    renderEcharts,
    clearEcharts,
    resize,
    updateData,
    getChartInstance: () => chartInstance,
  };
}

export { useEcharts };

export type { EchartsUIType };
