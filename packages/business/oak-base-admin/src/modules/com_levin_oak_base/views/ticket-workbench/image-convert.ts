/** 只接受常见静态图片并转换为受控 PNG；文件不会在此处上传。 */
export async function ticketImageToPng(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('请选择 PNG、JPG 或 WebP 图片');
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error('原始图片不能超过 10 MB');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth > 4096 ||
      image.naturalHeight > 4096
    )
      throw new Error('图片尺寸不能超过 4096×4096');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理图片');
    context.drawImage(image, 0, 0);
    const encoded = canvas.toDataURL('image/png').split(',')[1];
    if (!encoded || encoded.length > 2796204)
      throw new Error('转换后的图片不能超过 2 MB');
    return encoded;
  } finally {
    URL.revokeObjectURL(url);
  }
}
