import { describe, expect, it } from 'vitest';

import backendPagesRoutes from '../backend-pages';

describe('backend page route aliases', () => {
  it('does not register a generic backend iframe fallback route', () => {
    expect(backendPagesRoutes).toEqual([]);
  });
});
