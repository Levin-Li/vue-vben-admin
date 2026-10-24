import type { CrudPageConfig } from '@levin/admin-framework/framework-commons/shared/types';

type PathBuilder = { buildRequestPath: (path: string) => string };
type CrudOperation = keyof NonNullable<CrudPageConfig['dataAttrTargets']>;
type FixedRequest = { method: string; path: string };

function requestTarget(
  service: PathBuilder,
  method: string,
  requestPath: string,
) {
  return {
    method,
    get path() {
      if (typeof service.buildRequestPath !== 'function')
        throw new Error('无法确定属性权限对应的接口，请配置实际请求方法和路径');
      return service.buildRequestPath(requestPath);
    },
  };
}

/** 别名接口须按服务方法中实际发出的请求逐项声明。 */
export function fixedCrudDataAttrTargets(
  service: PathBuilder,
  requests: Partial<Record<CrudOperation, FixedRequest>>,
): NonNullable<CrudPageConfig['dataAttrTargets']> {
  return Object.fromEntries(
    Object.entries(requests).map(([operation, request]) => [
      operation,
      requestTarget(service, request.method, request.path),
    ]),
  );
}

/** 仅供已核实使用固定 create/update/delete/list/retrieve 请求的服务使用。 */
export function standardCrudDataAttrTargets(
  service: PathBuilder,
): NonNullable<CrudPageConfig['dataAttrTargets']> {
  return {
    create: requestTarget(service, 'POST', 'create'),
    update: requestTarget(service, 'PUT', 'update'),
    delete: requestTarget(service, 'DELETE', 'delete'),
    list: requestTarget(service, 'GET', 'list'),
    retrieve: requestTarget(service, 'GET', 'retrieve'),
  };
}
