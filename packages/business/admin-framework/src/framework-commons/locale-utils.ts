export type AdminLocaleMessages = Record<string, unknown>;
export type AdminLocaleMessagesMap = Record<string, AdminLocaleMessages>;
export type AdminLocaleModuleRecord = Record<string, unknown>;
export interface AdminModuleLocalesSource {
  locales?: AdminLocaleMessagesMap;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function mergeAdminLocaleMessages(
  target: AdminLocaleMessages,
  source: AdminLocaleMessages,
) {
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key];
    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      target[key] = mergeAdminLocaleMessages({ ...targetValue }, sourceValue);
      continue;
    }
    target[key] = sourceValue;
  }
  return target;
}

export function expandAdminLocaleLabels(labels: Record<string, unknown>) {
  const messages: AdminLocaleMessages = {};

  for (const [key, value] of Object.entries(labels)) {
    const paths = key
      .split('.')
      .map((item) => item.trim())
      .filter(Boolean);
    if (paths.length === 0 || value === undefined || value === null) {
      continue;
    }

    let current = messages;
    paths.forEach((path, index) => {
      if (index === paths.length - 1) {
        current[path] = value;
        return;
      }

      const next = current[path];
      if (!isPlainObject(next)) {
        current[path] = {};
      }
      current = current[path] as AdminLocaleMessages;
    });
  }

  return messages;
}

function normalizeAdminLocaleCode(locale: string) {
  const [language = '', ...segments] = locale
    .trim()
    .replaceAll('_', '-')
    .split('-')
    .filter(Boolean);

  return [
    language.toLowerCase(),
    ...segments.map((segment) => segment.toUpperCase()),
  ].join('-');
}

function getAdminLocaleModuleMessages(module: unknown) {
  const value =
    module && typeof module === 'object' && 'default' in module
      ? (module as { default?: unknown }).default
      : module;

  return isPlainObject(value) ? value : undefined;
}

function parseAdminLocalePath(path: string) {
  const match = path.match(
    /(?:^|\/)([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)(?:\.json|\/([^/]+)\.json)$/,
  );

  if (!match?.[1]) {
    return undefined;
  }

  return {
    locale: normalizeAdminLocaleCode(match[1]),
    namespace: match[2],
  };
}

export function defineAdminModuleLocales(
  modules: Record<string, AdminLocaleModuleRecord>,
): AdminLocaleMessagesMap {
  const locales: AdminLocaleMessagesMap = {};

  for (const [path, module] of Object.entries(modules)) {
    const parsed = parseAdminLocalePath(path);
    const messages = getAdminLocaleModuleMessages(module);

    if (!parsed || !messages) {
      continue;
    }

    const localeMessages = parsed.namespace
      ? { [parsed.namespace]: messages }
      : messages;

    locales[parsed.locale] = mergeAdminLocaleMessages(
      { ...locales[parsed.locale] },
      localeMessages,
    );
  }

  return locales;
}

export function collectAdminModuleLocales(
  modules: AdminModuleLocalesSource[],
): AdminLocaleMessagesMap {
  const locales: AdminLocaleMessagesMap = {};

  for (const module of modules) {
    for (const [locale, messages] of Object.entries(module.locales || {})) {
      locales[locale] = mergeAdminLocaleMessages(
        { ...locales[locale] },
        messages,
      );
    }
  }

  return locales;
}
