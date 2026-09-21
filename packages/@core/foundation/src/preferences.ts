export * from './vendor/preferences/index';
import type { Preferences } from './vendor/preferences/index';
import type { DeepPartial } from './vendor/typings/index';

/** 定义应用偏好覆盖，保留调用方的类型检查。 */
export function defineOverridesPreferences(
  preferences: DeepPartial<Preferences>,
) {
  return preferences;
}
