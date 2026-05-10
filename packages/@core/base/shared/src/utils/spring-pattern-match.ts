/**
 * Mirrors the backend SpringPatternMatchUtils simple wildcard semantics.
 */
export default class SpringPatternMatchUtils {
  public static simpleMatch(
    pattern: null | string | undefined,
    str: null | string | undefined,
  ): boolean {
    if (!pattern || !str) {
      return false;
    }

    const firstIndex = pattern.indexOf('*');
    if (firstIndex === -1) {
      return pattern === str;
    }

    if (firstIndex === 0) {
      if (pattern.length === 1) {
        return true;
      }

      const nextIndex = pattern.indexOf('*', 1);
      if (nextIndex === -1) {
        return str.endsWith(pattern.substring(1));
      }

      const part = pattern.substring(1, nextIndex);
      if (part.length === 0) {
        return this.simpleMatch(pattern.substring(nextIndex), str);
      }

      let partIndex = str.indexOf(part);
      while (partIndex !== -1) {
        if (
          this.simpleMatch(
            pattern.substring(nextIndex),
            str.substring(partIndex + part.length),
          )
        ) {
          return true;
        }
        partIndex = str.indexOf(part, partIndex + 1);
      }

      return false;
    }

    return (
      str.length >= firstIndex &&
      pattern.startsWith(str.substring(0, firstIndex)) &&
      this.simpleMatch(pattern.substring(firstIndex), str.substring(firstIndex))
    );
  }
}
