import { describe, expect, it } from 'vitest';

import { shouldShowDraggableFloatingPanelHost } from '../floating-panel-visibility';

describe('floating panel visibility', () => {
  it('hides draggable floating panels without an access token', () => {
    expect(shouldShowDraggableFloatingPanelHost(null, '/index')).toBe(false);
    expect(shouldShowDraggableFloatingPanelHost('', '/index')).toBe(false);
  });

  it('hides draggable floating panels on authentication routes even with an access token', () => {
    expect(
      shouldShowDraggableFloatingPanelHost('access-token', '/auth/login'),
    ).toBe(false);
    expect(
      shouldShowDraggableFloatingPanelHost('access-token', '/auth/code-login'),
    ).toBe(false);
  });

  it('shows draggable floating panels only after login on non-authentication routes', () => {
    expect(shouldShowDraggableFloatingPanelHost('access-token', '/index')).toBe(
      true,
    );
  });
});
