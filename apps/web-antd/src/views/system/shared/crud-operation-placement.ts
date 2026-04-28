export type NormalizedRecordRefType = 'multiple' | 'none' | 'single';

export interface CrudOperationPlacementInput {
  label: string;
  opRefTargetListName?: string;
  opRefTargetType?: string;
}

export function normalizeCrudRecordRefType(
  value: string | undefined,
): NormalizedRecordRefType {
  const normalized = String(value || 'SingleRow').toLowerCase();

  if (normalized === 'none' || normalized === 'listtable') {
    return 'none';
  }

  if (normalized === 'multiplerow') {
    return 'multiple';
  }

  return 'single';
}

export function getCrudOperationListTable(
  operation: CrudOperationPlacementInput,
) {
  return operation.opRefTargetListName || 'default';
}

export function filterCrudOperationsByListTable<
  T extends CrudOperationPlacementInput,
>(operations: T[], listTableName = 'default') {
  return operations.filter(
    (operation) => getCrudOperationListTable(operation) === listTableName,
  );
}

export function groupCrudOperationsByRecordRef<
  T extends CrudOperationPlacementInput,
>(operations: T[]) {
  const grouped: {
    batch: T[];
    row: T[];
    toolbar: T[];
  } = {
    batch: [],
    row: [],
    toolbar: [],
  };

  for (const operation of operations) {
    const refType = normalizeCrudRecordRefType(operation.opRefTargetType);

    if (refType === 'none') {
      grouped.toolbar.push(operation);
    } else if (refType === 'multiple') {
      grouped.batch.push(operation);
    } else {
      grouped.row.push(operation);
    }
  }

  return grouped;
}
