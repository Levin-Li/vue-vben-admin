import type { CrudFieldConfig } from '../types';

import { describe, expect, it, vi } from 'vitest';

import {
  buildGroupSubmitConfirmation,
  getUnsubmittedCrudGroupFields,
  omitUnsubmittedCrudGroupFields,
} from '../crud-group-submit';

const field = (showSubmitCheckbox?: boolean): CrudFieldConfig => ({
  key: 'note',
  label: '备注',
  required: true,
  displayGroup: { key: 'extra', showSubmitCheckbox },
});

describe('可配置分组提交勾选', () => {
  it.each([undefined, false, true])(
    '未显示或已勾选始终沿用原提交逻辑：%s',
    (show) => {
      expect(getUnsubmittedCrudGroupFields([field(show)], {})).toEqual([]);
      expect(
        getUnsubmittedCrudGroupFields([field(show)], { extra: true }),
      ).toEqual([]);
    },
  );
  it('仅显式展示且取消勾选才排除，关闭配置后恢复', () => {
    expect(
      getUnsubmittedCrudGroupFields([field(true)], { extra: false }),
    ).toEqual([field(true)]);
    expect(
      getUnsubmittedCrudGroupFields([field(false)], { extra: false }),
    ).toEqual([]);
    expect(getUnsubmittedCrudGroupFields([field()], { extra: false })).toEqual(
      [],
    );
    expect(
      getUnsubmittedCrudGroupFields(
        [{ ...field(true), complexGroupKey: 'nested' }],
        { extra: false },
      ),
    ).toEqual([]);
  });
  it('没有排除项时不改变原请求，有排除项时保留标识和输入', () => {
    const data = { id: 'id', optimisticLock: 2, note: '未保存输入' };
    expect(omitUnsubmittedCrudGroupFields(data, [])).toBe(data);
    expect(
      omitUnsubmittedCrudGroupFields(
        data,
        [
          field(true),
          { key: 'id', label: 'ID' },
          { key: 'optimisticLock', label: '版本' },
        ],
        ['id', 'optimisticLock'],
      ),
    ).toEqual({ id: 'id', optimisticLock: 2 });
    expect(data.note).toBe('未保存输入');
  });
  it('最终过滤地址映射和强制更新字段列表', () => {
    expect(
      omitUnsubmittedCrudGroupFields(
        {
          cityName: '城市',
          name: '名称',
          forceUpdateFields: ['cityName', 'name'],
        },
        [{ ...field(true), type: 'area-cascader' }],
      ),
    ).toEqual({ name: '名称', forceUpdateFields: ['name'] });
  });
  it('提示不保存风险，只有执行确认回调后才取消勾选', () => {
    const onConfirm = vi.fn();
    const options = buildGroupSubmitConfirmation('补充信息', onConfirm);
    expect(options.content).toContain(
      '当前填写的内容不会保存，关闭表单后将丢失',
    );
    expect(options.cancelText).toBe('取消');
    expect(onConfirm).not.toHaveBeenCalled();
    options.onOk();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
