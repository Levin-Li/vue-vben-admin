import { describe, expect, it } from 'vitest';

import { overridesPreferences } from '../preferences';

describe('bootstrap application preferences', () => {
  it('uses the backend administration module as the default application home', () => {
    expect(overridesPreferences.app?.defaultHomePath).toBe('/clob/V1/index');
  });

  it('主题模式使用公共偏好默认值，不在启动应用重复覆盖', () => {
    expect(overridesPreferences.theme).toBeUndefined();
  });
});
