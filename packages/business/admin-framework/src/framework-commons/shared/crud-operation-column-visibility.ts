export interface CrudOperationColumnVisibilityInput {
  hasBuiltinDelete: boolean;
  hasBuiltinDetail: boolean;
  hasBuiltinEdit: boolean;
  hasRowActionSlot: boolean;
  hasRowActions: boolean;
}

export function shouldShowCrudOperationColumn({
  hasBuiltinDelete,
  hasBuiltinDetail,
  hasBuiltinEdit,
  hasRowActionSlot,
  hasRowActions,
}: CrudOperationColumnVisibilityInput) {
  return (
    hasBuiltinDelete ||
    hasBuiltinDetail ||
    hasBuiltinEdit ||
    hasRowActionSlot ||
    hasRowActions
  );
}
