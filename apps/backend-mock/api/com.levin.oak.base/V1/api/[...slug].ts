import type { EventHandlerRequest, H3Event } from 'h3';

import {
  defineEventHandler,
  getMethod,
  getQuery,
  readBody,
  setResponseStatus,
} from 'h3';

import {
  generateAccessToken,
  type UserPayload,
  verifyAccessToken,
} from '~/utils/jwt-utils';
import { MOCK_USERS } from '~/utils/mock-data';
import {
  forbiddenResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

type GenericRecord = Record<string, any>;

const SAMPLE_DOC_URL = '/mock-files/electronic-contract-sample.docx';
const SAMPLE_IMAGE_URL = '/mock-files/mock-upload.png';
const DEFAULT_TENANT_ID = 'tenant-mock-001';
const DEFAULT_ORG_ID = 'org-mock-001';
const DEFAULT_USER_NAME = '模拟管理员';

let partnerSequence = 2;
let templateSequence = 2;
let contractSequence = 2;

const tenantItems = [
  {
    id: DEFAULT_TENANT_ID,
    name: '模拟租户',
    tenantId: DEFAULT_TENANT_ID,
  },
];

const partnerRecords: GenericRecord[] = [
  {
    id: 'partner-001',
    tenantId: DEFAULT_TENANT_ID,
    orgId: DEFAULT_ORG_ID,
    shortName: '甲方旗舰店',
    subjectName: '深圳市甲方科技有限公司',
    category: 'Channel',
    type: 'OnlineFlagshipStore',
    groupName: '重点渠道',
    subjectType: 'LegalPerson',
    certificationStatus: 'Certified',
    contactName: '张三',
    contactMobile: '13800000001',
    contactEmail: 'zhangsan@example.com',
    unifiedSocialCreditCode: '91440300MOCK00001',
    legalName: '李总',
    legalPhone: '13900000001',
    businessLicenseFileUrl: SAMPLE_IMAGE_URL,
    storefrontImageUrl: SAMPLE_IMAGE_URL,
    enable: true,
    certificationRejectReason: '',
    remark: '默认模拟合作伙伴',
    createTime: '2026-08-26T09:00:00Z',
    certificationLog: [
      createActionLog('创建草稿'),
      createActionLog('认证通过'),
    ],
  },
];

const templateRecords: GenericRecord[] = [
  {
    id: 'template-001',
    tenantId: DEFAULT_TENANT_ID,
    orgId: DEFAULT_ORG_ID,
    templateNo: 'TPL-20260826-001',
    title: '线上经销合作协议模板',
    bizType: 'OrderContract',
    contractCategory: '合作协议',
    contractType: '主合同',
    confidentialLevel: 2,
    fileName: '线上经销合作协议.docx',
    fileUrl: SAMPLE_DOC_URL,
    fileHash: 'mock-template-hash-001',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signerRoleDefinition: [
      { roleCode: 'PartyA', roleName: '甲方' },
      { roleCode: 'PartyB', roleName: '乙方' },
    ],
    defaultSealPositionRules: [
      {
        pageNo: 1,
        signerLabel: '甲方签章',
        source: 'provider-default',
        width: 0.22,
        height: 0.12,
        x: 0.64,
        y: 0.78,
      },
      {
        pageNo: 1,
        signerLabel: '乙方签章',
        source: 'provider-default',
        width: 0.22,
        height: 0.12,
        x: 0.64,
        y: 0.58,
      },
    ],
    templateFieldSchema: {
      requiredFields: ['contractNo', 'title', 'bizType', 'contractPartySnapshot'],
    },
    description: '用于本地模拟签署流程的默认模板',
    status: 'Enabled',
    versionNo: 1,
    createTime: '2026-08-26T09:10:00Z',
  },
];

const contractRecords: GenericRecord[] = [
  {
    id: 'contract-001',
    tenantId: DEFAULT_TENANT_ID,
    orgId: DEFAULT_ORG_ID,
    contractNo: 'EC-20260826-001',
    requestNo: 'REQ-20260826-001',
    title: '线上经销合作协议',
    bizType: 'OrderContract',
    bizOrderNo: 'ORDER-20260826-001',
    bizObjId: 'ORDER-OBJ-001',
    contractCategory: '合作协议',
    contractType: '主合同',
    confidentialLevel: 2,
    signMode: 'Sequential',
    providerCode: 'esign',
    templateId: 'template-001',
    sourceFileName: '线上经销合作协议.docx',
    sourceFileUrl: SAMPLE_DOC_URL,
    sourceFileHash: 'mock-source-hash-001',
    contentHash: 'mock-content-hash-001',
    sourceFileMimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    contractPartySnapshot: {
      parties: [
        {
          roleCode: 'PartyA',
          roleName: '甲方',
          signOrder: 1,
          subject: {
            subjectName: '深圳市甲方科技有限公司',
            subjectType: 'LegalPerson',
          },
          sealPosition: {
            pageNo: 1,
            signerLabel: '甲方签章',
            source: 'provider-default',
            width: 0.22,
            height: 0.12,
            x: 0.64,
            y: 0.78,
          },
        },
        {
          roleCode: 'PartyB',
          roleName: '乙方',
          signOrder: 2,
          subject: {
            subjectName: '王五',
            subjectType: 'NaturalPerson',
          },
          sealPosition: {
            pageNo: 1,
            signerLabel: '乙方签章',
            source: 'provider-default',
            width: 0.22,
            height: 0.12,
            x: 0.64,
            y: 0.58,
          },
        },
      ],
    },
    sealPositionOverrides: [],
    status: 'Draft',
    providerFlowId: '',
    signedFileUrl: '',
    signedFileName: '',
    remark: '默认模拟电子合同',
    createTime: '2026-08-26T09:20:00Z',
    supportEventsByCurrentStatus: ['编辑', '删除'],
    signingLog: [createActionLog('创建草稿')],
    callbackEventIds: [],
  },
];

const enumInfoMap: Record<string, any> = {
  'com.levin.commons.rbac.ConfidentialLevel': {
    fullName: 'com.levin.commons.rbac.ConfidentialLevel',
    name: 'ConfidentialLevel',
    options: [
      { label: '公开', value: 0 },
      { label: '内部', value: 1 },
      { label: '秘密', value: 2 },
      { label: '机密', value: 3 },
    ],
  },
  'com.levin.oak.base.entities.EContract$SignMode': {
    fullName: 'com.levin.oak.base.entities.EContract$SignMode',
    name: 'SignMode',
    options: [
      { label: '顺序签署', value: 'Sequential' },
      { label: '并行签署', value: 'Parallel' },
    ],
  },
  'com.levin.oak.base.entities.LegalSubject$SubjectType': {
    fullName: 'com.levin.oak.base.entities.LegalSubject$SubjectType',
    name: 'SubjectType',
    options: [
      { label: '法人', value: 'LegalPerson' },
      { label: '自然人', value: 'NaturalPerson' },
    ],
  },
  'com.levin.oak.base.entities.LegalSubject$IdentityType': {
    fullName: 'com.levin.oak.base.entities.LegalSubject$IdentityType',
    name: 'IdentityType',
    options: [
      { label: '主体身份标识', value: 'UnifiedSocialCreditCode' },
      { label: '身份证', value: 'IdCard' },
      { label: '护照', value: 'Passport' },
      { label: '其他证件', value: 'Other' },
    ],
  },
  'com.levin.oak.base.entities.Partner$Category': {
    fullName: 'com.levin.oak.base.entities.Partner$Category',
    name: 'Category',
    options: [
      { label: '客户', value: 'Customer' },
      { label: '渠道', value: 'Channel' },
      { label: '供应链', value: 'SupplyChain' },
    ],
  },
  'com.levin.oak.base.entities.Partner$InvestmentRelation': {
    fullName: 'com.levin.oak.base.entities.Partner$InvestmentRelation',
    name: 'InvestmentRelation',
    options: [
      { label: '未知', value: 'Unknown' },
      { label: '无关系', value: 'None' },
      { label: '子公司', value: 'Subsidiary' },
      { label: '关联公司', value: 'Affiliate' },
    ],
  },
  'com.levin.oak.base.entities.Partner$Type': {
    fullName: 'com.levin.oak.base.entities.Partner$Type',
    name: 'Type',
    options: [
      { label: '普通客户', value: 'GeneralCustomer' },
      { label: '经销商', value: 'Dealer' },
      { label: '代理商', value: 'Agent' },
      { label: '分销商', value: 'Distributor' },
      { label: '线上旗舰店', value: 'OnlineFlagshipStore' },
      { label: '线上直营店', value: 'OnlineDirectStore' },
      { label: '线上合作店', value: 'OnlinePartnerStore' },
      { label: '线上专卖店', value: 'OnlineExclusiveStore' },
      { label: '线下旗舰店', value: 'OfflineFlagshipStore' },
      { label: '线下直营店', value: 'OfflineDirectStore' },
      { label: '线下合作店', value: 'OfflinePartnerStore' },
      { label: '线下专卖店', value: 'OfflineExclusiveStore' },
      { label: '商品供应商', value: 'GoodsSupplier' },
      { label: '服务供应商', value: 'ServiceSupplier' },
      { label: '技术供应商', value: 'TechnologySupplier' },
      { label: '物流供应商', value: 'LogisticsSupplier' },
      { label: '运营供应商', value: 'OperationSupplier' },
      { label: '其他供应商', value: 'OtherSupplier' },
    ],
  },
  'com.levin.oak.base.entities.enums.CertificationStatus': {
    fullName: 'com.levin.oak.base.entities.enums.CertificationStatus',
    name: 'CertificationStatus',
    options: [
      { label: '草稿', value: 'Draft' },
      { label: '待认证', value: 'AuditPending' },
      { label: '已认证', value: 'Certified' },
      { label: '认证拒绝', value: 'AuditRejected' },
      { label: '已撤销', value: 'Revoked' },
    ],
  },
};

function createActionLog(action: string, remark = '') {
  const createTime = new Date().toISOString();
  return {
    action,
    createTime,
    operator: DEFAULT_USER_NAME,
    remark,
    time: createTime,
  };
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getSlugPath(event: H3Event<EventHandlerRequest>) {
  const slug = event.context.params?.slug;
  if (Array.isArray(slug)) {
    return `/${slug.join('/')}`;
  }
  return slug ? `/${slug}` : '/';
}

function getRequestUser(event: H3Event<EventHandlerRequest>) {
  return verifyAccessToken(event);
}

function getUserByAccount(account: string) {
  const normalizedAccount = String(account || '').trim();
  return MOCK_USERS.find(
    (item) => item.username === normalizedAccount || item.username === normalizedAccount.toLowerCase(),
  );
}

function buildAccessToken(user: GenericRecord) {
  return `Bearer ${generateAccessToken(user as UserPayload)}`;
}

function buildUserInfo(user: GenericRecord) {
  return {
    homePath: '/clob/V1/Partner',
    id: String(user.id),
    loginName: user.username,
    name: user.realName,
    roleList: user.roles || [],
    superAdmin: (user.roles || []).includes('super'),
    telephone: '13800000000',
    tenantId: DEFAULT_TENANT_ID,
  };
}

function applyListQuery(records: GenericRecord[], query: GenericRecord, fields: string[]) {
  const keyword = String(
    query.containsName ||
      query.containsCode ||
      query.keyword ||
      query.title ||
      query.subjectName ||
      '',
  )
    .trim()
    .toLowerCase();
  const pageIndex = Math.max(Number(query.pageIndex || query.pageNo || 1), 1);
  const pageSize = Math.max(Number(query.pageSize || 10), 1);

  const filtered = keyword
    ? records.filter((record) =>
        fields.some((field) =>
          String(record[field] ?? '')
            .toLowerCase()
            .includes(keyword),
        ),
      )
    : records;

  const start = (pageIndex - 1) * pageSize;
  return {
    items: cloneRecord(filtered.slice(start, start + pageSize)),
    pageIndex,
    pageSize,
    totals: filtered.length,
  };
}

function findRecord(records: GenericRecord[], id: string) {
  return records.find((item) => String(item.id) === String(id));
}

function requireRecord(records: GenericRecord[], id: string, title: string) {
  const record = findRecord(records, id);
  if (!record) {
    throw new Error(`${title}不存在：${id}`);
  }
  return record;
}

function nextPartnerId() {
  partnerSequence += 1;
  return `partner-${String(partnerSequence).padStart(3, '0')}`;
}

function nextTemplateId() {
  templateSequence += 1;
  return `template-${String(templateSequence).padStart(3, '0')}`;
}

function nextContractId() {
  contractSequence += 1;
  return `contract-${String(contractSequence).padStart(3, '0')}`;
}

function defaultPartySnapshot() {
  return {
    parties: [
      {
        roleCode: 'PartyA',
        roleName: '甲方',
        signOrder: 1,
        subject: {
          subjectName: '深圳市甲方科技有限公司',
          subjectType: 'LegalPerson',
        },
        sealPosition: {
          pageNo: 1,
          signerLabel: '甲方签章',
          source: 'provider-default',
          width: 0.22,
          height: 0.12,
          x: 0.64,
          y: 0.78,
        },
      },
      {
        roleCode: 'PartyB',
        roleName: '乙方',
        signOrder: 2,
        subject: {
          subjectName: '模拟签署人',
          subjectType: 'NaturalPerson',
        },
        sealPosition: {
          pageNo: 1,
          signerLabel: '乙方签章',
          source: 'provider-default',
          width: 0.22,
          height: 0.12,
          x: 0.64,
          y: 0.58,
        },
      },
    ],
  };
}

function handlePartnerAction(path: string, method: string, query: GenericRecord, body: GenericRecord) {
  if (path === '/Partner/list' && method === 'GET') {
    return useResponseSuccess(
      applyListQuery(partnerRecords, query, ['subjectName', 'shortName', 'contactName']),
    );
  }

  if (path === '/Partner/retrieve' && method === 'GET') {
    return useResponseSuccess(
      cloneRecord(requireRecord(partnerRecords, String(query.id || ''), '合作伙伴')),
    );
  }

  if (path === '/Partner/savePartner' && method === 'POST') {
    const nextRecord = {
      id: nextPartnerId(),
      tenantId: body.tenantId || DEFAULT_TENANT_ID,
      orgId: body.orgId || DEFAULT_ORG_ID,
      shortName: body.shortName || body.subjectName || `合作伙伴${partnerSequence}`,
      subjectName: body.subjectName || `合作伙伴${partnerSequence}`,
      category: body.category || 'Customer',
      type: body.type || 'GeneralCustomer',
      groupName: body.groupName || '',
      subjectType: body.subjectType || 'LegalPerson',
      certificationStatus: 'Draft',
      contactName: body.contactName || '未命名联系人',
      contactMobile: body.contactMobile || '',
      contactEmail: body.contactEmail || '',
      unifiedSocialCreditCode: body.unifiedSocialCreditCode || '',
      legalName: body.legalName || '',
      legalPhone: body.legalPhone || '',
      businessLicenseFileUrl: body.businessLicenseFileUrl || SAMPLE_IMAGE_URL,
      storefrontImageUrl: body.storefrontImageUrl || SAMPLE_IMAGE_URL,
      enable: body.enable !== false,
      certificationRejectReason: '',
      remark: body.remark || '',
      createTime: new Date().toISOString(),
      certificationLog: [createActionLog('创建草稿')],
    };
    partnerRecords.unshift(nextRecord);
    return useResponseSuccess(cloneRecord(nextRecord));
  }

  if (path === '/Partner/updatePartner' && method === 'PUT') {
    const record = requireRecord(partnerRecords, String(body.id || ''), '合作伙伴');
    Object.assign(record, body, {
      certificationLog: record.certificationLog || [createActionLog('创建草稿')],
    });
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/Partner/submitCertification' && method === 'POST') {
    const record = requireRecord(partnerRecords, String(body.id || ''), '合作伙伴');
    record.certificationStatus = 'AuditPending';
    record.certificationRejectReason = '';
    record.certificationLog = [...(record.certificationLog || []), createActionLog('提交认证')];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/Partner/approveCertification' && method === 'POST') {
    const record = requireRecord(partnerRecords, String(body.id || ''), '合作伙伴');
    record.certificationStatus = 'Certified';
    record.certificationRejectReason = '';
    record.certificationLog = [...(record.certificationLog || []), createActionLog('认证通过')];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/Partner/rejectCertification' && method === 'POST') {
    const record = requireRecord(partnerRecords, String(body.id || ''), '合作伙伴');
    record.certificationStatus = 'AuditRejected';
    record.certificationRejectReason = String(body._operatorAction || body.certificationRejectReason || '模拟审核拒绝');
    record.certificationLog = [
      ...(record.certificationLog || []),
      createActionLog('认证拒绝', record.certificationRejectReason),
    ];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/Partner/revokeCertification' && method === 'POST') {
    const record = requireRecord(partnerRecords, String(body.id || ''), '合作伙伴');
    record.certificationStatus = 'Revoked';
    record.certificationLog = [...(record.certificationLog || []), createActionLog('撤销认证')];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/Partner/delete' && method === 'DELETE') {
    const index = partnerRecords.findIndex((item) => String(item.id) === String(query.id || ''));
    if (index >= 0) {
      partnerRecords.splice(index, 1);
    }
    return useResponseSuccess(true);
  }
}

function handleTemplateAction(path: string, method: string, query: GenericRecord, body: GenericRecord) {
  if (path === '/EContractTemplate/list' && method === 'GET') {
    return useResponseSuccess(
      applyListQuery(templateRecords, query, ['title', 'templateNo', 'bizType']),
    );
  }

  if (path === '/EContractTemplate/retrieve' && method === 'GET') {
    return useResponseSuccess(
      cloneRecord(requireRecord(templateRecords, String(query.id || ''), '合同模板')),
    );
  }

  if (path === '/EContractTemplate/create' && method === 'POST') {
    const nextRecord = {
      id: nextTemplateId(),
      tenantId: body.tenantId || DEFAULT_TENANT_ID,
      orgId: body.orgId || DEFAULT_ORG_ID,
      templateNo: body.templateNo || `TPL-${Date.now()}`,
      title: body.title || `模拟模板${templateSequence}`,
      bizType: body.bizType || 'OrderContract',
      contractCategory: body.contractCategory || '合作协议',
      contractType: body.contractType || '主合同',
      confidentialLevel: body.confidentialLevel ?? 2,
      fileName: body.fileName || '模拟合同模板.docx',
      fileUrl: body.fileUrl || SAMPLE_DOC_URL,
      fileHash: body.fileHash || `mock-template-hash-${templateSequence}`,
      mimeType:
        body.mimeType ||
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      signerRoleDefinition: body.signerRoleDefinition || defaultPartySnapshot().parties.map((party: any) => ({
        roleCode: party.roleCode,
        roleName: party.roleName,
      })),
      defaultSealPositionRules:
        body.defaultSealPositionRules ||
        defaultPartySnapshot().parties.map((party: any) => party.sealPosition),
      templateFieldSchema: body.templateFieldSchema || {},
      description: body.description || '',
      status: body.status || 'Enabled',
      versionNo: Number(body.versionNo || 1),
      createTime: new Date().toISOString(),
    };
    templateRecords.unshift(nextRecord);
    return useResponseSuccess(cloneRecord(nextRecord));
  }

  if (path === '/EContractTemplate/update' && method === 'PUT') {
    const record = requireRecord(templateRecords, String(body.id || ''), '合同模板');
    Object.assign(record, body);
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/EContractTemplate/delete' && method === 'DELETE') {
    const index = templateRecords.findIndex((item) => String(item.id) === String(query.id || ''));
    if (index >= 0) {
      templateRecords.splice(index, 1);
    }
    return useResponseSuccess(true);
  }
}

function buildSupportEvents(status: string) {
  if (status === 'Draft') {
    return ['编辑', '提交签署', '删除'];
  }
  if (status === 'Signing') {
    return ['模拟供应商回调', '撤销签署', '模拟签署过期'];
  }
  if (status === 'Signed') {
    return ['查看签署日志', '下载已签文件', '复制重签', '归档合同'];
  }
  if (['Rejected', 'Canceled', 'Expired'].includes(status)) {
    return ['查看签署日志', '复制重签', '归档合同'];
  }
  if (status === 'Archived') {
    return ['查看签署日志', '复制重签'];
  }
  return [];
}

function assertFixedTwoPartySnapshot(snapshot: GenericRecord) {
  const parties = Array.isArray(snapshot?.parties) ? snapshot.parties : [];
  const isValid =
    parties.length === 2 &&
    parties[0]?.roleCode === 'PartyA' &&
    Number(parties[0]?.signOrder) === 1 &&
    parties[1]?.roleCode === 'PartyB' &&
    Number(parties[1]?.signOrder) === 2;
  if (!isValid) {
    throw new Error('电子合同仅支持 PartyA（甲方，顺序 1）和 PartyB（乙方，顺序 2）两方签约');
  }
}

function handleContractAction(path: string, method: string, query: GenericRecord, body: GenericRecord) {
  if (path === '/EContract/list' && method === 'GET') {
    return useResponseSuccess(
      applyListQuery(contractRecords, query, ['title', 'contractNo', 'requestNo', 'bizOrderNo']),
    );
  }

  if (path === '/EContract/retrieve' && method === 'GET') {
    return useResponseSuccess(
      cloneRecord(requireRecord(contractRecords, String(query.id || ''), '电子合同')),
    );
  }

  if (path === '/EContract/saveDraft' && method === 'POST') {
    const partySnapshot = body.contractPartySnapshot || defaultPartySnapshot();
    assertFixedTwoPartySnapshot(partySnapshot);
    const nextRecord = {
      id: nextContractId(),
      tenantId: body.tenantId || DEFAULT_TENANT_ID,
      orgId: body.orgId || DEFAULT_ORG_ID,
      contractNo: body.contractNo || `EC-${Date.now()}`,
      requestNo: body.requestNo || `REQ-${Date.now()}`,
      title: body.title || `模拟电子合同${contractSequence}`,
      bizType: body.bizType || 'OrderContract',
      bizOrderNo: body.bizOrderNo || `ORDER-${contractSequence}`,
      bizObjId: body.bizObjId || `ORDER-OBJ-${contractSequence}`,
      contractCategory: body.contractCategory || '合作协议',
      contractType: body.contractType || '主合同',
      confidentialLevel: body.confidentialLevel ?? 2,
      signMode: body.signMode || 'Sequential',
      providerCode: body.providerCode || 'esign',
      templateId: body.templateId || templateRecords[0]?.id || '',
      sourceFileName: body.sourceFileName || '模拟合同正文.docx',
      sourceFileUrl: body.sourceFileUrl || SAMPLE_DOC_URL,
      sourceFileHash: body.sourceFileHash || `mock-source-hash-${contractSequence}`,
      contentHash: body.contentHash || `mock-content-hash-${contractSequence}`,
      sourceFileMimeType:
        body.sourceFileMimeType ||
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      contractPartySnapshot: partySnapshot,
      sealPositionOverrides: body.sealPositionOverrides || [],
      status: 'Draft',
      providerFlowId: '',
      signedFileUrl: '',
      signedFileName: '',
      remark: body.remark || '',
      createTime: new Date().toISOString(),
      supportEventsByCurrentStatus: buildSupportEvents('Draft'),
      signingLog: [createActionLog('创建草稿')],
    };
    contractRecords.unshift(nextRecord);
    return useResponseSuccess(cloneRecord(nextRecord));
  }

  if (path === '/EContract/updateDraft' && method === 'PUT') {
    const record = requireRecord(contractRecords, String(body.id || ''), '电子合同');
    if (body.contractPartySnapshot) {
      assertFixedTwoPartySnapshot(body.contractPartySnapshot);
    }
    Object.assign(record, body);
    record.signingLog = record.signingLog || [createActionLog('创建草稿')];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/EContract/submitSigning' && method === 'POST') {
    const record = requireRecord(contractRecords, String(body.id || ''), '电子合同');
    assertFixedTwoPartySnapshot(record.contractPartySnapshot);
    if (record.status !== 'Draft') {
      throw new Error('只有草稿合同可以提交签署');
    }
    record.status = 'Signing';
    record.providerFlowId = `mock-flow-${record.id}`;
    record.supportEventsByCurrentStatus = buildSupportEvents('Signing');
    record.signingLog = [
      ...(record.signingLog || []),
      createActionLog('提交签署'),
    ];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/EContract/providerCallback' && method === 'POST') {
    const record = requireRecord(contractRecords, String(body.id || ''), '电子合同');
    const callbackEventId = String(body.eventId || `mock-callback-${record.id}-${body.status || 'Signed'}`);
    if ((record.callbackEventIds || []).includes(callbackEventId)) {
      return useResponseSuccess(cloneRecord(record));
    }
    if (record.status !== 'Signing') {
      throw new Error('只有签署中的合同可以接收模拟供应商回调');
    }
    const callbackStatus = String(body.status || 'Signed');
    if (callbackStatus === 'Failed') {
      throw new Error('模拟供应商技术异常：合同保持 Signing，可稍后重试或撤销');
    }
    const rejected = callbackStatus === 'Rejected';
    const expired = callbackStatus === 'Expired';
    record.status = rejected ? 'Rejected' : expired ? 'Expired' : 'Signed';
    record.callbackEventIds = [...(record.callbackEventIds || []), callbackEventId];
    record.signedFileUrl = rejected || expired ? '' : SAMPLE_DOC_URL;
    record.signedFileName = rejected || expired ? '' : `${record.title || '电子合同'}-已签署.docx`;
    record.supportEventsByCurrentStatus = buildSupportEvents(record.status);
    record.signingLog = [
      ...(record.signingLog || []),
      createActionLog(rejected ? '模拟签署拒绝' : expired ? '模拟签署过期' : '模拟签署完成'),
    ];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/EContract/cancelSigning' && method === 'POST') {
    const record = requireRecord(contractRecords, String(body.id || ''), '电子合同');
    if (record.status !== 'Signing') {
      throw new Error('只有签署中的合同可以撤销签署');
    }
    record.status = 'Canceled';
    record.supportEventsByCurrentStatus = buildSupportEvents('Canceled');
    record.signingLog = [...(record.signingLog || []), createActionLog('撤销签署')];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/EContract/archive' && method === 'POST') {
    const record = requireRecord(contractRecords, String(body.id || ''), '电子合同');
    if (!['Signed', 'Rejected', 'Canceled', 'Expired'].includes(record.status)) {
      throw new Error('只有已签署、已拒签、已撤销或已过期合同可以归档');
    }
    record.status = 'Archived';
    record.supportEventsByCurrentStatus = buildSupportEvents('Archived');
    record.signingLog = [...(record.signingLog || []), createActionLog('归档合同')];
    return useResponseSuccess(cloneRecord(record));
  }

  if (path === '/EContract/copyForResign' && method === 'POST') {
    const sourceRecord = requireRecord(contractRecords, String(body.id || ''), '电子合同');
    if (!['Canceled', 'Rejected', 'Signed', 'Expired', 'Archived'].includes(sourceRecord.status)) {
      throw new Error('只有已签署、已拒签、已撤销、已过期或已归档合同可以复制重签');
    }
    const nextRecord = {
      ...cloneRecord(sourceRecord),
      id: nextContractId(),
      status: 'Draft',
      providerFlowId: '',
      signedFileUrl: '',
      signedFileName: '',
      requestNo: `${sourceRecord.requestNo}-copy-${contractSequence}`,
      contractNo: `${sourceRecord.contractNo}-copy-${contractSequence}`,
      createTime: new Date().toISOString(),
      supportEventsByCurrentStatus: buildSupportEvents('Draft'),
      signingLog: [createActionLog('复制重签草稿')],
      callbackEventIds: [],
    };
    contractRecords.unshift(nextRecord);
    return useResponseSuccess(cloneRecord(nextRecord));
  }

  if (path === '/EContract/signingLog' && method === 'GET') {
    const record = requireRecord(contractRecords, String(query.id || ''), '电子合同');
    return useResponseSuccess(cloneRecord(record.signingLog || []));
  }

  if (path === '/EContract/downloadSignedFile' && method === 'GET') {
    const record = requireRecord(contractRecords, String(query.id || ''), '电子合同');
    if (record.status !== 'Signed' || !record.signedFileUrl) {
      throw new Error('当前合同尚未完成签署，不能下载已签文件');
    }
    return useResponseSuccess({ url: record.signedFileUrl });
  }

  if (path === '/EContract/delete' && method === 'DELETE') {
    const index = contractRecords.findIndex((item) => String(item.id) === String(query.id || ''));
    if (index >= 0) {
      contractRecords.splice(index, 1);
    }
    return useResponseSuccess(true);
  }
}

export default defineEventHandler(async (event) => {
  const path = getSlugPath(event);
  const method = getMethod(event).toUpperCase();
  const query = getQuery(event);
  const body =
    method === 'GET' || method === 'DELETE' ? {} : ((await readBody(event)) as GenericRecord) || {};

  try {
    if (path === '/rbac/getVerifyCode' && method === 'GET') {
      return useResponseSuccess({
        account: String(query.account || 'sa'),
        code: '123456',
        isMock: true,
        isSuccessful: true,
        mock: true,
        successful: true,
        type: 'Captcha',
      });
    }

    if (path === '/rbac/loginVerifyChallenge' && method === 'POST') {
      const user = getUserByAccount(String(body.account || ''));
      if (!user || user.password !== String(body.password || '')) {
        return forbiddenResponse(event, '账号或密码错误');
      }
      return useResponseSuccess({
        challengeId: `mock-login-challenge-${user.username}`,
        verifyCodeType: 'Captcha',
      });
    }

    if (
      (path === '/rbac/loginVerifyChallenge/complete' && method === 'POST') ||
      (path === '/rbac/login' && method === 'POST')
    ) {
      const account = String(
        body.account ||
          String(body.loginVerifyChallengeId || '').replace('mock-login-challenge-', ''),
      );
      const user = getUserByAccount(account);
      const isChallengeCompletion = path === '/rbac/loginVerifyChallenge/complete';
      if (!user || (!isChallengeCompletion && user.password !== String(body.password || ''))) {
        return forbiddenResponse(event, '账号或密码错误');
      }
      if (String(body.verifyCode || '123456') !== '123456') {
        return forbiddenResponse(event, '验证码错误');
      }
      return useResponseSuccess({
        accessToken: buildAccessToken(user),
      });
    }

    if (path === '/rbac/logout' && method === 'GET') {
      return useResponseSuccess(true);
    }

    if (path === '/rbac/tenantSiteInfo' && method === 'GET') {
      return useResponseSuccess({
        id: 'tenant-site-mock-001',
        name: '模拟租户站点',
        sysName: 'Levin Main App',
        tenantId: DEFAULT_TENANT_ID,
        uiExInfo: {
          'admin-ui-base-setting': {
            preferServerSetting: false,
            setting: {},
          },
        },
      });
    }

    const requestUser = getRequestUser(event);
    if (!requestUser) {
      return unAuthorizedResponse(event);
    }

    if (path === '/rbac/userInfo' && method === 'GET') {
      return useResponseSuccess(buildUserInfo(requestUser));
    }

    if (path === '/rbac/authorizedPermissionList' && method === 'GET') {
      return useResponseSuccess([
        'com.levin.oak.base:系统数据-合作伙伴::查询列表',
        'com.levin.oak.base:系统数据-合作伙伴::保存合作伙伴',
        'com.levin.oak.base:系统数据-电子合同模板::查询列表',
        'com.levin.oak.base:系统数据-电子合同模板::新增',
        'com.levin.oak.base:系统数据-电子合同::查询列表',
        'com.levin.oak.base:系统数据-电子合同::创建电子合同草稿',
        'com.levin.oak.base:系统数据-电子合同::提交签署',
      ]);
    }

    if (path === '/rbac/authorizedMenuList' && method === 'GET') {
      return useResponseSuccess([
        {
          actionType: 'Default',
          children: [
            {
              actionType: 'Default',
              enable: true,
              id: 'menu-partner',
              name: '合作伙伴',
              orderCode: 10,
              pageType: 'LocalPage',
              path: '/clob/V1/Partner',
            },
            {
              actionType: 'Default',
              enable: true,
              id: 'menu-template',
              name: '电子合同模板',
              orderCode: 20,
              pageType: 'LocalPage',
              path: '/clob/V1/EContractTemplate',
            },
            {
              actionType: 'Default',
              enable: true,
              id: 'menu-contract',
              name: '电子合同',
              orderCode: 30,
              pageType: 'LocalPage',
              path: '/clob/V1/EContract',
            },
          ],
          enable: true,
          id: 'menu-root',
          name: 'framework-base',
          orderCode: 1,
          pageType: 'Catalog',
          path: '/clob/V1',
        },
      ]);
    }

    if (path === '/rbac/authorizedOrgList' && method === 'GET') {
      return useResponseSuccess([
        {
          id: DEFAULT_ORG_ID,
          name: '模拟运营中心',
          children: [
            {
              id: 'org-mock-002',
              name: '华南事业部',
            },
          ],
        },
      ]);
    }

    if (path === '/rbac/authorizedControllerPathList' && method === 'GET') {
      return useResponseSuccess([
        {
          description: '合作伙伴管理接口',
          name: 'BizPartnerController',
          url: '/Partner/list',
        },
        {
          description: '电子合同模板管理接口',
          name: 'BizEContractTemplateController',
          url: '/EContractTemplate/list',
        },
        {
          description: '电子合同管理接口',
          name: 'BizEContractController',
          url: '/EContract/list',
        },
      ]);
    }

    if (path === '/Tenant/list' && method === 'GET') {
      return useResponseSuccess(
        applyListQuery(tenantItems, query, ['name', 'tenantId']),
      );
    }

    if (path === '/I18nRes/runtimeLabels' && method === 'GET') {
      return useResponseSuccess({});
    }

    if (path === '/enums' && method === 'GET') {
      const enumName = String(query.enumName || '').trim();
      if (!enumName) {
        return useResponseSuccess(enumInfoMap);
      }
      const enumInfo = enumInfoMap[enumName];
      if (!enumInfo) {
        setResponseStatus(event, 404);
        return useResponseError(`未找到枚举：${enumName}`);
      }
      return useResponseSuccess(enumInfo);
    }

    if (path.startsWith('/enums/') && method === 'GET') {
      const enumName = decodeURIComponent(path.replace('/enums/', ''));
      const enumInfo = enumInfoMap[enumName];
      if (!enumInfo) {
        setResponseStatus(event, 404);
        return useResponseError(`未找到枚举：${enumName}`);
      }
      return useResponseSuccess(enumInfo);
    }

    if (
      (path === '/fss/uploadSingleFile' || path === '/fss/uploadFiles') &&
      (method === 'POST' || method === 'PUT')
    ) {
      return useResponseSuccess(SAMPLE_IMAGE_URL);
    }

    return (
      handlePartnerAction(path, method, query, body) ||
      handleTemplateAction(path, method, query, body) ||
      handleContractAction(path, method, query, body) ||
      useResponseError(`未实现的模拟接口：${method} ${path}`)
    );
  } catch (error) {
    setResponseStatus(event, 400);
    return useResponseError(
      error instanceof Error ? error.message : '模拟接口处理失败',
    );
  }
});
