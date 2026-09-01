import { describe, expect, it } from 'vitest';

import {
  filterAdministrativeAreaOptions,
  formatAdministrativeArea,
  normalizeAdministrativeAreaCode,
  resolveAdministrativeAreaPath,
} from '../administrative-area-data';

describe('行政区划数据服务', () => {
  it('能够解析常规省市区路径和直辖市区县路径', () => {
    expect(formatAdministrativeArea('330106')).toBe('浙江省 / 杭州市 / 西湖区');
    expect(formatAdministrativeArea('110105')).toBe('北京市 / 朝阳区');
  });

  it('将短编码规范化为六码编码', () => {
    expect(normalizeAdministrativeAreaCode('33')).toBe('330000');
    expect(normalizeAdministrativeAreaCode('3301')).toBe('330100');
    expect(resolveAdministrativeAreaPath('3301').at(-1)?.name).toBe('杭州市');
  });

  it('拒绝非法来源编码', () => {
    expect(() => normalizeAdministrativeAreaCode('3')).toThrow('行政编码必须为2至6位数字');
    expect(() => normalizeAdministrativeAreaCode('33A')).toThrow('行政编码必须为2至6位数字');
  });

  it('仅保留开通区县及其父级导航路径', () => {
    const options = filterAdministrativeAreaOptions(['330106']);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ label: '浙江省', value: '330000' });
    expect(options[0].children[0]).toMatchObject({ label: '杭州市', value: '330100' });
    expect(options[0].children[0].children).toEqual([
      { children: undefined, label: '西湖区', value: '330106' },
    ]);
  });
});
