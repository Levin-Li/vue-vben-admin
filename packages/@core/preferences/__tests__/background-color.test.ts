import { describe, expect, it } from 'vitest';

import { resolveBackgroundColor } from '../src/background-color';
import { defaultPreferences } from '../src/config';

describe('resolveBackgroundColor', () => {
  it('maps transparency to the inverse background alpha without container opacity', () => {
    expect(resolveBackgroundColor('hsl(210 40% 96%)', 35)).toBe(
      'hsla(210, 40%, 96%, 0.65)',
    );
  });

  it('uses zero transparency by default and one hundred for a fully transparent color', () => {
    expect(resolveBackgroundColor('hsl(210 40% 96%)', 100)).toBe(
      'hsla(210, 40%, 96%, 0)',
    );
    expect(resolveBackgroundColor('hsl(210 40% 96%)')).toBe(
      'hsl(210, 40%, 96%)',
    );
  });

  it('defaults every configurable layout background to zero transparency', () => {
    expect({
      base: defaultPreferences.theme.baseBackgroundTransparency,
      content: defaultPreferences.theme.contentBackgroundTransparency,
      header: defaultPreferences.theme.semiDarkHeaderColorTransparency,
      headerMenu:
        defaultPreferences.theme.headerMenuBackgroundColorTransparency,
      sidebar: defaultPreferences.theme.semiDarkSidebarColorTransparency,
      sidebarMenu:
        defaultPreferences.theme.sidebarMenuBackgroundColorTransparency,
      tabbar: defaultPreferences.tabbar.backgroundTransparency,
    }).toEqual({
      base: 0,
      content: 0,
      header: 0,
      headerMenu: 0,
      sidebar: 0,
      sidebarMenu: 0,
      tabbar: 0,
    });
  });
});
