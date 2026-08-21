import { describe, expect, it } from 'vitest';

import { serializeCrudFieldValue } from '../crud-field-value';

describe('crud field value serialization', () => {
  it('submits integer enum selections as JSON numbers', () => {
    expect(
      serializeCrudFieldValue(
        {
          key: 'confidentialDataAccessLevel',
          label: '机密数据访问级别',
          type: 'select',
          valueType: 'number',
        },
        '3',
      ),
    ).toBe(3);
  });

  it('submits string enum selections as strings', () => {
    expect(
      serializeCrudFieldValue(
        { key: 'type', label: '类型', type: 'select', valueType: 'string' },
        2,
      ),
    ).toBe('2');
  });

  it('serializes every selected value in a multiple enum field', () => {
    expect(
      serializeCrudFieldValue(
        { key: 'levels', label: '等级', multiple: true, valueType: 'number' },
        ['1', 2],
      ),
    ).toEqual([1, 2]);
  });

  it('rejects invalid numeric enum values before sending a request', () => {
    expect(() =>
      serializeCrudFieldValue(
        { key: 'level', label: '等级', type: 'select', valueType: 'number' },
        'not-a-number',
      ),
    ).toThrow('等级的值[not-a-number]不是有效数字');
  });
});
