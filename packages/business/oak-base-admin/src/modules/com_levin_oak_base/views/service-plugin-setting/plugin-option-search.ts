import { matchesPinyinFuzzySearch } from '@levin/admin-framework';

export function filterServicePluginOption(
  input: string,
  option?: { label?: unknown; value?: unknown },
) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  return (
    matchesPinyinFuzzySearch(input, String(option?.label ?? '')) ||
    String(option?.value ?? '')
      .toLowerCase()
      .includes(keyword)
  );
}
