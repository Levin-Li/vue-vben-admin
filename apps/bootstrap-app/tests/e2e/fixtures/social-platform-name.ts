import { createPinia } from 'pinia';
import { createApp } from 'vue';

import '@vben/runtime/styles';
import '@vben/runtime/styles/antd';

import { setAdminFrameworkRuntime } from '@levin/admin-framework';
import { requestClient } from '@levin/admin-framework/framework-commons/app/api/request';

import SocialAccountSetting from '../../../../../packages/business/admin-framework/src/framework-commons/app/views/_core/profile/social-account-setting.vue';

// 只挂载真实显示组件，不创建后台登录会话；列表HTTP由独立浏览器测试提供。
setAdminFrameworkRuntime({ requestClient });
createApp(SocialAccountSetting).use(createPinia()).mount('#app');
