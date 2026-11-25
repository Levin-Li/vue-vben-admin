import { oakBasePost } from './_module';

export type AiModelScope = 'personal' | 'organization' | 'tenant' | 'platform';
export interface AiModelConfigurationView {
  providerCode: string; name?: string; baseUrl?: string; keyConfigured?: boolean;
  defaultModel?: string; models?: Record<string, string>; timeoutSeconds?: number;
  enabled?: boolean; version?: number;
}
export interface AiModelConfigurationInput {
  scope: AiModelScope; providerCode: string; name: string; baseUrl: string;
  apiKey?: string; defaultModel: string; models: Record<string, string>;
  timeoutSeconds: number; enabled: boolean; expectedVersion?: number;
}
interface Response { scopes?: AiModelScope[]; providers?: string[]; settings?: AiModelConfigurationView[]; saved?: AiModelConfigurationView }
const call = (body: object, signal?: AbortSignal) => oakBasePost<Response>(
  '/AiModelSetting/modelConfig', body, { signal, __sensitiveResponse: true, __silentError: true },
);
export const aiModelConfigurationService = {
  async scopes(signal?: AbortSignal) { return (await call({operation: 'metadata'}, signal)).scopes ?? []; },
  async providers(signal?: AbortSignal) { return (await call({operation: 'metadata'}, signal)).providers ?? []; },
  async list(scope: AiModelScope, signal?: AbortSignal) { return (await call({operation: 'list', scope}, signal)).settings ?? []; },
  async save(input: AiModelConfigurationInput, signal?: AbortSignal) { return (await call({...input, operation: 'save'}, signal)).saved; },
};
