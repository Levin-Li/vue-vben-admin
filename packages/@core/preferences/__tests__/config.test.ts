import { describe, expect, it } from 'vitest';

import { defaultPreferences } from '../src/config';

describe('defaultPreferences immutability test', () => {
  // 创建快照，确保默认配置对象不被修改
  it('should not modify the config object', () => {
    expect(defaultPreferences).toMatchSnapshot();
  });

  it('leaves footer shell-style overrides unset', () => {
    for (const key of [
      'borderBottomWidth',
      'borderLeftWidth',
      'borderRightWidth',
      'borderTopWidth',
      'marginBottom',
      'marginLeft',
      'marginRight',
      'marginTop',
      'radiusBottomLeft',
      'radiusBottomRight',
      'radiusTopLeft',
      'radiusTopRight',
    ]) {
      expect(defaultPreferences.footer).not.toHaveProperty(key);
    }
  });
});
