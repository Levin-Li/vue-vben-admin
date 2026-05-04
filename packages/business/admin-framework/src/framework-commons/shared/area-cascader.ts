import type { SelectOption } from '../api';

import type { CrudAreaCascaderConfig, CrudFieldConfig } from './types';

export const DEFAULT_AREA_CASCADER_CONFIG: Required<CrudAreaCascaderConfig> = {
  cityCodeKey: 'cityCode',
  cityNameKey: 'cityName',
  districtAdminCodeKey: 'districtAdminCode',
  districtCodeKey: 'districtCode',
  districtNameKey: 'districtName',
  provinceCodeKey: 'provinceCode',
  provinceNameKey: 'provinceName',
};

type GenericRecord = Record<string, any>;

function getAreaCascaderConfig(field: CrudFieldConfig) {
  return {
    ...DEFAULT_AREA_CASCADER_CONFIG,
    ...(field.areaCascader || {}),
  };
}

export function getAreaCascaderValueFromRecord(
  field: CrudFieldConfig,
  record: GenericRecord = {},
) {
  const config = getAreaCascaderConfig(field);

  return [
    record[config.provinceCodeKey],
    record[config.cityCodeKey],
    record[config.districtCodeKey],
  ]
    .map((value) =>
      value === null || value === undefined ? '' : String(value).trim(),
    )
    .filter(Boolean);
}

export function findCascaderOptionPath(
  options: SelectOption[] = [],
  valuePath: any[] = [],
) {
  const result: SelectOption[] = [];
  let currentOptions = options;

  for (const value of valuePath) {
    const matched = currentOptions.find(
      (option) => String(option.value) === String(value),
    );

    if (!matched) {
      break;
    }

    result.push(matched);
    currentOptions = matched.children || [];
  }

  return result;
}

function readOptionCode(option: SelectOption | undefined) {
  return option?.code ?? option?.id ?? option?.value;
}

function readOptionName(option: SelectOption | undefined) {
  return option?.name ?? option?.label;
}

function readDistrictAdminCode(option: SelectOption | undefined) {
  return (
    option?.adminCode ??
    option?.districtAdminCode ??
    option?.nationalCode ??
    option?.id ??
    option?.value
  );
}

function assignIfPresent(target: GenericRecord, key: string, value: any) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  target[key] = value;
}

export function applyAreaCascaderValueToRecord(
  target: GenericRecord,
  field: CrudFieldConfig,
  valuePath: any[] = [],
  options: SelectOption[] = [],
) {
  const normalizedValuePath = Array.isArray(valuePath) ? valuePath : [];
  const config = getAreaCascaderConfig(field);
  const optionPath = findCascaderOptionPath(options, normalizedValuePath);
  const [province, city, district] = optionPath;
  const [provinceValue, cityValue, districtValue] = normalizedValuePath;

  assignIfPresent(target, config.provinceCodeKey, readOptionCode(province));
  assignIfPresent(target, config.provinceNameKey, readOptionName(province));
  assignIfPresent(target, config.cityCodeKey, readOptionCode(city));
  assignIfPresent(target, config.cityNameKey, readOptionName(city));
  assignIfPresent(target, config.districtCodeKey, readOptionCode(district));
  assignIfPresent(target, config.districtNameKey, readOptionName(district));
  assignIfPresent(
    target,
    config.districtAdminCodeKey,
    readDistrictAdminCode(district),
  );

  if (!province && provinceValue) {
    target[config.provinceCodeKey] = provinceValue;
  }

  if (!city && cityValue) {
    target[config.cityCodeKey] = cityValue;
  }

  if (!district && districtValue) {
    target[config.districtCodeKey] = districtValue;
    target[config.districtAdminCodeKey] = districtValue;
  }

  return target;
}
