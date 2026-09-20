import { describe, expect, it, vi } from 'vitest';

import {
  registerPreferencesUploadAction,
  usePreferencesUploadAction,
} from '../use-preferences-upload';

describe('偏好设置上传动作注册', () => {
  it('只在宿主注册期间提供上传动作', () => {
    const action = vi.fn();
    const { uploadSettingsAction } = usePreferencesUploadAction();
    const unregister = registerPreferencesUploadAction(action);

    expect(uploadSettingsAction.value).toBe(action);
    uploadSettingsAction.value?.();
    expect(action).toHaveBeenCalledOnce();

    unregister();
    expect(uploadSettingsAction.value).toBeUndefined();
  });
});
