import { describe, expect, it } from 'vitest';

import {
  filterAdministrativeAreaOptions,
  formatAdministrativeArea,
  getAdministrativeAreaCascaderOptions,
  hasOpenAreaContext,
  normalizeAdministrativeAreaCode,
  restrictAdministrativeAreaOptionsByLevels,
  resolveAdministrativeAreaCodeLevel,
  resolveAdministrativeAreaSelectableLevels,
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
    const zhejiang = options[0]!;
    const hangzhou = zhejiang.children![0]!;
    expect(zhejiang).toMatchObject({ label: '浙江省', value: '330000' });
    expect(hangzhou).toMatchObject({ label: '杭州市', value: '330100' });
    expect(hangzhou.children).toEqual([
      {
        children: undefined,
        label: '西湖区',
        level: 'district',
        value: '330106',
      },
    ]);
  });

  it('按页面声明限制层级，并将直辖市作为城市编码选择项', () => {
    const options = restrictAdministrativeAreaOptionsByLevels(
      getAdministrativeAreaCascaderOptions(),
      ['city'],
    );
    const zhejiang = options.find((item) => item.value === '330000');
    const beijing = options.find((item) => item.value === '110000');

    expect(zhejiang?.children?.[0]).toMatchObject({
      children: undefined,
      isLeaf: true,
      level: 'city',
      value: '330100',
    });
    expect(beijing).toMatchObject({
      children: undefined,
      isLeaf: true,
      level: 'province',
      value: '110000',
    });
  });

  it('未声明层级时按已有编码判断，空值默认区县', () => {
    expect(resolveAdministrativeAreaSelectableLevels(undefined, '330000')).toEqual([
      'province',
    ]);
    expect(resolveAdministrativeAreaSelectableLevels(undefined, '330100')).toEqual([
      'city',
    ]);
    expect(resolveAdministrativeAreaSelectableLevels(undefined, '330106')).toEqual([
      'district',
    ]);
    expect(resolveAdministrativeAreaSelectableLevels(undefined, '')).toEqual([
      'district',
    ]);
    expect(
      resolveAdministrativeAreaSelectableLevels(['city'], '330106'),
    ).toEqual(['city']);
  });

  it('按编码长度和六码尾码识别省、市、区县层级', () => {
    expect(resolveAdministrativeAreaCodeLevel('33')).toBe('province');
    expect(resolveAdministrativeAreaCodeLevel('3301')).toBe('city');
    expect(resolveAdministrativeAreaCodeLevel('330000')).toBe('province');
    expect(resolveAdministrativeAreaCodeLevel('330100')).toBe('city');
    expect(resolveAdministrativeAreaCodeLevel('330106')).toBe('district');
  });

  it('仅在显式传入开放区域上下文时启用后端过滤', () => {
    expect(hasOpenAreaContext()).toBe(false);
    expect(hasOpenAreaContext({ domain: '   ' })).toBe(false);
    expect(hasOpenAreaContext({ domain: 'site.example.test' })).toBe(true);
    expect(hasOpenAreaContext({ bizCategory: '支付', bizType: '收款' })).toBe(true);
  });
});
