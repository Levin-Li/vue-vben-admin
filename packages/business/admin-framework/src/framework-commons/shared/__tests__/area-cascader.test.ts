import { describe, expect, it } from 'vitest';

import {
  applyAreaCascaderValueToRecord,
  getAreaCascaderValueFromRecord,
} from '../area-cascader';

describe('行政区划级联字段映射', () => {
  it('从单字段行政编码恢复完整路径', () => {
    expect(
      getAreaCascaderValueFromRecord(
        {
          areaCascader: { valueKey: 'areaCode' },
          key: 'areaCode',
          label: '区域编码',
          type: 'area-cascader',
        },
        { areaCode: '330106' },
      ),
    ).toEqual(['330000', '330100', '330106']);
  });

  it('保留无法识别的历史编码', () => {
    expect(
      getAreaCascaderValueFromRecord(
        {
          areaCascader: { valueKey: 'areaCode' },
          key: 'areaCode',
          label: '区域编码',
          type: 'area-cascader',
        },
        { areaCode: '999999' },
      ),
    ).toEqual(['999999']);
  });

  it('按单字段和分级字段模型提交编码', () => {
    const singleFieldPayload: Record<string, any> = {};
    applyAreaCascaderValueToRecord(
      singleFieldPayload,
      {
        areaCascader: { valueKey: 'areaCode' },
        key: 'areaCode',
        label: '区域编码',
        type: 'area-cascader',
      },
      ['330000', '330100', '330106'],
    );
    expect(singleFieldPayload).toEqual({ areaCode: '330106' });

    const splitFieldPayload: Record<string, any> = {};
    applyAreaCascaderValueToRecord(
      splitFieldPayload,
      {
        key: 'provinceCode',
        label: '省市区行政编码',
        type: 'area-cascader',
      },
      ['330000', '330100', '330106'],
    );
    expect(splitFieldPayload).toMatchObject({
      cityCode: '330100',
      districtCode: '330106',
      provinceCode: '330000',
    });
  });

  it('编辑清空时为单字段和分级字段写入明确空值', () => {
    const singleFieldPayload: Record<string, any> = {};
    applyAreaCascaderValueToRecord(
      singleFieldPayload,
      {
        areaCascader: { valueKey: 'areaCode' },
        key: 'areaCode',
        label: '区域编码',
        type: 'area-cascader',
      },
      [],
      [],
      true,
    );
    expect(singleFieldPayload).toEqual({ areaCode: null });

    const splitFieldPayload: Record<string, any> = {};
    applyAreaCascaderValueToRecord(
      splitFieldPayload,
      {
        key: 'provinceCode',
        label: '省市区行政编码',
        type: 'area-cascader',
      },
      [],
      [],
      true,
    );
    expect(splitFieldPayload).toEqual({
      cityCode: null,
      cityName: null,
      districtAdminCode: null,
      districtCode: null,
      districtName: null,
      provinceCode: null,
      provinceName: null,
    });
  });
});
