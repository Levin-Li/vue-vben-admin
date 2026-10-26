import { describe, expect, it } from 'vitest';

import { buildCrudQueryItems } from '../crud-query-items';

describe('标准 CRUD 时间范围查询项', () => {
  it('将 After/Before 后缀的日期时间字段合并为一个范围', () => {
    expect(
      buildCrudQueryItems([
        {
          key: 'expiresAfter',
          label: '到期时间起',
          type: 'datetime',
          search: true,
        },
        {
          key: 'expiresBefore',
          label: '到期时间止',
          type: 'datetime',
          search: true,
        },
      ]),
    ).toEqual([
      {
        kind: 'range',
        key: 'expiresAfter__expiresBefore',
        label: '到期时间',
        format: 'datetime',
        startKey: 'expiresAfter',
        endKey: 'expiresBefore',
      },
    ]);
  });

  it('保留既有前缀范围，并让单个时间字段保持独立', () => {
    const fields = [
      { key: 'gteJoinDate', label: '加入时间开始', type: 'datetime' as const },
      { key: 'lteJoinDate', label: '加入时间结束', type: 'datetime' as const },
      { key: 'createdAt', label: '创建时间', type: 'datetime' as const },
    ];
    expect(buildCrudQueryItems(fields)).toEqual([
      {
        kind: 'range',
        key: 'gteJoinDate__lteJoinDate',
        label: '加入时间',
        format: 'datetime',
        startKey: 'gteJoinDate',
        endKey: 'lteJoinDate',
      },
      { kind: 'field', key: 'createdAt', field: fields[2] },
    ]);
  });
});
