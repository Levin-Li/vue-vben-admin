import '../packages/business/oak-base-admin/node_modules/ant-design-vue/dist/reset.css';
import '../packages/runtime/src/vendor/styles/index.ts';
import '../packages/runtime/src/vendor/styles/antd/index.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { initPreferences } from '../packages/@core/foundation/src/vendor/preferences/index.ts';
import App from './network.vue';

void initPreferences({ namespace: 'report-network-fixture' }).then(() => createApp(App).use(createPinia()).mount('#app'));
