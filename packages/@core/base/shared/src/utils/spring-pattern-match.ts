function toWildcardRegExp(pattern: string): RegExp {
  let source = '';

  for (const char of pattern) {
    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else {
      source += char.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    }
  }

  return new RegExp(`^${source}$`);
}

/**
 * Mirrors backend-style simple wildcard semantics, with `?` as one character.
 */
export default class SpringPatternMatchUtils {
  public static simpleMatch(
    pattern: null | string | undefined,
    str: null | string | undefined,
  ): boolean {
    if (!pattern || !str) {
      return false;
    }

    if (!pattern.includes('*') && !pattern.includes('?')) {
      return pattern === str;
    }

    return toWildcardRegExp(pattern).test(str);
  }
}
