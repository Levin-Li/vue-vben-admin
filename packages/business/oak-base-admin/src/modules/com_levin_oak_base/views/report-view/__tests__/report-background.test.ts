import { describe, expect, it } from 'vitest';

import { backgroundImage, reportBackground } from '../report-background';

describe('报表背景图片样式', () => {
  it('仅接受受限 PNG 或 JPEG 数据 URI', () => {
    expect(backgroundImage('data:image/png;base64,YWJj')).toBe(
      'url("data:image/png;base64,YWJj")',
    );
    for (const value of [
      'https://example.com/x.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png;base64,YWJj");color:red;/*',
      `data:image/png;base64,${'A'.repeat(350_001)}`,
    ]) {
      expect(backgroundImage(value)).toBeUndefined();
    }
  });

  it('仅生成固定方向和合法颜色的渐变，纯色覆盖预设', () => {
    expect(reportBackground({ gradient: { from: '#123456', to: '#abcdef', direction: 'HORIZONTAL' } }).backgroundImage)
      .toBe('linear-gradient(90deg, #123456, #abcdef)');
    expect(reportBackground({ color: '#ffffff' }, true)).toEqual({ backgroundColor: '#ffffff', backgroundImage: 'none' });
    for (const gradient of [
      { from: '#fff);url(https://invalid)', to: '#abcdef', direction: 'HORIZONTAL' },
      { from: '#123456', to: '#abcdef', direction: 'toString' },
      { from: '#123456', to: '#abcdef', direction: 'HORIZONTAL', extra: 'x' },
    ]) expect(reportBackground({ gradient }).backgroundImage).toBeUndefined();
  });
});
