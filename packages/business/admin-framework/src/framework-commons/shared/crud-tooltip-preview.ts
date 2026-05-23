export const CRUD_TOOLTIP_MOUSE_ENTER_DELAY = 1;
export const CRUD_TOOLTIP_PREVIEW_ITEM_LIMIT = 8;
export const CRUD_TOOLTIP_PREVIEW_TEXT_LIMIT = 500;

export function buildCrudTooltipText(text: string) {
  if (text.length <= CRUD_TOOLTIP_PREVIEW_TEXT_LIMIT) {
    return text;
  }

  return `${text.slice(
    0,
    CRUD_TOOLTIP_PREVIEW_TEXT_LIMIT,
  )}...\n完整内容请进入详情查看`;
}

export function buildCrudCollectionTooltipText(values: string[]) {
  if (values.length > CRUD_TOOLTIP_PREVIEW_ITEM_LIMIT) {
    return `${values
      .slice(0, CRUD_TOOLTIP_PREVIEW_ITEM_LIMIT)
      .join('\n')}\n... 共 ${values.length} 项，完整内容请进入详情查看`;
  }

  return values.join('\n');
}
