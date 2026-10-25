import { describe, expect, it } from 'vitest';

import { confidentialLevelOptions } from '../confidential-level';

describe('领域模型字段权限组机密级别', () => {
  it('使用枚举接口的 code/ordinal，而非枚举名', () => {
    expect(
      confidentialLevelOptions([
        { label: '平台公开', value: 'PLATFORM_PUBLIC', ordinal: 0 },
        { label: '平台共享', value: 'PLATFORM_SHARED', ordinal: 10 },
      ]),
    ).toEqual([
      { label: '平台公开', value: 0 },
      { label: '平台共享', value: 10 },
    ]);
  });

  it('兼容直接返回数值的旧选项并忽略无效选项', () => {
    expect(
      confidentialLevelOptions([
        { label: '级别 3', value: 3 },
        { label: '无效', value: 'UNKNOWN' },
      ]),
    ).toEqual([{ label: '级别 3', value: 3 }]);
  });
});
