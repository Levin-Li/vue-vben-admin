const RES_AUTHORIZE_META = Symbol('RES_AUTHORIZE_META');
const SERVICE_META = Symbol('SERVICE_META');
const CRUD_LIST_TABLE_META = Symbol('CRUD_LIST_TABLE_META');
const CRUD_OP_META = Symbol('CRUD_OP_META');

export type CrudAction =
  | 'Ajax'
  | 'Auto'
  | 'Cancel'
  | 'Close'
  | 'Copy'
  | 'Email'
  | 'Js'
  | 'Jsonp'
  | 'Link'
  | 'Next'
  | 'Prev'
  | 'ReloadDataList'
  | 'ShowForm'
  | 'ShowIFrame'
  | 'ShowImage'
  | 'ShowQrCode'
  | 'ShowSchema'
  | 'ShowVideo'
  | 'Tel'
  | 'Toast'
  | 'UpdateData'
  | 'Url';

export type CrudLevel =
  | 'Auto'
  | 'Danger'
  | 'Dark'
  | 'Info'
  | 'Light'
  | 'Link'
  | 'Primary'
  | 'Secondary'
  | 'Success'
  | 'Warning';

export type CrudOpRefTargetType =
  | 'ListTable'
  | 'MultipleRow'
  | 'None'
  | 'SingleRow';

export type CrudViewContainerType = 'Auto' | 'Dialog' | 'Drawer' | 'Inline';

export interface CrudListTableMeta {
  desc?: string;
  name?: string;
  refEntityClass?: string;
  style?: string;
  title?: string;
  visibleOn?: string;
}

export type CrudListTableResolvedMeta = Required<CrudListTableMeta>;

export interface CrudOpMeta {
  action?: CrudAction;
  actionData?: string;
  confirmText?: string;
  confirmTitle?: string;
  desc?: string;
  failAction?: CrudAction;
  icon?: string;
  label?: string;
  level?: CrudLevel;
  name?: string;
  opRefTargetListName?: string;
  opRefTargetType?: CrudOpRefTargetType;
  resultActionData?: string;
  successAction?: CrudAction;
  viewContainerType?: CrudViewContainerType;
  visibleOn?: string;
}

export type CrudOpResolvedMeta = Required<CrudOpMeta>;

export interface ResAuthorizeMeta {
  domain?: string;
  type?: string;
  res?: string;
  action?: string;
  anyRoles?: string[];
  anyUserTypes?: string[];
  confidentialLevel?: number;
  ignored?: boolean;
  isAndMode?: boolean;
  onlyRequireAuthenticated?: boolean;
  remark?: string;
  verifyExpression?: string;
}

export type ResAuthorizeResolvedMeta = Required<ResAuthorizeMeta>;

export interface ServiceMeta {
  basePath?: string;
  description?: string;
  title?: string;
  type?: string;
}

const defaultResAuthorizeMeta: ResAuthorizeResolvedMeta = {
  domain: '',
  type: '',
  res: '',
  action: '',
  anyRoles: [],
  anyUserTypes: [],
  confidentialLevel: 0,
  ignored: false,
  isAndMode: false,
  onlyRequireAuthenticated: false,
  remark: '',
  verifyExpression: '',
};

const defaultCrudListTableMeta: CrudListTableResolvedMeta = {
  desc: '',
  name: 'default',
  refEntityClass: 'java.lang.Void',
  style: '',
  title: '',
  visibleOn: '',
};

const defaultCrudOpMeta: CrudOpResolvedMeta = {
  action: 'Auto',
  actionData: '',
  confirmText: '',
  confirmTitle: '',
  desc: '',
  failAction: 'Auto',
  icon: '',
  label: '',
  level: 'Auto',
  name: '',
  opRefTargetListName: 'default',
  opRefTargetType: 'SingleRow',
  resultActionData: '',
  successAction: 'Auto',
  viewContainerType: 'Auto',
  visibleOn: '',
};

function resolveResAuthorizeMeta(
  meta: ResAuthorizeMeta = {},
): ResAuthorizeResolvedMeta {
  return {
    ...defaultResAuthorizeMeta,
    ...meta,
  };
}

function resolveCrudListTableMeta(
  meta: CrudListTableMeta = {},
): CrudListTableResolvedMeta {
  return {
    ...defaultCrudListTableMeta,
    ...meta,
  };
}

function resolveCrudOpMeta(meta: CrudOpMeta = {}): CrudOpResolvedMeta {
  return {
    ...defaultCrudOpMeta,
    ...meta,
  };
}

type DecoratedFunction = Function & Record<symbol, unknown>;

function setMethodMeta(
  descriptorOrMethod: unknown,
  metaKey: symbol,
  meta: unknown,
) {
  const fn =
    typeof descriptorOrMethod === 'function'
      ? descriptorOrMethod
      : (descriptorOrMethod as PropertyDescriptor | undefined)?.value;

  if (typeof fn === 'function') {
    (fn as DecoratedFunction)[metaKey] = meta;
  }
}

function createMethodMetaDecorator(metaKey: symbol, meta: unknown) {
  return ((methodOrTarget: unknown, _contextOrKey?: unknown, descriptor?: any) => {
    if (descriptor) {
      setMethodMeta(descriptor, metaKey, meta);
      return descriptor;
    }

    setMethodMeta(methodOrTarget, metaKey, meta);
    return methodOrTarget;
  }) as MethodDecorator;
}

export function ResAuthorize(meta: ResAuthorizeMeta = {}): MethodDecorator {
  return createMethodMetaDecorator(
    RES_AUTHORIZE_META,
    resolveResAuthorizeMeta(meta),
  );
}

export const CRUD = {
  ListTable(meta: CrudListTableMeta = {}): MethodDecorator {
    return createMethodMetaDecorator(
      CRUD_LIST_TABLE_META,
      resolveCrudListTableMeta(meta),
    );
  },

  Op(meta: CrudOpMeta = {}): MethodDecorator {
    return createMethodMetaDecorator(CRUD_OP_META, resolveCrudOpMeta(meta));
  },
} as const;

export function Service(meta: ServiceMeta): ClassDecorator {
  return (target) => {
    (target as typeof target & { [SERVICE_META]?: ServiceMeta })[SERVICE_META] =
      meta;
  };
}

export function getResAuthorizeMeta(
  apiMethod: null | undefined | { [RES_AUTHORIZE_META]?: ResAuthorizeMeta },
) {
  return resolveResAuthorizeMeta(apiMethod?.[RES_AUTHORIZE_META]);
}

export function getCrudListTableMeta(
  apiMethod: Function | null | object | undefined,
) {
  const meta = (
    apiMethod as
      | null
      | undefined
      | { [CRUD_LIST_TABLE_META]?: CrudListTableMeta }
  )?.[CRUD_LIST_TABLE_META];

  return meta ? resolveCrudListTableMeta(meta) : undefined;
}

export function getCrudOpMeta(apiMethod: Function | null | object | undefined) {
  const meta = (
    apiMethod as null | undefined | { [CRUD_OP_META]?: CrudOpMeta }
  )?.[CRUD_OP_META];

  return meta ? resolveCrudOpMeta(meta) : undefined;
}

export function getServiceMeta(
  service: (new (...args: any[]) => any) | null | object | undefined,
) {
  if (!service) {
    return {};
  }

  const target = (
    typeof service === 'function' ? service : service.constructor
  ) as { [SERVICE_META]?: ServiceMeta };

  return target?.[SERVICE_META] || {};
}
