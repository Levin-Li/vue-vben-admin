import { describe, expect, it } from 'vitest';

import { overridesPreferences } from '../preferences';

describe('bootstrap application preferences', () => {
  it('uses the backend administration module as the default application home', () => {
    expect(overridesPreferences.app?.defaultHomePath).toBe('/clob/V1/index');
  });

  it('uses the light theme by default', () => {
    expect(overridesPreferences.theme?.mode).toBe('light');
  });
});
