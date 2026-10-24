import type {
  DataModelDefinition,
  DataModelOperationCode,
} from '../../api/data-model-service';

export function modelDisplayCode(key: string): string {
  if (!/^[a-z][a-z0-9_]{0,47}$/.test(key)) throw new Error('模型标识无效');
  return `/clob/V1/DataModelRecord/${key}`;
}

export function isModelActionAllowed(
  model: DataModelDefinition,
  code: DataModelOperationCode,
): boolean {
  return (
    model.operations?.some(
      (operation) =>
        operation.code === code &&
        operation.enabled !== false &&
        operation.available === true &&
        operation.authorized === true,
    ) === true
  );
}
