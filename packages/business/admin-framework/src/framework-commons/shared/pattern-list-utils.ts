import SpringPatternMatchUtils from '../spring-pattern-match-utils';

export type PatternMatchMode = 'all' | 'any';

export interface PatternListOption {
  description?: string;
  disabled?: boolean;
  group?: string;
  label?: string;
  value: string;
}

export interface PatternMatchItem {
  matched: boolean;
  pattern: string;
}

export interface PatternListMatchResult {
  items: PatternMatchItem[];
  matched: boolean;
  mode: PatternMatchMode;
  target: string;
}

function dedupePatterns(patterns: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const pattern of patterns) {
    const value = pattern.trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}

function parsePatternText(value: string) {
  const text = value.trim();
  if (!text) {
    return [];
  }

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? ''));
      }
    } catch {
      // Fall back to plain text parsing below.
    }
  }

  return text.split(/[\n,;，|]+/);
}

export function normalizePatternList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return dedupePatterns(value.map((item) => String(item ?? '')));
  }

  if (typeof value === 'string') {
    return dedupePatterns(parsePatternText(value));
  }

  return [];
}

export function stringifyPatternList(value: unknown): string {
  return JSON.stringify(normalizePatternList(value), null, 2);
}

export function filterPatternOptions(
  options: readonly PatternListOption[] | undefined,
  keyword: string,
): PatternListOption[] {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const values = options || [];

  if (!normalizedKeyword) {
    return [...values];
  }

  return values.filter((option) =>
    [option.value, option.label, option.description, option.group]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(normalizedKeyword)),
  );
}

export function matchPatternList(
  patterns: unknown,
  target: null | string | undefined,
  mode: PatternMatchMode = 'any',
): boolean {
  const normalizedPatterns = normalizePatternList(patterns);
  const text = String(target ?? '');

  if (!normalizedPatterns.length || !text) {
    return false;
  }

  const matcher = (pattern: string) =>
    SpringPatternMatchUtils.simpleMatch(pattern, text);

  return mode === 'all'
    ? normalizedPatterns.every(matcher)
    : normalizedPatterns.some(matcher);
}

export function evaluatePatternList(
  patterns: unknown,
  target: null | string | undefined,
  mode: PatternMatchMode = 'any',
): PatternListMatchResult {
  const normalizedPatterns = normalizePatternList(patterns);
  const text = String(target ?? '');
  const items = normalizedPatterns.map((pattern) => ({
    matched: !!text && SpringPatternMatchUtils.simpleMatch(pattern, text),
    pattern,
  }));

  return {
    items,
    matched:
      !!text &&
      !!items.length &&
      (mode === 'all'
        ? items.every((item) => item.matched)
        : items.some((item) => item.matched)),
    mode,
    target: text,
  };
}
