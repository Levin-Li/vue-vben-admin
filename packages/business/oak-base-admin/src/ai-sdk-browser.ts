// 浏览器运行时由发布构建内联依赖，禁止让子项目直接消费 SDK 的 CommonJS 链路。
export { createOpenAICompatible } from '@ai-sdk/openai-compatible';
export { generateText, wrapLanguageModel } from 'ai';
