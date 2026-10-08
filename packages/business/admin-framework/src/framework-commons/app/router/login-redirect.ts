import { resolveRestorablePath } from './routes/root-redirect';

/** Vue Router serializes query values; keep an already internal path intact. */
export function resolveLoginRedirect(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') return '';
  let path = candidate;
  if (!path.startsWith('/')) {
    try {
      path = decodeURIComponent(path);
    } catch {
      return '';
    }
  }
  return resolveRestorablePath(path, undefined, '');
}
