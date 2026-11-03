export type LoginAccountField = 'email' | 'loginName' | 'telephone';

export class BriefAccountConflictError extends Error {
  constructor() {
    super('目标登录方式已有不同账号，请在完整表单中明确修改');
  }
}

export function classifyLoginAccount(value: unknown): {
  field: LoginAccountField;
  value: string;
} {
  const account = String(value ?? '').trim();
  if (!account) throw new Error('请输入登录账号');
  if (account.length > 128) throw new Error('登录账号不能超过128个字符');

  // 邮箱和手机号先按明显格式识别，格式错误不降级成普通登录名。
  if (account.includes('@')) {
    const [local, domain, extra] = account.split('@');
    if (
      !local ||
      !domain ||
      extra ||
      !domain.includes('.') ||
      /\s/.test(account)
    )
      throw new Error('邮箱格式错误');
    return { field: 'email', value: account };
  }
  if (/^\+?\d{11,}$/.test(account)) {
    if (!/^1[3-9]\d{9}$/.test(account)) throw new Error('手机号格式错误');
    return { field: 'telephone', value: account };
  }
  return { field: 'loginName', value: account };
}

export function preferredLoginAccount(record: null | Record<string, any>) {
  if (!record) return '';
  return String(record.loginName || record.email || record.telephone || '');
}

export function mapBriefLoginAccount(
  account: unknown,
  original: null | Record<string, any>,
  current: Record<string, any>,
) {
  const selected = classifyLoginAccount(account);
  const previousField = original
    ? (['loginName', 'email', 'telephone'] as const).find(
        (key) => original[key],
      )
    : undefined;
  if (
    original &&
    previousField !== selected.field &&
    original[selected.field] &&
    original[selected.field] !== selected.value
  ) {
    throw new BriefAccountConflictError();
  }
  const next = { ...current };
  if (previousField && previousField !== selected.field)
    next[previousField] = null;
  if (selected.field !== 'loginName')
    next.loginName =
      previousField === 'loginName' ? null : (original?.loginName ?? null);
  next[selected.field] = selected.value;
  return { field: selected.field, previousField, values: next };
}
