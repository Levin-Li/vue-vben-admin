export function isNaturalPerson(formState: Record<string, any>) {
  return formState.subjectType === 'Person';
}

export function getSubjectIdentityLabel(formState: Record<string, any>) {
  return isNaturalPerson(formState) ? '身份证号' : '统一社会信用码';
}

export function getSubjectIdentityPlaceholder(formState: Record<string, any>) {
  return isNaturalPerson(formState)
    ? '请输入中国居民身份证号'
    : '请输入18位统一社会信用码';
}

export function getSubjectIdentityHelp(formState: Record<string, any>) {
  return isNaturalPerson(formState)
    ? '中国居民身份证号会校验出生日期和18位校验码；兼容15位旧号码。'
    : '法人、个体户和非法人组织填写18位统一社会信用码。';
}

export function getSubjectIdentityImageLabel(formState: Record<string, any>) {
  return isNaturalPerson(formState) ? '身份证照片' : '营业执照';
}

export function getSubjectIdentityImageHelp(formState: Record<string, any>) {
  return isNaturalPerson(formState)
    ? '请按人像页、国徽页顺序上传两张身份证照片。'
    : '仅上传一张营业执照。';
}

function isValidDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isValidChineseIdentityCard(value: string) {
  if (/^\d{15}$/.test(value)) {
    const birthYear = Number(`19${value.slice(6, 8)}`);
    return isValidDate(
      birthYear,
      Number(value.slice(8, 10)),
      Number(value.slice(10, 12)),
    );
  }

  if (!/^\d{17}[\dXx]$/.test(value)) {
    return false;
  }

  const birthYear = Number(value.slice(6, 10));
  if (
    !isValidDate(
      birthYear,
      Number(value.slice(10, 12)),
      Number(value.slice(12, 14)),
    )
  ) {
    return false;
  }

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  const sum = value.slice(0, 17).split('').reduce(
    (total, digit, index) => total + Number(digit) * weights[index],
    0,
  );

  return checkCodes[sum % 11] === value[17].toUpperCase();
}

export function validateSubjectIdentity(
  value: unknown,
  formState: Record<string, any>,
) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return undefined;
  }

  if (isNaturalPerson(formState)) {
    return isValidChineseIdentityCard(normalized)
      ? undefined
      : '请输入有效的中国居民身份证号';
  }

  return /^[0-9A-Z]{18}$/.test(normalized)
    ? undefined
    : '统一社会信用码应为18位大写字母或数字';
}
