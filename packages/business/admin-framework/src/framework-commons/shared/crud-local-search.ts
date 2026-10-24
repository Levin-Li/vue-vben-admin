import { matchesPinyinFuzzySearch } from './pinyin-fuzzy-search';

export function filterCrudLocalSelectOption(
  input: string,
  option?: { label?: unknown; value?: unknown },
) {
  const label = String(option?.label ?? '');
  const value = String(option?.value ?? '');

  // 选项值只作既有兜底；显示文本始终参与匹配。
  return (
    matchesPinyinFuzzySearch(input, label) ||
    value.toLowerCase().includes(input.trim().toLowerCase())
  );
}
