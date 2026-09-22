import { describe, expect, it } from 'vitest';

import { defaultPreferences } from '../config';

describe('默认偏好设置', () => {
  it('恢复默认时使用浅色主题', () => {
    expect(defaultPreferences.theme.mode).toBe('light');
  });
});
