import { describe, expect, it } from 'vitest';

import {
  filterCrudOperationsByListTable,
  groupCrudOperationsByRecordRef,
  normalizeCrudRecordRefType,
} from '../crud-operation-placement';

describe('crud-operation-placement', () => {
  it('normalizes backend opRefTargetType values', () => {
    expect(normalizeCrudRecordRefType('None')).toBe('none');
    expect(normalizeCrudRecordRefType('ListTable')).toBe('none');
    expect(normalizeCrudRecordRefType('SingleRow')).toBe('single');
    expect(normalizeCrudRecordRefType('MultipleRow')).toBe('multiple');
    expect(normalizeCrudRecordRefType(undefined)).toBe('single');
  });

  it('filters operations by opRefTargetListName and defaults to default list table', () => {
    const operations = [
      {
        label: '新增',
        opRefTargetListName: 'default',
        opRefTargetType: 'None',
      },
      {
        label: '归档',
        opRefTargetListName: 'archive',
        opRefTargetType: 'SingleRow',
      },
      { label: '更新', opRefTargetType: 'SingleRow' },
      {
        label: '审核',
        opRefTargetListName: 'default',
        opRefTargetType: 'SingleRow',
      },
      {
        label: '历史审核',
        opRefTargetListName: 'archive',
        opRefTargetType: 'SingleRow',
      },
    ];

    expect(filterCrudOperationsByListTable(operations, 'default')).toEqual([
      operations[0],
      operations[2],
      operations[3],
    ]);
  });

  it('groups operations into toolbar, row and batch buckets', () => {
    const grouped = groupCrudOperationsByRecordRef([
      { label: '新增', opRefTargetType: 'None' },
      { label: '导出', opRefTargetType: 'ListTable' },
      { label: '更新', opRefTargetType: 'SingleRow' },
      { label: '批量删除', opRefTargetType: 'MultipleRow' },
    ]);

    expect(grouped.toolbar.map((item) => item.label)).toEqual(['新增', '导出']);
    expect(grouped.row.map((item) => item.label)).toEqual(['更新']);
    expect(grouped.batch.map((item) => item.label)).toEqual(['批量删除']);
  });
});
