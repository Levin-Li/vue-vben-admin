function trimWhitespace(value: string) {
  return String(value || '').trim();
}

function hasText(value: string) {
  return trimWhitespace(value).length > 0;
}

function isRolePermission(value: string) {
  return hasText(value) && trimWhitespace(value).startsWith('R_');
}

function isPatternPermission(value: string) {
  return hasText(value) && (value.includes('*') || value.includes('|'));
}

export function simplePatternMatch(pattern: string, value: string): boolean {
  if (!pattern || !value) {
    return false;
  }

  const firstIndex = pattern.indexOf('*');
  if (firstIndex === -1) {
    return pattern === value;
  }

  if (firstIndex === 0) {
    if (pattern.length === 1) {
      return true;
    }

    const nextIndex = pattern.indexOf('*', 1);
    if (nextIndex === -1) {
      return value.endsWith(pattern.slice(1));
    }

    const part = pattern.slice(1, nextIndex);
    if (!part) {
      return simplePatternMatch(pattern.slice(nextIndex), value);
    }

    let partIndex = value.indexOf(part);
    while (partIndex !== -1) {
      if (
        simplePatternMatch(
          pattern.slice(nextIndex),
          value.slice(partIndex + part.length),
        )
      ) {
        return true;
      }
      partIndex = value.indexOf(part, partIndex + 1);
    }

    return false;
  }

  return (
    value.length >= firstIndex &&
    pattern.startsWith(value.slice(0, firstIndex)) &&
    simplePatternMatch(pattern.slice(firstIndex), value.slice(firstIndex))
  );
}

function textPatternMatch(pattern: string, value: string) {
  if (!hasText(value)) {
    return true;
  }

  return pattern
    .split('|')
    .map((item) => trimWhitespace(item))
    .filter(Boolean)
    .some((item) => simplePatternMatch(item, value));
}

export function simpleMatch(
  requirePermission: string,
  ownerPermission: string,
) {
  const required = trimWhitespace(requirePermission);
  const owned = trimWhitespace(ownerPermission);

  if (!hasText(required)) {
    return true;
  }

  if (!hasText(owned)) {
    return false;
  }

  if (required === owned) {
    return true;
  }

  const ownerIsRole = isRolePermission(owned);
  const requiredIsRole = isRolePermission(required);

  if (ownerIsRole || requiredIsRole) {
    return ownerIsRole && requiredIsRole && textPatternMatch(owned, required);
  }

  if (!isPatternPermission(owned)) {
    return false;
  }

  const ownerList = owned.split(':');
  const requireList = required.split(':');

  return requireList.every((item, index) => {
    const ownerItem =
      index < ownerList.length
        ? ownerList[index]
        : ownerList[ownerList.length - 1];
    return textPatternMatch(ownerItem || '', trimWhitespace(item));
  });
}

export function simpleMatchList(
  requirePermission: string,
  ownerPermissions: string[],
) {
  if (!hasText(requirePermission)) {
    return true;
  }

  return ownerPermissions.some((item) => simpleMatch(requirePermission, item));
}

export const RbacPermissionMatchUtils = {
  simpleMatch,
  simpleMatchList,
};
