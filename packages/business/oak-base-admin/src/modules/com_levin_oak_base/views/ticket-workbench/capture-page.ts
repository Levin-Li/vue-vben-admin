const MAX_ENCODED_LENGTH = 2796204;
const MODERN_COLOR = /\b(?:color|oklch|oklab|lch|lab)\([^()]*\)/gi;
const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'background-image',
  'box-shadow',
  'text-shadow',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'fill',
  'stroke',
];

/** 只修改截图副本，让 html2canvas 能解析浏览器计算出的现代颜色。 */
function normalizeCaptureColors(copy: Document) {
  const view = copy.defaultView;
  if (!view) return;
  const pixel = copy.createElement('canvas');
  pixel.width = 1;
  pixel.height = 1;
  const context = pixel.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const cache = new Map<string, string>();
  const convert = (color: string) => {
    const existing = cache.get(color);
    if (existing) return existing;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    const result = `rgba(${r}, ${g}, ${b}, ${(a ?? 255) / 255})`;
    cache.set(color, result);
    return result;
  };
  for (const element of copy.querySelectorAll<HTMLElement>('*')) {
    const style = view.getComputedStyle(element);
    for (const property of COLOR_PROPERTIES) {
      const value = style.getPropertyValue(property);
      if (!value || !MODERN_COLOR.test(value)) {
        MODERN_COLOR.lastIndex = 0;
        continue;
      }
      MODERN_COLOR.lastIndex = 0;
      element.style.setProperty(
        property,
        value.replace(MODERN_COLOR, convert),
        'important',
      );
    }
  }
}

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
      normalizeCaptureColors(copy);
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
  let current = canvas;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const encoded = current.toDataURL('image/png').split(',')[1];
    if (encoded && encoded.length <= MAX_ENCODED_LENGTH) return encoded;
    if (!current.width || !current.height) break;
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.floor(current.width * 0.75));
    smaller.height = Math.max(1, Math.floor(current.height * 0.75));
    const context = smaller.getContext('2d');
    if (!context) break;
    context.drawImage(current, 0, 0, smaller.width, smaller.height);
    current = smaller;
  }
  throw new Error('截图过大或无法生成');
}
