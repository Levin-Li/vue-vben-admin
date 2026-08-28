function matchPathSegment(pattern: string, target: string) {
  const source = [...pattern]
    .map((character) => {
      if (character === '*') {
        return '[^/]*';
      }
      if (character === '?') {
        return '[^/]';
      }
      return character.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    })
    .join('');

  return new RegExp(`^${source}$`).test(target);
}

/**
 * Matches the organization-scope subset of Spring PathPattern syntax.
 */
export function matchPathPattern(rawPattern: string, rawTarget: string) {
  const pattern = rawPattern.trim();
  const target = rawTarget.trim();

  if (
    !pattern ||
    !target ||
    !pattern.startsWith('/') ||
    !target.startsWith('/')
  ) {
    return false;
  }

  const patternSegments = pattern === '/' ? [] : pattern.slice(1).split('/');
  const targetSegments = target === '/' ? [] : target.slice(1).split('/');

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];

    if (patternSegment === '**') {
      return index === patternSegments.length - 1;
    }

    const targetSegment = targetSegments[index];
    if (
      targetSegment === undefined ||
      !matchPathSegment(patternSegment || '', targetSegment)
    ) {
      return false;
    }
  }

  return patternSegments.length === targetSegments.length;
}
