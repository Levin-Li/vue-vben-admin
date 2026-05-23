import { describe, expect, it } from 'vitest';

import {
  buildCrudCollectionTooltipText,
  buildCrudTooltipText,
  CRUD_TOOLTIP_MOUSE_ENTER_DELAY,
} from '../crud-tooltip-preview';

describe('crud tooltip preview', () => {
  it('uses a one second hover delay for scoped CRUD tooltips', () => {
    expect(CRUD_TOOLTIP_MOUSE_ENTER_DELAY).toBe(1);
  });

  it('limits very long tooltip text and points users to details', () => {
    const text = 'a'.repeat(520);
    const tooltipText = buildCrudTooltipText(text);

    expect(tooltipText.length).toBeLessThan(text.length);
    expect(tooltipText).toContain('完整内容请进入详情查看');
  });

  it('shows only the first eight collection items in hover previews', () => {
    const tooltipText = buildCrudCollectionTooltipText(
      Array.from({ length: 10 }, (_, index) => `item-${index + 1}`),
    );

    expect(tooltipText).toContain('item-1');
    expect(tooltipText).toContain('item-8');
    expect(tooltipText).not.toContain('item-9');
    expect(tooltipText).toContain('共 10 项');
  });
});
