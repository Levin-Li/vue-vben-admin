export type NormalizedCrudAction =
  | 'ajax'
  | 'cancel'
  | 'close'
  | 'copy'
  | 'email'
  | 'js'
  | 'jsonp'
  | 'link'
  | 'next'
  | 'prev'
  | 'reloadDataList'
  | 'showForm'
  | 'showIFrame'
  | 'showImage'
  | 'showQrCode'
  | 'showSchema'
  | 'showVideo'
  | 'tel'
  | 'toast'
  | 'updateData'
  | 'url';

const ACTION_MAP: Record<string, NormalizedCrudAction> = {
  ajax: 'ajax',
  cancel: 'cancel',
  close: 'close',
  copy: 'copy',
  email: 'email',
  js: 'js',
  jsonp: 'jsonp',
  link: 'link',
  next: 'next',
  prev: 'prev',
  reloaddatalist: 'reloadDataList',
  showform: 'showForm',
  showiframe: 'showIFrame',
  showimage: 'showImage',
  showqrcode: 'showQrCode',
  showschema: 'showSchema',
  showvideo: 'showVideo',
  tel: 'tel',
  toast: 'toast',
  updatedata: 'updateData',
  url: 'url',
};

export function normalizeCrudAction(action?: string): NormalizedCrudAction {
  const normalized = String(action || 'Auto').toLowerCase();

  if (normalized === 'auto') {
    return 'ajax';
  }

  return ACTION_MAP[normalized] || 'ajax';
}

export function resolveCrudActionAfterSuccess(
  action?: string,
  successAction?: string,
): NormalizedCrudAction {
  const normalizedSuccessAction = String(successAction || 'Auto').toLowerCase();

  if (normalizedSuccessAction === 'auto') {
    return normalizeCrudAction(action) === 'ajax' ? 'reloadDataList' : 'toast';
  }

  return normalizeCrudAction(successAction);
}

export function shouldReloadDataListAfterAction(
  action?: string,
  successAction?: string,
) {
  return (
    resolveCrudActionAfterSuccess(action, successAction) === 'reloadDataList'
  );
}

function getValueByPath(source: any, path: string) {
  let current = source;

  for (const key of path.split('.').filter(Boolean)) {
    current = current?.[key];
  }

  return current;
}

export function pickCrudActionResultData(
  response: any,
  resultActionData?: string,
) {
  const expression = String(resultActionData || '').trim();

  if (!expression) {
    return response;
  }

  const matched = expression.match(/^\$\{(.+)\}$/);
  if (!matched) {
    return expression;
  }

  return getValueByPath(response, matched[1] || '');
}
