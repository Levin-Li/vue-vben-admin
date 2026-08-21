import { describe, expect, it } from 'vitest';

import { MENU_ICON_GROUPS, MENU_ICON_OPTIONS } from '../menu-icon-options';

describe('menu icon options', () => {
  it('keeps the curated menu icon list locally grouped and in Iconify format', () => {
    expect(MENU_ICON_GROUPS.length).toBeGreaterThan(1);
    expect(MENU_ICON_GROUPS.every((group) => group.options.length > 0)).toBe(
      true,
    );
    expect(
      MENU_ICON_OPTIONS.every((option) => option.icon.startsWith('lucide:')),
    ).toBe(true);
  });

  it('does not include duplicate icon values', () => {
    expect(new Set(MENU_ICON_OPTIONS.map((option) => option.icon)).size).toBe(
      MENU_ICON_OPTIONS.length,
    );
  });
});
