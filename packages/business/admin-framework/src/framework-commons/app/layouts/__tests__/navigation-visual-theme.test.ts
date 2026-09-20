import { describe, expect, it } from 'vitest';

import {
  getNavigationVisualThemeClass,
  resolveNavigationVisualStyle,
} from '../navigation-visual-theme';

describe('导航视觉主题', () => {
  it('保留受支持的主题值', () => {
    expect(resolveNavigationVisualStyle('brand-gradient')).toBe(
      'brand-gradient',
    );
    expect(resolveNavigationVisualStyle('minimal')).toBe('minimal');
    expect(resolveNavigationVisualStyle('unsupported')).toBe('minimal');
  });

  it('将未知主题安全回退到默认主题', () => {
    expect(resolveNavigationVisualStyle('legacy-theme')).toBe('minimal');
    expect(getNavigationVisualThemeClass(undefined)).toBe(
      'admin-navigation-theme-minimal',
    );
  });
});
