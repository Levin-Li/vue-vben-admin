import type {
  DataModelField,
  DataModelSystemField,
} from '../../../api/data-model-service';

import { reactive } from 'vue';

import { describe, expect, it } from 'vitest';

import {
  buildFieldTableRows,
  cloneDataModelDto,
  fieldSaveRequest,
  removeBusinessField,
  upsertBusinessField,
} from '../field-table';

const amount: DataModelField = {
  key: 'amount',
  name: 'amount',
  title: '金额',
  type: 'MONEY',
  nullable: false,
  precision: 78,
  scale: 18,
};
const memo: DataModelField = {
  key: 'memo',
  name: 'memo',
  title: '说明',
  type: 'TEXT',
  nullable: true,
};

describe('业务字段表格草稿', () => {
  it('vue 响应式业务字段和权限组可安全复制与保存，固定字段不提交', () => {
    const draft = reactive({
      key: 'invoice',
      expectedVersion: 4,
      fields: [{ ...amount, options: [{ value: '1.00', label: '壹元' }] }],
      systemFields: [
        {
          key: 'RECORD_SYSTEM.id',
          source: 'RECORD_SYSTEM' as const,
          name: 'id',
          title: '记录 ID',
          type: 'UUID',
          nullable: false,
        },
      ],
      permissionGroups: [
        { key: 'finance', title: '财务', confidentialLevel: 3 },
      ],
    });
    expect(cloneDataModelDto(draft.fields[0])).toMatchObject({
      name: 'amount',
      options: [{ value: '1.00' }],
    });
    const request = fieldSaveRequest(draft);
    expect(request).toMatchObject({
      expectedVersion: 4,
      permissionGroups: [{ key: 'finance' }],
    });
    expect(request).not.toHaveProperty('systemFields');
  });
  it('默认业务字段优先，筛选后系统字段仍可访问', () => {
    const systemFields: DataModelSystemField[] = [
      {
        key: 'MODEL_ATTRIBUTE.model_key',
        source: 'MODEL_ATTRIBUTE',
        name: 'model_key',
        title: '模型 ID',
        type: 'STRING',
        nullable: false,
      },
    ];
    expect(
      buildFieldTableRows([amount], systemFields, 'ALL').map(
        (row) => row.source,
      ),
    ).toEqual(['BUSINESS', 'MODEL_ATTRIBUTE']);
    expect(
      buildFieldTableRows([amount], systemFields, 'BUSINESS').map(
        (row) => row.key,
      ),
    ).toEqual(['amount']);
    expect(
      buildFieldTableRows([amount], systemFields, 'MODEL_ATTRIBUTE').map(
        (row) => row.key,
      ),
    ).toEqual(['MODEL_ATTRIBUTE.model_key']);
  });
  it('新增和编辑只改变目标行，保留原字段与顺序', () => {
    const rows = [amount, memo];
    const edited = upsertBusinessField(rows, 0, {
      ...amount,
      title: '大额金额',
    });
    expect(edited.map((field) => field.key)).toEqual(['amount', 'memo']);
    expect(edited[0]?.title).toBe('大额金额');
    expect(rows[0]?.title).toBe('金额');
    expect(
      upsertBusinessField(edited, -1, {
        key: 'paid',
        name: 'paid',
        title: '支付',
        type: 'BOOLEAN',
        nullable: true,
      }),
    ).toHaveLength(3);
  });

  it('删除目标业务行，完整列表按打开时的版本保存', () => {
    const fields = removeBusinessField([amount, memo], 1);
    expect(fields.map((field) => field.key)).toEqual(['amount']);
    expect(
      fieldSaveRequest({ key: 'invoice', expectedVersion: 8, fields }),
    ).toMatchObject({
      key: 'invoice',
      expectedVersion: 8,
      fields: [{ key: 'amount' }],
    });
  });

  it('字段分组与引用和业务字段一起保留在版本化保存请求中', () => {
    const grouped = upsertBusinessField([amount], 0, {
      ...amount,
      permissionGroupKey: 'finance',
    });
    const request = fieldSaveRequest({
      key: 'invoice',
      expectedVersion: 9,
      fields: grouped,
      permissionGroups: [
        {
          key: 'finance',
          title: '财务敏感',
          description: '金额字段',
          confidentialLevel: 3,
        },
      ],
    });
    expect(request.fields[0]?.permissionGroupKey).toBe('finance');
    expect(request.permissionGroups).toEqual([
      {
        key: 'finance',
        title: '财务敏感',
        description: '金额字段',
        confidentialLevel: 3,
      },
    ]);
  });
});
