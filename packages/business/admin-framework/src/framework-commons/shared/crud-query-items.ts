import type { CrudFieldConfig } from './types';

export type SearchFieldItem =
  | {
      endKey: string;
      format: 'date' | 'datetime' | 'time';
      key: string;
      kind: 'range';
      label: string;
      startKey: string;
    }
  | { field: CrudFieldConfig; key: string; kind: 'field' };

const RANGE_PREFIX_PAIRS: Array<[string, string]> = [
  ['gte', 'lte'],
  ['gt', 'lt'],
  ['start', 'end'],
  ['begin', 'end'],
  ['from', 'to'],
];
const RANGE_SUFFIX_PAIRS: Array<[string, string]> = [['After', 'Before']];

function getRangePrefixPair(key: string) {
  return RANGE_PREFIX_PAIRS.find(([startPrefix, endPrefix]) => {
    const prefixes = [startPrefix, endPrefix];
    return prefixes.some((prefix) => key.startsWith(prefix));
  });
}

function getRangeSuffixPair(key: string) {
  return RANGE_SUFFIX_PAIRS.find(([startSuffix, endSuffix]) =>
    [startSuffix, endSuffix].some(
      (suffix) => key.length > suffix.length && key.endsWith(suffix),
    ),
  );
}

function isRangeDateField(field: CrudFieldConfig) {
  return (
    (field.type === 'date' ||
      field.type === 'datetime' ||
      field.type === 'time') &&
    !!(getRangePrefixPair(field.key) || getRangeSuffixPair(field.key))
  );
}

function getRangePartnerKey(key: string) {
  const pair = getRangePrefixPair(key);
  if (pair) {
    const [startPrefix, endPrefix] = pair;
    if (key.startsWith(startPrefix)) {
      return `${endPrefix}${key.slice(startPrefix.length)}`;
    }

    if (key.startsWith(endPrefix)) {
      return `${startPrefix}${key.slice(endPrefix.length)}`;
    }
  }

  const suffixPair = getRangeSuffixPair(key);
  if (suffixPair) {
    const [startSuffix, endSuffix] = suffixPair;
    if (key.endsWith(startSuffix)) {
      return `${key.slice(0, -startSuffix.length)}${endSuffix}`;
    }

    if (key.endsWith(endSuffix)) {
      return `${key.slice(0, -endSuffix.length)}${startSuffix}`;
    }
  }

  return '';
}

function isRangeStartKey(key: string) {
  const pair = getRangePrefixPair(key);
  if (pair) return key.startsWith(pair[0]);
  const suffixPair = getRangeSuffixPair(key);
  return !!suffixPair && key.endsWith(suffixPair[0]);
}

function getRangeBaseLabel(label: string) {
  return label
    .replace(/开始$/, '')
    .replace(/结束$/, '')
    .replace(/起始$/, '')
    .replace(/截止$/, '')
    .replace(/[起止]$/, '')
    .trim();
}

export function buildCrudQueryItems(
  fields: CrudFieldConfig[],
): SearchFieldItem[] {
  const fieldMap = new Map(fields.map((field) => [field.key, field]));
  const visited = new Set<string>();
  const items: SearchFieldItem[] = [];

  for (const field of fields) {
    if (visited.has(field.key)) {
      continue;
    }

    if (isRangeDateField(field)) {
      const partnerKey = getRangePartnerKey(field.key);
      const partnerField = fieldMap.get(partnerKey);

      if (
        partnerField &&
        partnerField.type === field.type &&
        isRangeDateField(partnerField)
      ) {
        const startKey = isRangeStartKey(field.key)
          ? field.key
          : partnerField.key;
        const endKey = isRangeStartKey(field.key)
          ? partnerField.key
          : field.key;
        const label = getRangeBaseLabel(field.label || partnerField.label);

        items.push({
          endKey,
          format: field.type as 'date' | 'datetime' | 'time',
          key: `${startKey}__${endKey}`,
          kind: 'range',
          label,
          startKey,
        });

        visited.add(startKey);
        visited.add(endKey);
        continue;
      }
    }

    items.push({
      field,
      key: field.key,
      kind: 'field',
    });
    visited.add(field.key);
  }

  return items;
}
