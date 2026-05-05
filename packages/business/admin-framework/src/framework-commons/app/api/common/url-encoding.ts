function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function encodeUrlParamValue(value: string) {
  return encodeURIComponent(safeDecodeURIComponent(value));
}

export function encodeUrlPathSegments(url: string) {
  const [pathAndQuery = '', hash = ''] = url.split('#');
  const [path = '', query = ''] = pathAndQuery.split('?');
  const encodedPath = path
    .split('/')
    .map((segment) => (segment ? encodeUrlParamValue(segment) : segment))
    .join('/');

  return `${encodedPath}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}
