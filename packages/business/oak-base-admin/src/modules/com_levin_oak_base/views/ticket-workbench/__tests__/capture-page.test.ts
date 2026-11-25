import { afterEach, describe, expect, it, vi } from 'vitest';

import { captureVisiblePage } from '../capture-page';

const mocks = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('html2canvas', () => ({ default: mocks.capture }));

describe('工单截图', () => {
  afterEach(() => vi.resetAllMocks());

  it('截取可见区域时遮盖密码与标记为私密的内容', async () => {
    const copy = document.implementation.createHTMLDocument('copy');
    copy.body.innerHTML =
      '<input type="password" value="secret"><div data-private>private</div><img data-sensitive src="data:image/png;base64,c2VjcmV0"><canvas data-mask></canvas><div>visible</div>';
    mocks.capture.mockImplementation(async (_element, options) => {
      options.onclone(copy);
      expect(copy.querySelector('input')?.value).toBe('');
      expect(copy.querySelector('[data-private]')?.textContent).toBe('');
      expect(copy.querySelector<HTMLElement>('img')?.style.visibility).toBe(
        'hidden',
      );
      expect(copy.querySelector<HTMLElement>('canvas')?.style.visibility).toBe(
        'hidden',
      );
      expect(
        copy
          .querySelector<HTMLElement>('img')
          ?.style.getPropertyPriority('visibility'),
      ).toBe('important');
      expect(copy.body.textContent).toContain('visible');
      expect(options.width).toBe(window.innerWidth);
      expect(options.height).toBe(window.innerHeight);
      return { toDataURL: () => 'data:image/png;base64,YWJj' };
    });
    expect(await captureVisiblePage()).toBe('YWJj');
  });

  it('截图超过大小限制时拒绝携带', async () => {
    mocks.capture.mockResolvedValue({
      toDataURL: () => `data:image/png;base64,${'a'.repeat(2796205)}`,
    });
    await expect(captureVisiblePage()).rejects.toThrow('截图过大或无法生成');
  });

  it('截图超过大小限制时缩小后再次编码', async () => {
    const resized = document.createElement('canvas');
    const drawImage = vi.fn();
    vi.spyOn(resized, 'getContext').mockReturnValue({ drawImage } as never);
    vi.spyOn(resized, 'toDataURL').mockReturnValue(
      'data:image/png;base64,YWJj',
    );
    const createElement = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string, options?: ElementCreationOptions) =>
        tag === 'canvas' ? resized : createElement(tag, options),
      );
    mocks.capture.mockResolvedValue({
      width: 1000,
      height: 800,
      toDataURL: () => `data:image/png;base64,${'a'.repeat(2796205)}`,
    });
    try {
      await expect(captureVisiblePage()).resolves.toBe('YWJj');
      expect(resized.width).toBe(750);
      expect(resized.height).toBe(600);
      expect(drawImage).toHaveBeenCalledOnce();
    } finally {
      createSpy.mockRestore();
    }
  });

  it('将截图副本中的现代渐变颜色转换为兼容格式', async () => {
    const copy = document.implementation.createHTMLDocument('copy');
    const element = copy.createElement('div');
    copy.body.append(element);
    const setProperty = vi.spyOn(element.style, 'setProperty');
    const createElement = copy.createElement.bind(copy);
    vi.spyOn(copy, 'createElement').mockImplementation((tag: string) => {
      const item = createElement(tag);
      if (tag === 'canvas') {
        Object.defineProperty(item, 'getContext', {
          value: () => ({
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            getImageData: () => ({ data: [238, 237, 253, 255] }),
          }),
        });
      }
      return item;
    });
    Object.defineProperty(copy, 'defaultView', {
      value: {
        getComputedStyle: (node: Element) => ({
          getPropertyValue: (property: string) =>
            node === element && property === 'background-image'
              ? 'linear-gradient(125deg, color(srgb 0.93 0.93 0.99), rgb(255, 244, 245))'
              : '',
        }),
      },
    });
    mocks.capture.mockImplementation(async (_element, options) => {
      options.onclone(copy);
      expect(setProperty).toHaveBeenCalledWith(
        'background-image',
        'linear-gradient(125deg, rgba(238, 237, 253, 1), rgb(255, 244, 245))',
        'important',
      );
      return { toDataURL: () => 'data:image/png;base64,YWJj' };
    });
    await expect(captureVisiblePage()).resolves.toBe('YWJj');
  });
});
