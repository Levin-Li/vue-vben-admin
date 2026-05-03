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

  if (code < 10_000) {
    return 'BizWarning';
  }

  if (code < 20_000) {
    return 'BizError';
  }

  if (code < 25_000) {
    return 'AuthenticationError';
  }

  if (code < 30_000) {
    return 'AuthorizationError';
  }

  if (code < 40_000) {
    return 'ResourceError';
  }

  if (code < 50_000) {
    return 'SystemInnerError';
  }

  return 'UnknownError';
}

function getBackendMessage(responseData: ServiceRespLike) {
  return responseData.msg || responseData.detailMsg || '';
}

function isServiceRespBizError(responseData: ServiceRespLike) {
  if (responseData.bizError === true) {
    return true;
  }

  const code = getServiceRespCode(responseData);
  return code > 0 && code < 20_000;
}

export function getServiceRespMessage(responseData: ServiceRespLike) {
  const errorType = getServiceRespType(responseData);
  const backendMessage = getBackendMessage(responseData);

  if (isServiceRespBizError(responseData)) {
    return backendMessage || errorType || '接口处理失败';
  }

  return backendMessage || errorType || '接口处理失败';
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
