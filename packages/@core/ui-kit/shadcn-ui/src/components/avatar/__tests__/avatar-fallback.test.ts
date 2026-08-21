import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const avatarPath =
  'packages/@core/ui-kit/shadcn-ui/src/components/avatar/avatar.vue';

describe('avatar fallback', () => {
  it('uses the default user icon instead of initials when no image is available', () => {
    const source = readFileSync(avatarPath, 'utf8');

    expect(source).toContain("import { UserRound } from 'lucide-vue-next';");
    expect(source).toMatch(
      /<AvatarFallback[^>]*>[\s\S]*<UserRound[^>]*aria-hidden="true"[^>]*\/>[\s\S]*<\/AvatarFallback>/,
    );
    expect(source).not.toContain('props.alt.slice(-2).toUpperCase()');
  });

  it('keeps image content covered by the avatar circle', () => {
    const source = readFileSync(avatarPath, 'utf8');

    expect(source).toContain('<AvatarImage :alt="alt" :src="src"');
    expect(source).toContain('objectFit: fit');
  });
});
