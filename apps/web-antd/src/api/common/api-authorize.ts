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

export function ResAuthorize(meta: ResAuthorizeMeta = {}): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    const fn = descriptor.value as
      | undefined
      | {
          [RES_AUTHORIZE_META]?: ResAuthorizeResolvedMeta;
        };
    if (!fn) {
      return descriptor;
    }

    fn[RES_AUTHORIZE_META] = resolveResAuthorizeMeta(meta);

    return descriptor;
  };
}

export const CRUD = {
  ListTable(meta: CrudListTableMeta = {}): MethodDecorator {
    return (_target, _propertyKey, descriptor) => {
      const fn = descriptor.value as
        | undefined
        | {
            [CRUD_LIST_TABLE_META]?: CrudListTableResolvedMeta;
          };
      if (!fn) {
        return descriptor;
      }

      fn[CRUD_LIST_TABLE_META] = resolveCrudListTableMeta(meta);

      return descriptor;
    };
  },

  Op(meta: CrudOpMeta = {}): MethodDecorator {
    return (_target, _propertyKey, descriptor) => {
      const fn = descriptor.value as
        | undefined
        | {
            [CRUD_OP_META]?: CrudOpResolvedMeta;
          };
      if (!fn) {
        return descriptor;
      }

      fn[CRUD_OP_META] = resolveCrudOpMeta(meta);

      return descriptor;
    };
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
