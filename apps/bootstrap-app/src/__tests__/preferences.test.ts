import { describe, expect, it } from 'vitest';

import { overridesPreferences } from '../preferences';

describe('bootstrap application preferences', () => {
  it('uses the backend administration module as the default application home', () => {
    expect(overridesPreferences.app?.defaultHomePath).toBe('/clob/V1/index');
  });
});
