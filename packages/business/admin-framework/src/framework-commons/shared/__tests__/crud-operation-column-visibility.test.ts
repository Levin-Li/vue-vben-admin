import { describe, expect, it } from 'vitest';

import { shouldShowCrudOperationColumn } from '../crud-operation-column-visibility';

const noOperations = {
  hasBuiltinDelete: false,
  hasBuiltinDetail: false,
  hasBuiltinEdit: false,
  hasRowActionSlot: false,
  hasRowActions: false,
};

describe('CRUD 操作列可见性', () => {
  it('没有可用行操作时隐藏操作列', () => {
    expect(shouldShowCrudOperationColumn(noOperations)).toBe(false);
  });

  it('存在可用内置操作时显示操作列', () => {
    expect(
      shouldShowCrudOperationColumn({
        ...noOperations,
        hasBuiltinEdit: true,
      }),
    ).toBe(true);
  });

  it('存在仅对部分记录可见的自定义操作时保留操作列', () => {
    expect(
      shouldShowCrudOperationColumn({
        ...noOperations,
        hasRowActions: true,
      }),
    ).toBe(true);
  });
});
