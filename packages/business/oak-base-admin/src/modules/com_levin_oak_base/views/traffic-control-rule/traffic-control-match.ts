import SpringPatternMatchUtils from '@levin/admin-framework/framework-commons/spring-pattern-match-utils';
import { normalizePatternList as normalizeCommonPatternList } from '@levin/admin-framework';

export interface TrafficControlMatchResult {
  matched: boolean;
  matchedPatterns: string[];
  patterns: string[];
}

export interface TrafficControlRuleMatchResult {
  matched: boolean;
  matchedRules: TrafficControlSimpleRule[];
  rules: TrafficControlSimpleRule[];
}

export interface TrafficControlSimpleRule {
  namePatterns: string[];
  required: boolean;
  valuePatterns: string[];
}

const LIST_SPLIT_RE = /[,，|\r\n]+/;

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function encodeMatchPart(value: string, preserveWildcard = false) {
  const encoded = encodeURIComponent(value);

  if (!preserveWildcard) {
    return encoded;
  }

  return encoded.replaceAll('%2A', '*').replaceAll('%3F', '?');
}

export function normalizePatternList(value: unknown): string[] {
  return normalizeCommonPatternList(value);
}

export function wildcardMatch(pattern: string, input: string) {
  const normalizedPattern = normalizeText(pattern);
  const normalizedInput = normalizeText(input);

  if (!normalizedPattern || !normalizedInput) {
    return false;
  }

  return SpringPatternMatchUtils.simpleMatch(
    normalizedPattern.toLowerCase(),
    normalizedInput.toLowerCase(),
  );
}

export function validateNameValueRuleItem(value: string) {
  const text = normalizeText(value);
  const separatorCount = [...text].filter((char) => char === '=').length;

  if (separatorCount !== 1) {
    return '请求参数/请求头匹配项必须且只能包含一个等号';
  }

  const [rawName, rawValue] = text.split('=');
  const name = normalizeText(rawName);
  const itemValue = normalizeText(rawValue);

  if (!name || !itemValue) {
    return '等号左右两边都不能为空';
  }

  try {
    encodeURIComponent(name);
    encodeURIComponent(itemValue);
  } catch {
    return '等号左右两边必须是可进行URL编码的文本';
  }

  return true;
}

export function matchPatternList(
  patternsSource: unknown,
  inputValue: unknown,
): TrafficControlMatchResult {
  const input = normalizeText(inputValue);
  const patterns = normalizePatternList(patternsSource);
  const matchedPatterns = patterns.filter((pattern) =>
    wildcardMatch(pattern, input),
  );

  return {
    matched: matchedPatterns.length > 0,
    matchedPatterns,
    patterns,
  };
}

function parseMaybeJson(value: string) {
  const text = value.trim();

  if (
    (text.startsWith('[') && text.endsWith(']')) ||
    (text.startsWith('{') && text.endsWith('}'))
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  }

  return value;
}

function firstDefined(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return undefined;
}

function normalizeSimpleRule(entry: unknown): null | TrafficControlSimpleRule {
  if (!entry) {
    return null;
  }

  if (typeof entry === 'string') {
    const text = entry.trim();

    if (!text) {
      return null;
    }

    if (validateNameValueRuleItem(text) !== true) {
      return null;
    }

    const [rawName, rawValue] = text.split('=');

    return {
      namePatterns: normalizePatternList(rawName),
      required: true,
      valuePatterns: normalizePatternList(rawValue),
    };
  }

  if (Array.isArray(entry)) {
    const [name, value = '*'] = entry;

    return {
      namePatterns: normalizePatternList(name),
      required: true,
      valuePatterns: normalizePatternList(value || '*'),
    };
  }

  if (typeof entry === 'object') {
    const record = entry as Record<string, unknown>;
    const namePatterns = normalizePatternList(
      firstDefined(record, [
        'namePatterns',
        'names',
        'namePattern',
        'name',
        'param',
        'header',
      ]),
    );

    if (namePatterns.length === 0) {
      return null;
    }

    return {
      namePatterns,
      required: record.required !== false,
      valuePatterns: normalizePatternList(
        firstDefined(record, [
          'valuePatterns',
          'values',
          'valuePattern',
          'value',
        ]) || '*',
      ),
    };
  }

  return normalizeSimpleRule(String(entry));
}

export function normalizeRuleList(source: unknown): TrafficControlSimpleRule[] {
  if (source === null || source === undefined || source === '') {
    return [];
  }

  if (typeof source === 'string') {
    const parsed = parseMaybeJson(source);

    if (parsed !== source) {
      return normalizeRuleList(parsed);
    }

    return source
      .split(LIST_SPLIT_RE)
      .map((item) => normalizeSimpleRule(item))
      .filter(Boolean) as TrafficControlSimpleRule[];
  }

  if (Array.isArray(source)) {
    return source
      .map((item) => normalizeSimpleRule(item))
      .filter(Boolean) as TrafficControlSimpleRule[];
  }

  if (typeof source === 'object') {
    const record = source as Record<string, unknown>;

    if (Array.isArray(record.rules)) {
      return normalizeRuleList(record.rules);
    }

    if (Array.isArray(record.items)) {
      return normalizeRuleList(record.items);
    }

    const singleRule = normalizeSimpleRule(record);
    return singleRule ? [singleRule] : [];
  }

  return [];
}

export function matchRuleList(
  rulesSource: unknown,
  nameValue: unknown,
  rawValue: unknown,
): TrafficControlRuleMatchResult {
  const name = normalizeText(nameValue);
  const value = normalizeText(rawValue);
  const rules = normalizeRuleList(rulesSource);
  const encodedName = encodeMatchPart(name);
  const encodedValue = encodeMatchPart(value);
  const matchedRules = rules.filter((rule) => {
    const nameMatched = rule.namePatterns.some((pattern) =>
      wildcardMatch(encodeMatchPart(pattern, true), encodedName),
    );
    const valueMatched = rule.valuePatterns.some((pattern) =>
      wildcardMatch(encodeMatchPart(pattern, true), encodedValue),
    );

    return nameMatched && valueMatched;
  });

  return {
    matched: matchedRules.length > 0,
    matchedRules,
    rules,
  };
}

export function normalizeNameValueRuleList(source: unknown): string[] {
  return normalizeRuleList(source).flatMap((rule) =>
    rule.namePatterns.flatMap((namePattern) =>
      rule.valuePatterns.map((valuePattern) => `${namePattern}=${valuePattern}`),
    ),
  );
}
