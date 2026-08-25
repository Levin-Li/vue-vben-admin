export const LOGIN_HERO_IMAGE_MAX_BYTES = 600 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function isPngFile(file: File) {
  const header = new Uint8Array(
    await file.slice(0, PNG_SIGNATURE.length).arrayBuffer(),
  );

  return PNG_SIGNATURE.every((byte, index) => header[index] === byte);
}

export async function validateLoginHeroImageFile(file: File) {
  if (file.type !== 'image/png') {
    return '登录页图片仅支持 PNG 格式';
  }

  if (file.size >= LOGIN_HERO_IMAGE_MAX_BYTES) {
    return '登录页图片必须小于 600 KB';
  }

  if (!(await isPngFile(file))) {
    return '登录页插画不是有效的 PNG 图片';
  }

  return '';
}

export function getLoginHeroImage(
  uiExInfo: null | Record<string, any> | undefined,
) {
  const setting = uiExInfo?.['admin-ui-base-setting'];
  const heroImage = setting?.setting?.login?.heroImage;

  return typeof heroImage === 'string' ? heroImage.trim() : '';
}
