import { shallowRef } from 'vue';

type PreferencesUploadAction = () => void;

// 后台宿主按当前登录权限注册上传动作，通用偏好组件不直接依赖业务接口。
const uploadSettingsAction = shallowRef<PreferencesUploadAction>();

function registerPreferencesUploadAction(action: PreferencesUploadAction) {
  uploadSettingsAction.value = action;

  return () => {
    if (uploadSettingsAction.value === action) {
      uploadSettingsAction.value = undefined;
    }
  };
}

function usePreferencesUploadAction() {
  return { uploadSettingsAction };
}

export { registerPreferencesUploadAction, usePreferencesUploadAction };
