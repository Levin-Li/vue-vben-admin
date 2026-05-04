import SpringPatternMatchUtils from './spring-pattern-match-utils';

/**
 * 参考后端生成的 RbacPermissionMatchUtils，保持前后端权限匹配规则一致。
 */
export class RbacPermissionMatchUtils {
  public static simpleMatchList(
    requirePermission: null | string | undefined,
    ownerPermissions: null | string[] | undefined,
  ): boolean {
    if (!this.hasText(requirePermission)) {
      return true;
    }

    return (
      !!ownerPermissions &&
      ownerPermissions.length > 0 &&
      ownerPermissions.some((ownerPermission) =>
        this.simpleMatch(requirePermission, ownerPermission),
      )
    );
  }

  public static simpleMatch(
    requirePermission: null | string | undefined,
    ownerPermission: null | string | undefined,
  ): boolean {
    requirePermission = this.trimWhitespace(requirePermission);
    ownerPermission = this.trimWhitespace(ownerPermission);

    if (!this.hasText(requirePermission)) {
      return true;
    }

    if (!this.hasText(ownerPermission)) {
      return false;
    }

    if (ownerPermission === requirePermission) {
      return true;
    }

    const ownerIsRole = this.isRole(ownerPermission);
    const requireIsRole = this.isRole(requirePermission);

    if (ownerIsRole || requireIsRole) {
      return (
        ownerIsRole &&
        requireIsRole &&
        this.textPatternMatch(ownerPermission, requirePermission)
      );
    }

    if (!this.isPattern(ownerPermission)) {
      return false;
    }

    const ownerList = ownerPermission.split(this.getPermissionDelimiter());
    const requireList = requirePermission.split(this.getPermissionDelimiter());

    return requireList.every((requiredPart, index) => {
      const ownerPart =
        index < ownerList.length
          ? ownerList[index]
          : ownerList[ownerList.length - 1];
      return this.textPatternMatch(ownerPart, this.trimWhitespace(requiredPart));
    });
  }

  public static textPatternMatch(
    pattern: null | string | undefined,
    str: null | string | undefined,
  ): boolean {
    return (
      !this.hasText(str) ||
      (!!this.hasText(pattern) &&
        pattern!
          .split('|')
          .filter((item) => this.hasText(item))
          .some((item) => SpringPatternMatchUtils.simpleMatch(item, str)))
    );
  }

  public static hasText(str: null | string | undefined): boolean {
    return !!str && str.trim().length > 0;
  }

  public static isPattern(permission: null | string | undefined): boolean {
    return (
      this.hasText(permission) &&
      (permission!.includes('*') || permission!.includes('|'))
    );
  }

  public static isRole(permission: null | string | undefined): boolean {
    return this.hasText(permission) && permission!.trim().startsWith('R_');
  }

  public static trimWhitespace(str: null | string | undefined): string {
    return str ? str.trim() : '';
  }

  public static getPermissionDelimiter(): string {
    return ':';
  }
}

export default RbacPermissionMatchUtils;
