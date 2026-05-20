import { describe, expect, it } from 'vitest';

import { useColumns } from '../data';

describe('menu table columns', () => {
  it('places localized view and source path columns at the end of data columns', () => {
    const columns = useColumns() || [];
    const fields = columns.map((column) => column.field);

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'viewPath',
          slots: { default: 'delayedPath' },
          title: '视图路径',
          width: 200,
        }),
        expect.objectContaining({
          field: 'sourceFilePath',
          slots: { default: 'delayedPath' },
          title: '源码文件路径',
          width: 200,
        }),
      ]),
    );
    expect(fields.slice(-3)).toEqual([
      'viewPath',
      'sourceFilePath',
      'operation',
    ]);
  });
});
