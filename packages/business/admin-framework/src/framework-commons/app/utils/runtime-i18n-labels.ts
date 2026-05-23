import type { AdminLocaleMessages } from '../../locale-utils';

import type { SupportedLanguagesType } from '@vben/locales';

import { unwrapServiceResp } from '../api/service-resp';
import { getAdminI18nLabelSyncService } from '../../runtime';
import {
  expandAdminLocaleLabels,
  mergeAdminLocaleMessages,
} from '../../locale-utils';
import { getApplicationI18nModules } from './application-i18n-modules';

export interface RuntimeI18nLabelsModule {
  labels?: Record<string, string>;
  moduleId?: string;
}

export interface RuntimeI18nLabelsResp {
  modules?: RuntimeI18nLabelsModule[];
}

export interface RuntimeI18nLabelsPayload {
  appCode: string;
  appVersion: string;
  domain?: string;
  language: SupportedLanguagesType;
  moduleIds: string[];
  siteId?: string;
  terminalType: string;
  valueType: 'Label' | 'ResValue';
}

export interface LoadRuntimeI18nLabelsOptions {
  adminFrameworkLocales: Record<string, AdminLocaleMessages>;
  appCode?: string;
  appVersion?: string;
  domain?: string;
  language: SupportedLanguagesType;
  siteId?: string;
  terminalType?: string;
}

const RUNTIME_LABELS_URL =
  '/com.levin.oak.base/V1/api/I18nRes/runtimeLabels';

function collectModuleIds(adminFrameworkLocales: Record<string, AdminLocaleMessages>) {
  return getApplicationI18nModules(adminFrameworkLocales)
    .map((module) => module.name)
    .filter((moduleId) => String(moduleId || '').trim().length > 0);
}

async function fetchRuntimeI18nLabels(payload: RuntimeI18nLabelsPayload) {
  const response = await fetch(RUNTIME_LABELS_URL, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Accept-Language': payload.language,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const responseData = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return unwrapServiceResp(responseData) as RuntimeI18nLabelsResp;
}

export async function loadRuntimeI18nLabels(
  options: LoadRuntimeI18nLabelsOptions,
) {
  const labelSyncService = getAdminI18nLabelSyncService();

  const moduleIds = collectModuleIds(options.adminFrameworkLocales);
  if (moduleIds.length === 0) {
    return {};
  }

  const payload: RuntimeI18nLabelsPayload = {
    appCode: options.appCode || '',
    appVersion: options.appVersion || '',
    domain: options.domain,
    language: options.language,
    moduleIds,
    siteId: options.siteId,
    terminalType: options.terminalType || 'Admin',
    valueType: 'Label',
  };

  try {
    const resp =
      typeof fetch === 'function'
        ? await fetchRuntimeI18nLabels(payload)
        : ((await labelSyncService?.runtimeLabels?.(payload, {
            __silentError: true,
          })) as RuntimeI18nLabelsResp);

    return (resp?.modules || []).reduce((messages, module) => {
      return mergeAdminLocaleMessages(
        messages,
        expandAdminLocaleLabels(module.labels || {}),
      );
    }, {} as AdminLocaleMessages);
  } catch (error) {
    console.warn('[i18n] 获取服务端语言包失败，已继续使用本地语言包。', {
      error,
      language: options.language,
      moduleIds,
    });
    return {};
  }
}
