/** 截取当前可见页面，遮盖明确标注的敏感区域和密码输入。 */
export async function captureVisiblePage(): Promise<string> {
  const { default: html2canvas } = await import('html2canvas');
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!width || !height) throw new Error('当前页面尺寸无效');
  const canvas = await html2canvas(document.body, {
    allowTaint: false,
    backgroundColor: '#ffffff',
    height,
    logging: false,
    onclone: (copy) => {
      for (const element of copy.querySelectorAll<HTMLElement>(
        'input[type="password"], [data-sensitive], [data-private], [data-mask]',
      )) {
        // 隐藏整个元素，覆盖图片、画布等自身仍可绘制内容的替换元素。
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.background = '#444';
        element.style.color = 'transparent';
        element.style.textShadow = 'none';
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')
          (element as HTMLInputElement | HTMLTextAreaElement).value = '';
        else element.replaceChildren();
      }
    },
    scale: Math.min(1, 2048 / Math.max(width, height)),
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    useCORS: false,
    width,
    windowHeight: height,
    windowWidth: width,
    x: window.scrollX,
    y: window.scrollY,
  });
  const encoded = canvas.toDataURL('image/png').split(',')[1];
  if (!encoded || encoded.length > 2796204)
    throw new Error('截图过大或无法生成');
  return encoded;
}
