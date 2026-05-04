/**
 * 以下代码由 kimi 生成，参考 org.springframework.util.PatternMatchUtils
 */
export default class SpringPatternMatchUtils {

    /**
     * Match a String against the given pattern, supporting the following simple
     * pattern styles: "xxx*", "*xxx", "*xxx*" and "xxx*yyy" matches (with an
     * arbitrary number of pattern parts), as well as direct equality.
     * @param pattern the pattern to match against
     * @param str the String to match
     * @return whether the String matches the given pattern
     */
    public static simpleMatch(pattern: string | null | undefined, str: string | null | undefined): boolean {

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
                if (this.simpleMatch(pattern.substring(nextIndex), str.substring(partIndex + part.length))) {
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

    /**
     * Match a String against the given patterns, supporting the following simple
     * pattern styles: "xxx*", "*xxx", "*xxx*" and "xxx*yyy" matches (with an
     * arbitrary number of pattern parts), as well as direct equality.
     * @param patterns the patterns to match against
     * @param str the String to match
     * @return whether the String matches any of the given patterns
     */
    public static simpleMatch2(patterns: string[] | null | undefined, str: string | null | undefined): boolean {
        if (patterns && str) {
            for (const pattern of patterns) {
                if (this.simpleMatch(pattern, str)) {
                    return true;
                }
            }
        }
        return false;
    }
}
