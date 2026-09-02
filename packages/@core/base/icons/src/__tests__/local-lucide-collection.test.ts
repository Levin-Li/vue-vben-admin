import { describe, expect, it } from 'vitest';

import { listIcons } from '..';

describe('local Lucide Iconify collection', () => {
  it('registers Lucide icons before consumers render them', () => {
    expect(listIcons('', 'lucide')).toEqual(
      expect.arrayContaining(['lucide:settings', 'lucide:user']),
    );
  });
});
