import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchIconsData, ICONS_MAP } from '../icons';

describe('fetchIconsData', () => {
  afterEach(() => {
    delete ICONS_MAP.lucide;
    vi.unstubAllGlobals();
  });

  it('uses the locally registered Lucide collection without fetching it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchIconsData('lucide')).resolves.toContain(
      'lucide:settings',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
