import type { SelectOption } from '@levin/admin-framework/framework-commons/api';

export function confidentialLevelOptions(options: SelectOption[]) {
  return options.flatMap((option) => {
    // EnumController puts EnumDesc.code() in ordinal; value is the enum name.
    const raw = option.ordinal ?? option.value;
    const value =
      typeof raw === 'number' || typeof raw === 'string'
        ? Number(raw)
        : Number.NaN;
    return Number.isInteger(value) ? [{ label: option.label, value }] : [];
  });
}
