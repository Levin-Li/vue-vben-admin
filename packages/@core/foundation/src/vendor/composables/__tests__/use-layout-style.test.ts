import { createApp, defineComponent, h, nextTick } from 'vue';

import { CSS_VARIABLE_LAYOUT_CONTENT_HEIGHT } from '@vben-core/foundation/shared/constants';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutContentStyle } from '../use-layout-style';

describe('布局可用内容高度', () => {
  let notifyResize: () => void;
  let dispose: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          notifyResize = () => callback([], this as ResizeObserver);
        }
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
    vi.stubGlobal('innerHeight', 1200);
    vi.stubGlobal('innerWidth', 1600);
  });

  afterEach(() => {
    dispose?.();
    document.documentElement.style.removeProperty(
      CSS_VARIABLE_LAYOUT_CONTENT_HEIGHT,
    );
    document.documentElement.style.removeProperty('--vben-content-width');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function mountLayout(style = '', height = 765) {
    let layout!: ReturnType<typeof useLayoutContentStyle>;
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(
      defineComponent({
        setup() {
          layout = useLayoutContentStyle();
          return () => h('main', { ref: layout.contentElement, style });
        },
      }),
    );
    app.mount(host);
    dispose = () => {
      app.unmount();
      host.remove();
    };
    const element = layout.contentElement.value;
    if (!element) {
      throw new Error('布局内容元素未挂载');
    }
    const rect = vi
      .spyOn(element, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(20, 100, 900, height));
    return { element, layout, rect };
  }

  async function resize() {
    notifyResize();
    await vi.advanceTimersByTimeAsync(20);
    await nextTick();
    return document.documentElement.style.getPropertyValue(
      CSS_VARIABLE_LAYOUT_CONTENT_HEIGHT,
    );
  }

  it.each([
    ['padding: 2px', 761],
    ['padding: 0; border: 0', 765],
    ['padding-top: 1.25px; padding-bottom: 2.5px', 761.25],
    ['padding: 2px; border-top: 1px solid; border-bottom: 3px solid', 757],
    ['padding-left: 20px; padding-right: 30px', 765],
  ])('按实际上下内边距和边框计算：%s', async (style, expected) => {
    const { layout } = mountLayout(style);
    expect(await resize()).toBe(`${expected}px`);
    expect(layout.visibleDomRect.value).toEqual({
      bottom: 865,
      height: 765,
      left: 20,
      right: 920,
      top: 100,
      width: 900,
    });
    expect(layout.overlayStyle.value).toEqual({
      height: '765px',
      left: '20px',
      position: 'fixed',
      top: '100px',
      width: '900px',
      zIndex: 150,
    });
    expect(
      document.documentElement.style.getPropertyValue('--vben-content-width'),
    ).toBe('900px');
  });

  it('尺寸和间距变化后使用最新样式重新计算', async () => {
    const { element, rect } = mountLayout('padding: 2px');
    expect(await resize()).toBe('761px');
    element.style.padding = '10px';
    expect(await resize()).toBe('745px');
    rect.mockReturnValue(new DOMRect(20, 100, 900, 600));
    expect(await resize()).toBe('580px');
  });

  it('保留视口对外框高度的限制', async () => {
    mountLayout('padding: 2px', 1300);
    expect(await resize()).toBe('1096px');
  });

  it('可见高度不足时不产生负数', async () => {
    mountLayout('padding: 10px; border: 2px solid', 4);
    expect(await resize()).toBe('0px');
  });

  it('元素移除后待执行的尺寸通知输出零高度', async () => {
    const { layout } = mountLayout('padding: 2px');
    expect(await resize()).toBe('761px');
    layout.contentElement.value = null;
    expect(await resize()).toBe('0px');
  });
});
