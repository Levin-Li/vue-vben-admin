import { describe, expect, it } from 'vitest';

import { formatDetailDisplayValue } from '../detail-display';

describe('详情行政区划编码展示', () => {
  it('将区域编码展示为中文路径', () => {
    expect(
      formatDetailDisplayValue({
        field: {
          key: 'areaCode',
          label: '区域编码',
        },
        key: 'areaCode',
        kind: 'scalar',
        label: '区域编码',
        value: '330106',
      }),
    ).toBe('浙江省 / 杭州市 / 西湖区');
  });

  it('保留未知历史编码', () => {
    expect(
      formatDetailDisplayValue({
        field: {
          key: 'regionCode',
          label: '行政编码',
        },
        key: 'regionCode',
        kind: 'scalar',
        label: '行政编码',
        value: '999999',
      }),
    ).toBe('999999');
  });
});
