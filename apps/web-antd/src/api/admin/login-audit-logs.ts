import type { AdminSorting } from './paging';

import type {
  auditservicev1_ListLoginAuditLogResponse,
  auditservicev1_LoginAuditLog,
  auditservicev1_LoginAuditLog_ActionType,
  auditservicev1_LoginAuditLog_LoginMethod,
  auditservicev1_LoginAuditLog_RiskLevel,
  auditservicev1_LoginAuditLog_Status,
} from '#/api/generated/admin/service/v1';

import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminLoginAuditLog = auditservicev1_LoginAuditLog;
export type AdminLoginAuditLogActionType =
  auditservicev1_LoginAuditLog_ActionType;
export type AdminLoginAuditLogLoginMethod =
  auditservicev1_LoginAuditLog_LoginMethod;
export type AdminLoginAuditLogRiskLevel =
  auditservicev1_LoginAuditLog_RiskLevel;
export type AdminLoginAuditLogStatus = auditservicev1_LoginAuditLog_Status;

export interface AdminLoginAuditLogListParams {
  actionType?: AdminLoginAuditLogActionType;
  page?: number;
  pageSize?: number;
  riskLevel?: AdminLoginAuditLogRiskLevel;
  sorting?: AdminSorting[];
  status?: AdminLoginAuditLogStatus;
  username?: string;
  ipAddress?: string;
}

export interface AdminLoginAuditLogListResult {
  items: AdminLoginAuditLog[];
  total: number;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

export async function listAdminLoginAuditLogsApi(
  params: AdminLoginAuditLogListParams = {},
): Promise<AdminLoginAuditLogListResult> {
  const response = await getAdminList<auditservicev1_ListLoginAuditLogResponse>(
    '/admin/v1/login-audit-logs',
    toPagingRequest({
      conditions: [
        {
          field: 'username',
          op: 'CONTAINS',
          value: cleanText(params.username),
        },
        {
          field: 'ip_address',
          op: 'CONTAINS',
          value: cleanText(params.ipAddress),
        },
        {
          field: 'action_type',
          op: 'EQ',
          value: params.actionType,
        },
        {
          field: 'risk_level',
          op: 'EQ',
          value: params.riskLevel,
        },
        {
          field: 'status',
          op: 'EQ',
          value: params.status,
        },
      ],
      page: params.page,
      pageSize: params.pageSize,
      sorting: params.sorting,
    }),
  );

  return {
    items: response.items ?? [],
    total: toAdminTotal(response.total),
  };
}
