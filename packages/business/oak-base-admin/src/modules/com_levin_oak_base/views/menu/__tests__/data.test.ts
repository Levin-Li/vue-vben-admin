import { describe, expect, it } from 'vitest';

import { useColumns } from '../data';

describe('menu table columns', () => {
  it('includes fixed-width view and source path columns with delayed path slot', () => {
    const columns = useColumns() || [];

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'viewPath',
          slots: { default: 'delayedPath' },
          title: 'View Path',
          width: 200,
        }),
        expect.objectContaining({
          field: 'sourceFilePath',
          slots: { default: 'delayedPath' },
          title: 'Source File Path',
          width: 200,
        }),
      ]),
    );
  });
});
