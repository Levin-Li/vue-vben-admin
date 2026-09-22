import { describe, expect, it } from 'vitest';

import { noticePageCrudConfig } from '../config';

describe('通知公告投放范围配置', () => {
  it('为全部通知内容类型提供稳定的编辑选项', async () => {
    const field = noticePageCrudConfig.fields.find(
      (item) => item.key === 'contentType',
    );
    const options = await field?.loadOptions?.();

    expect(options?.map((item) => item.value)).toEqual([
      'Text',
      'Markdown',
      'Html',
      'JsonSchema',
      'AmisJsonView',
      'Pic',
      'Video',
      'Audio',
      'File',
    ]);
  });

  it('为实体新增的投放字段提供多选或编码输入控件', () => {
    const fieldMap = new Map(
      noticePageCrudConfig.fields.map((field) => [field.key, field]),
    );

    expect(fieldMap.get('matchAreaList')).toMatchObject({
      type: 'string-array',
    });
    for (const key of [
      'matchTypeList',
      'matchCategoryList',
      'matchJobPostCodeList',
      'matchRoleCodeList',
      'orgCategoryList',
      'orgTypeList',
    ]) {
      expect(fieldMap.get(key)).toMatchObject({
        detail: true,
        layoutGroup: 'extension',
        multiple: true,
      });
    }
  });
});
