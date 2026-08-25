import { describe, expect, it } from 'vitest';

import {
  LOGIN_HERO_IMAGE_MAX_BYTES,
  validateLoginHeroImageFile,
} from '../login-hero-image';

const pngHeader = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function createPngFile(size = pngHeader.length) {
  return new File(
    [pngHeader, new Uint8Array(Math.max(0, size - pngHeader.length))],
    'hero.png',
    {
      type: 'image/png',
    },
  );
}

describe('login hero image validation', () => {
  it('accepts a small opaque PNG', async () => {
    await expect(validateLoginHeroImageFile(createPngFile())).resolves.toBe('');
  });

  it('rejects files that are not PNG or exceed the size limit', async () => {
    const jpeg = new File([pngHeader], 'hero.jpg', { type: 'image/jpeg' });

    await expect(validateLoginHeroImageFile(jpeg)).resolves.toBe(
      '登录页图片仅支持 PNG 格式',
    );
    await expect(
      validateLoginHeroImageFile(createPngFile(LOGIN_HERO_IMAGE_MAX_BYTES)),
    ).resolves.toBe('登录页图片必须小于 600 KB');
  });
});
