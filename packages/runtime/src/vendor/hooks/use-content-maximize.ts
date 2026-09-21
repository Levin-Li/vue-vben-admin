import { updatePreferences, usePreferences } from '@vben-core/foundation/preferences';
/**
 * 主体区域最大化
 */
export function useContentMaximize() {
  const { contentIsMaximize } = usePreferences();

  function toggleMaximize() {
    const isMaximize = contentIsMaximize.value;

    updatePreferences({
      header: {
        hidden: !isMaximize,
      },
      sidebar: {
        hidden: !isMaximize,
      },
    });
  }
  return {
    contentIsMaximize,
    toggleMaximize,
  };
}
