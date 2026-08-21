import type { CrudFieldConfig } from './types';

export function shouldReloadRemoteOptionsOnDropdownOpen(
  field: CrudFieldConfig,
) {
  return !!field.remoteSearch && !!field.loadOptions;
}

export function shouldApplyFieldOptionsRequest(
  requestVersion: number,
  latestRequestVersion: number | undefined,
) {
  return requestVersion === latestRequestVersion;
}

export function shouldLoadFieldOptions(
  hasOptionsLoader: boolean,
  isFieldVisible: boolean,
) {
  return hasOptionsLoader && isFieldVisible;
}
