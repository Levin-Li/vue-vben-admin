export function filterServicePluginOption(
  input: string,
  option?: { label?: unknown; value?: unknown },
) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  return [option?.label, option?.value].some((value) =>
    String(value ?? '').toLowerCase().includes(keyword),
  );
}
