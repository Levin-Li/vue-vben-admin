import { $t } from '@vben/locales';

export interface ServiceRespLike {
  bizError?: boolean;
  code?: number;
  data?: any;
  detailMsg?: null | string;
  errorType?: null | string;
  msg?: null | string;
  status?: number;
  successful?: boolean;
}

export const UNAUTHORIZED_REQUEST_MESSAGE = '未授权的请求';

/** Mirrors com.levin.commons.service.domain.ServiceResp.ErrorType. */
export enum ErrorType {
  BizWarning = 1,
  BizError = 10_000,
  AuthenticationError = 20_000,
  AuthorizationError = 25_000,
  ResourceError = 30_000,
  SystemInnerError = 40_000,
  UnknownError = 50_000,
}

const ERROR_TYPES_BY_DESCENDING_BASE_CODE = Object.values(ErrorType)
  .filter((value): value is ErrorType => typeof value === 'number')
  .sort((left, right) => right - left);

function getErrorTypeName(errorType: ErrorType) {
  return ErrorType[errorType];
}

export function isServiceResp(value: unknown): value is ServiceRespLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    'code' in record ||
    'status' in record ||
    'successful' in record ||
    'detailMsg' in record ||
    'errorType' in record
  );
}

export function getServiceRespCode(responseData: ServiceRespLike) {
  return Number(responseData.code ?? responseData.status ?? 0);
}

export function isServiceRespSuccessful(responseData: ServiceRespLike) {
  if (typeof responseData.successful === 'boolean') {
    return responseData.successful;
  }

  return getServiceRespCode(responseData) === 0;
}

export function getServiceRespType(responseData: ServiceRespLike) {
  if (responseData.errorType) {
    return String(responseData.errorType);
  }

  const code = getServiceRespCode(responseData);

  if (code === 0) {
    return '';
  }

  if (!Number.isFinite(code)) {
    return getErrorTypeName(ErrorType.UnknownError);
  }

  const errorType = ERROR_TYPES_BY_DESCENDING_BASE_CODE.find(
    (candidate) => code >= candidate,
  );
  return getErrorTypeName(errorType ?? ErrorType.BizWarning);
}

const SERVICE_RESP_ERROR_TYPE_MESSAGE_KEYS: Record<string, string> = {
  [getErrorTypeName(ErrorType.AuthenticationError)]:
    'ui.serviceResp.errorType.authentication',
  [getErrorTypeName(ErrorType.AuthorizationError)]:
    'ui.serviceResp.errorType.authorization',
  [getErrorTypeName(ErrorType.BizError)]: 'ui.serviceResp.errorType.bizError',
  [getErrorTypeName(ErrorType.BizWarning)]:
    'ui.serviceResp.errorType.bizWarning',
  [getErrorTypeName(ErrorType.ResourceError)]:
    'ui.serviceResp.errorType.resource',
  [getErrorTypeName(ErrorType.SystemInnerError)]:
    'ui.serviceResp.errorType.systemInner',
  [getErrorTypeName(ErrorType.UnknownError)]:
    'ui.serviceResp.errorType.unknown',
};

function getServiceRespTypeMessage(errorType: string) {
  const messageKey = SERVICE_RESP_ERROR_TYPE_MESSAGE_KEYS[errorType];
  if (!messageKey) {
    return '';
  }

  const message = $t(messageKey);
  return message && message !== messageKey ? message : '';
}

function getBackendMessage(responseData: ServiceRespLike) {
  return responseData.msg || responseData.detailMsg || '';
}

export function getAuthorizationMessage(
  responseData?: Pick<ServiceRespLike, 'msg'>,
) {
  return responseData?.msg || UNAUTHORIZED_REQUEST_MESSAGE;
}

export function getHttpAuthorizationMessage(
  status: unknown,
  responseData?: Pick<ServiceRespLike, 'msg'>,
) {
  return Number(status) === 403 ? getAuthorizationMessage(responseData) : '';
}

function isBusinessErrorType(errorType: string) {
  return (
    errorType === getErrorTypeName(ErrorType.BizError) ||
    errorType === getErrorTypeName(ErrorType.BizWarning)
  );
}

export function isBusinessErrorResponse(responseData: ServiceRespLike) {
  if (responseData.bizError === true) {
    return true;
  }

  return isBusinessErrorType(getServiceRespType(responseData));
}

export function getServiceRespMessage(responseData: ServiceRespLike) {
  const errorType = getServiceRespType(responseData);
  const errorTypeMessage = getServiceRespTypeMessage(errorType);
  const backendMessage = getBackendMessage(responseData);

  if (errorType === getErrorTypeName(ErrorType.AuthorizationError)) {
    return getAuthorizationMessage(responseData);
  }

  if (isBusinessErrorResponse(responseData) || isBusinessErrorType(errorType)) {
    return backendMessage || errorTypeMessage || errorType || '接口处理失败';
  }

  return errorTypeMessage || backendMessage || errorType || '接口处理失败';
}

export function createServiceRespError(responseData: ServiceRespLike) {
  const error = new Error(getServiceRespMessage(responseData));
  return Object.assign(error, {
    response: {
      data: responseData,
      status: responseData.status || responseData.code || 500,
    },
  });
}

export function unwrapServiceResp<T = any>(responseData: T): any {
  if (!isServiceResp(responseData)) {
    return responseData;
  }

  if (!isServiceRespSuccessful(responseData)) {
    throw createServiceRespError(responseData);
  }

  return responseData.data;
}
