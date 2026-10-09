import { resolveOAuthPlatformName } from '@levin/admin-framework/framework-commons/app/views/_core/authentication/oauth-platform-name';

/** 协议编码保持不变；仅为未由管理员改名的目录项显示中文平台名。 */
export function resolveServiceProviderName(provider?: {
  code?: string;
  name?: string;
}): string {
  const code = String(provider?.code || '').trim();
  const name = String(provider?.name || '').trim();
  if (name && name !== code) return name;
  return resolveOAuthPlatformName({ code, name });
}

export function filterServiceProviderOption(
  input: string,
  option?: { label?: unknown; value?: unknown },
): boolean {
  const query = input.trim().toLocaleLowerCase();
  if (!query) return true;
  return [option?.label, option?.value].some((value) =>
    String(value ?? '')
      .toLocaleLowerCase()
      .includes(query),
  );
}
