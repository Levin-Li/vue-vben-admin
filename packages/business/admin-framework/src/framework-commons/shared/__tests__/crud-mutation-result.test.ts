import { describe, expect, it } from 'vitest';

import { assertCrudMutationApplied } from '../crud-mutation-result';

describe('crud 写操作结果', () => {
  it('拒绝明确的零影响和 false，提示操作未生效', () => {
    for (const result of [{ affected: 0 }, 0, false]) {
      expect(() => assertCrudMutationApplied(result, '更新')).toThrow(
        '更新未生效',
      );
      expect(() => assertCrudMutationApplied(result, '删除')).toThrow(
        '删除未生效',
      );
    }
  });
  it('保留空结果、正影响数和其他业务结果的兼容行为', () => {
    for (const result of [
      undefined,
      null,
      {},
      true,
      1,
      { affected: 1 },
      { data: 0 },
    ]) {
      expect(() => assertCrudMutationApplied(result, '更新')).not.toThrow();
    }
  });
});
