import { pinyin } from 'pinyin-pro';

const SEARCH_SEGMENT_PATTERN = /\p{Script=Han}+|[A-Za-z0-9]+/gu;
const CHINESE_SEGMENT_PATTERN = /^\p{Script=Han}/u;

/** 根据关键字判断原文本是否符合页面端拼音模糊查找规则。 */
export function matchesPinyinFuzzySearch(
  keyword: string,
  originalText: string,
): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;

  // 优先按原文本执行包含匹配，中文关键字也保留直接查找。
  if (originalText.toLowerCase().includes(normalizedKeyword)) return true;
  if (/\p{Script=Han}/u.test(normalizedKeyword)) return false;

  let fullSpelling = '';
  let initials = '';

  // 中文逐字生成完整拼音与首字母，英文按单词生成原词与首字母。
  for (const match of originalText.matchAll(SEARCH_SEGMENT_PATTERN)) {
    const segment = match[0];
    if (CHINESE_SEGMENT_PATTERN.test(segment)) {
      const syllables = pinyin(segment, { toneType: 'none', type: 'array' });
      fullSpelling += syllables.join('');
      initials += syllables.map((syllable) => syllable[0] ?? '').join('');
    } else {
      fullSpelling += segment.toLowerCase();
      initials += segment[0]?.toLowerCase() ?? '';
    }
  }

  return (
    fullSpelling.includes(normalizedKeyword) ||
    initials.includes(normalizedKeyword)
  );
}
