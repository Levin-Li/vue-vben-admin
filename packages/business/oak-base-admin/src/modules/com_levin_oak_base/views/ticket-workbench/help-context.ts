import { ref } from 'vue';

/** 页面跳转期间仅在当前浏览器会话内保存来源，不把查询参数放入地址。 */
export const ticketHelpContext = ref<{
  captureError?: string;
  path: string;
  screenshotBase64?: string;
  title: string;
}>();
