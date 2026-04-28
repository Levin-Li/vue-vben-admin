import { describe, expect, it } from 'vitest';

import {
  applyAreaCascaderValueToRecord,
  findCascaderOptionPath,
  getAreaCascaderValueFromRecord,
} from '../area-cascader';

const areaField = {
  areaCascader: {
    cityCodeKey: 'cityCode',
    cityNameKey: 'cityName',
    districtAdminCodeKey: 'districtAdminCode',
    districtCodeKey: 'districtCode',
    districtNameKey: 'districtName',
    provinceCodeKey: 'provinceCode',
    provinceNameKey: 'provinceName',
  },
  key: 'areaPath',
  label: '省市区',
  type: 'area-cascader' as const,
};

const areaOptions = [
  {
    adminCode: '110000',
    children: [
      {
        adminCode: '110100',
        children: [
          {
            adminCode: '110101',
            code: '110101',
            label: '东城区',
            name: '东城区',
            value: '110101',
          },
        ],
        code: '110100',
        label: '北京市',
        name: '北京市',
        value: '110100',
      },
    ],
    code: '110000',
    label: '北京',
    name: '北京',
    value: '110000',
  },
];

describe('area-cascader', () => {
  it('builds cascader value from existing DTO fields', () => {
    expect(
      getAreaCascaderValueFromRecord(areaField, {
        cityCode: '110100',
        districtCode: '110101',
        provinceCode: '110000',
      }),
    ).toEqual(['110000', '110100', '110101']);
  });

  it('finds selected option path by cascader values', () => {
    expect(
      findCascaderOptionPath(areaOptions, ['110000', '110100', '110101']).map(
        (option) => option.label,
      ),
    ).toEqual(['北京', '北京市', '东城区']);
  });

  it('maps selected area path back to backend DTO fields', () => {
    const payload = applyAreaCascaderValueToRecord(
      {},
      areaField,
      ['110000', '110100', '110101'],
      areaOptions,
    );

    expect(payload).toEqual({
      cityCode: '110100',
      cityName: '北京市',
      districtAdminCode: '110101',
      districtCode: '110101',
      districtName: '东城区',
      provinceCode: '110000',
      provinceName: '北京',
    });
  });
});
