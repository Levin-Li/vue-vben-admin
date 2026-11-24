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
});
