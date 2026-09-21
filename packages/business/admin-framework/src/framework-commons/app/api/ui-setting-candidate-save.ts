import { requestClient } from './request';
import {
  type UiSettingRuntimeRecord,
  UI_SETTING_RETRIEVE_PATH,
} from './ui-setting-runtime';

export interface UiSettingCandidateSaveData {
  code: string;
  domain?: null | string;
  name: string;
  orgCategory?: null | string;
  orgType?: null | string;
  tenantId?: null | string;
  type: string;
  userCategory?: null | string;
  userType?: null | string;
  valueContent: Record<string, any>;
}

interface UiSettingCandidatePage {
  items?: UiSettingRuntimeRecord[];
}

export type UiSettingCandidateSelector = (
  candidates: UiSettingRuntimeRecord[],
  candidateCount: number,
) => Promise<UiSettingRuntimeRecord | undefined>;

/**
 * 供三套界面设置上传共用：查询第一页十条精确候选，再决定更新或新建。
 */
export async function findUiSettingCandidates(
  data: Omit<UiSettingCandidateSaveData, 'name' | 'valueContent'>,
): Promise<UiSettingRuntimeRecord[]> {
  const candidatePage = await requestClient.get<UiSettingCandidatePage>(
    '/UiSetting/findCandidates',
    {
      params: {
        code: data.code,
        domain: data.domain || null,
        orgCategory: data.orgCategory || null,
        orgType: data.orgType || null,
        pageIndex: 1,
        pageSize: 10,
        tenantId: data.tenantId || null,
        type: data.type,
        userCategory: data.userCategory || null,
        userType: data.userType || null,
      },
    },
  );
  return candidatePage?.items || [];
}

/** 保存时重新查询，避免使用预览阶段的过期候选。 */
export async function saveUiSettingWithCandidates(
  data: UiSettingCandidateSaveData,
  selectCandidate?: UiSettingCandidateSelector,
): Promise<UiSettingRuntimeRecord> {
  const candidates = await findUiSettingCandidates(data);
  const candidateCount = candidates.length;
  const target =
    candidateCount === 1
      ? candidates[0]
      : candidateCount > 1
        ? await selectCandidate?.(candidates, candidateCount)
        : undefined;

  if (target?.id) {
    const latest = await requestClient.get<UiSettingRuntimeRecord>(
      UI_SETTING_RETRIEVE_PATH,
      { params: { id: target.id } },
    );
    const optimisticLock = latest?.optimisticLock ?? target.optimisticLock ?? 0;
    await requestClient.put('/UiSetting/update', {
      id: target.id,
      optimisticLock,
      valueContent: data.valueContent,
    });
    return {
      ...target,
      optimisticLock: optimisticLock + 1,
      valueContent: data.valueContent,
    };
  }

  const id = await requestClient.post<string>('/UiSetting/create', data);
  return { ...data, id };
}
