import '../packages/business/oak-base-admin/node_modules/ant-design-vue/dist/reset.css';
import '../packages/runtime/src/vendor/styles/index.ts';
import '../packages/runtime/src/vendor/styles/antd/index.css';
import { createApp } from 'vue';
import { initPreferences } from '../packages/@core/foundation/src/vendor/preferences/index.ts';
import App from './preview.vue';
void initPreferences({ namespace: 'report-preview' }).then(() => createApp(App).mount('#app'));
