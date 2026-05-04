import SpringPatternMatchUtils from "./SpringPatternMatchUtils";

/**
 *
 * 权限匹配工具类
 *
 *
 */
export default class RbacPermissionMatchUtils {

    /**
     * 多个权限匹配
     * @param requirePermission
     * @param ownerPermissions
     */
    public static simpleMatchList(requirePermission: string | null | undefined, ownerPermissions: string[] | null | undefined): boolean {

        if (!this.hasText(requirePermission)) {
            return true;
        }

        return !!(
            ownerPermissions?.length &&
            ownerPermissions.some(op => this.simpleMatch(requirePermission, op))
        );
    }

    /**
     * 权限匹配
     *
     * <p>
     * 重要方法，能提升性能
     * <p>
     * 可以支持无限层级
     *
     * @param requirePermission eg. com.oak:系统数据-租户:id2:查询
     * @param ownerPermission   eg. **:查询
     * @return
     */
    public static simpleMatch(requirePermission: string | null | undefined, ownerPermission: string | null | undefined): boolean {

        // 去除所有空字符
        requirePermission = this.trimWhitespace(requirePermission);
        ownerPermission = this.trimWhitespace(ownerPermission);

        // 如果需要的权限为空
        if (!this.hasText(requirePermission)) {
            return true;
        }

        // 如果拥有的权限为空
        if (!this.hasText(ownerPermission)) {
            return false;
        }

        // 1. 如果相等，直接返回
        if (ownerPermission === requirePermission) {
            return true;
        }

        // 是否是角色
        const opIsRole = this.isRole(ownerPermission);
        const rpIsRole = this.isRole(requirePermission);

        if (opIsRole || rpIsRole) {
            // 2. 只要是角色，就只能是角色之间比较
            return opIsRole && rpIsRole && this.textPatternMatch(ownerPermission, requirePermission);
        }

        // 3. 如果拥有权限不是模板
        if (!this.isPattern(ownerPermission)) {
            return false;
        }

        // 切割出单个比较项目
        const ownerList = ownerPermission.split(this.getPermissionDelimiter());
        const requireList = requirePermission.split(this.getPermissionDelimiter());
        const idx = {value: -1};

        return requireList.every(rp => {
            idx.value++;
            const op = idx.value < ownerList.length ? ownerList[idx.value] : ownerList[ownerList.length - 1];
            return this.textPatternMatch(op, this.trimWhitespace(rp));
        });
    }


    /**
     * 文本*号匹配
     * <p>
     * 注意不支持问号
     * <p>
     * 支持按竖线分隔多个或的条件
     * <p>
     * 比如 |修改|删除|查询
     *
     * <p>
     * Match a String against the given pattern, supporting the following simple pattern styles: "xxx*", "*xxx", "*xxx*" and "xxx*yyy" matches (with an arbitrary number of pattern parts), as well as direct equality.
     *
     * @param pattern
     * @param str
     * @return
     * @see SpringPatternMatchUtils#simpleMatch
     */
    public static textPatternMatch(pattern: string | null | undefined, str: string | null | undefined): boolean {

        //如果 str 为空，则直接返回true
        if (!this.hasText(str)) {
            return true;
        }

        if (!this.hasText(pattern)) {
            return false;
        }

        const normalizedPattern = this.trimWhitespace(pattern);
        const normalizedStr = this.trimWhitespace(str);

        return normalizedPattern.split('|')
            .filter(p => this.hasText(p))
            .some(p => SpringPatternMatchUtils.simpleMatch(p, normalizedStr));
    }

    public static trimAllWhitespace(str: string | null | undefined): string {
        return this.replaceAll(str, ' ', '');
    }

    public static replaceAll(str: string | null | undefined, key: string, value: string): string {

        if (str) {
            while (str.indexOf(key) > -1) {
                str = str.replace(key, value);
            }
        }

        return str || '';
    }

    public static trimWhitespace(str: string | null | undefined): string {
        return str ? str.trim() : '';
    }

    public static hasText(str: string | null | undefined): boolean {
        return !!(str && str.trim().length > 0);
    }

    public static isRole(requirePermission: string | null | undefined): boolean {
        return this.hasText(requirePermission) && requirePermission!.trim().indexOf("R_") === 0;
    }

    public static isPattern(permission: string | null | undefined): boolean {
        return this.hasText(permission) && (permission!.indexOf('*') >= 0 || permission!.indexOf('|') >= 0);
    }

    public static getPermissionDelimiter(): string {
        return ':';
    }

}
