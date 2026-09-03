import type { SelectOption } from '../api';
import type { CrudAreaCascaderConfig, CrudFieldConfig } from './types';

import {
  normalizeAdministrativeAreaCode,
  resolveAdministrativeAreaPath,
} from './administrative-area-data';

export const DEFAULT_AREA_CASCADER_CONFIG: Required<CrudAreaCascaderConfig> = {
  cityCodeKey: 'cityCode',
  cityNameKey: 'cityName',
  districtAdminCodeKey: 'districtAdminCode',
  districtCodeKey: 'districtCode',
  districtNameKey: 'districtName',
  normalizeToSixDigits: true,
  provinceCodeKey: 'provinceCode',
  provinceNameKey: 'provinceName',
  openAreaContext: {},
  selectableLevels: [],
  valueKey: '',
};

type GenericRecord = Record<string, any>;

function getAreaCascaderConfig(field: CrudFieldConfig) {
  return {
    ...DEFAULT_AREA_CASCADER_CONFIG,
    ...field.areaCascader,
  };
}

export function getAreaCascaderValueFromRecord(
  field: CrudFieldConfig,
  record: GenericRecord = {},
) {
  const config = getAreaCascaderConfig(field);

  if (config.valueKey && record[config.valueKey]) {
    const value = String(record[config.valueKey]).trim();
    try {
      const path = resolveAdministrativeAreaPath(value).map(
        (node) => node.code,
      );
      return path.length > 0 ? path : [value];
    } catch {
      return [value];
    }
  }

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

function normalizeCodeIfNeeded(value: any, normalizeToSixDigits: boolean) {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  return normalizeToSixDigits ? normalizeAdministrativeAreaCode(value) : value;
}

export function applyAreaCascaderValueToRecord(
  target: GenericRecord,
  field: CrudFieldConfig,
  valuePath: any[] = [],
  options: SelectOption[] = [],
  writeEmptyValues = false,
) {
  const normalizedValuePath = Array.isArray(valuePath) ? valuePath : [];
  const config = getAreaCascaderConfig(field);
  if (config.valueKey) {
    const selectedValue = normalizedValuePath.at(-1);
    if (selectedValue) {
      target[config.valueKey] = normalizeCodeIfNeeded(
        selectedValue,
        config.normalizeToSixDigits,
      );
    } else if (writeEmptyValues) {
      target[config.valueKey] = null;
    }
    return target;
  }

  if (normalizedValuePath.length === 0 && writeEmptyValues) {
    for (const key of new Set([
      config.provinceCodeKey,
      config.provinceNameKey,
      config.cityCodeKey,
      config.cityNameKey,
      config.districtCodeKey,
      config.districtNameKey,
      config.districtAdminCodeKey,
    ])) {
      target[key] = null;
    }
    return target;
  }

  const optionPath = findCascaderOptionPath(options, normalizedValuePath);
  const [province, city, district] = optionPath;
  const [provinceValue, cityValue, districtValue] = normalizedValuePath;

  assignIfPresent(
    target,
    config.provinceCodeKey,
    normalizeCodeIfNeeded(readOptionCode(province), config.normalizeToSixDigits),
  );
  assignIfPresent(target, config.provinceNameKey, readOptionName(province));
  assignIfPresent(
    target,
    config.cityCodeKey,
    normalizeCodeIfNeeded(readOptionCode(city), config.normalizeToSixDigits),
  );
  assignIfPresent(target, config.cityNameKey, readOptionName(city));
  assignIfPresent(
    target,
    config.districtCodeKey,
    normalizeCodeIfNeeded(readOptionCode(district), config.normalizeToSixDigits),
  );
  assignIfPresent(target, config.districtNameKey, readOptionName(district));
  assignIfPresent(
    target,
    config.districtAdminCodeKey,
    normalizeCodeIfNeeded(
      readDistrictAdminCode(district),
      config.normalizeToSixDigits,
    ),
  );

  if (!province && provinceValue) {
    target[config.provinceCodeKey] = normalizeCodeIfNeeded(
      provinceValue,
      config.normalizeToSixDigits,
    );
  }

  if (!city && cityValue) {
    target[config.cityCodeKey] = normalizeCodeIfNeeded(
      cityValue,
      config.normalizeToSixDigits,
    );
  }

  if (!district && districtValue) {
    target[config.districtCodeKey] = normalizeCodeIfNeeded(
      districtValue,
      config.normalizeToSixDigits,
    );
    target[config.districtAdminCodeKey] = normalizeCodeIfNeeded(
      districtValue,
      config.normalizeToSixDigits,
    );
  }

  return target;
}
