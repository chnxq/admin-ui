import type { AdminSorting } from './paging';

import type {
  auditservicev1_ListPermissionAuditLogResponse,
  auditservicev1_PermissionAuditLog,
  auditservicev1_PermissionAuditLog_ActionType,
} from '#/api/generated/admin/service/v1';

import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminPermissionAuditLog = auditservicev1_PermissionAuditLog;
export type AdminPermissionAuditLogActionType =
  auditservicev1_PermissionAuditLog_ActionType;

export interface AdminPermissionAuditLogListParams {
  action?: AdminPermissionAuditLogActionType;
  ipAddress?: string;
  operatorName?: string;
  page?: number;
  pageSize?: number;
  reason?: string;
  sorting?: AdminSorting[];
  targetType?: string;
}

export interface AdminPermissionAuditLogListResult {
  items: AdminPermissionAuditLog[];
  total: number;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

export async function listAdminPermissionAuditLogsApi(
  params: AdminPermissionAuditLogListParams = {},
): Promise<AdminPermissionAuditLogListResult> {
  const response =
    await getAdminList<auditservicev1_ListPermissionAuditLogResponse>(
      '/admin/v1/permission-audit-logs',
      toPagingRequest({
        conditions: [
          {
            field: 'target_type',
            op: 'CONTAINS',
            value: cleanText(params.targetType),
          },
          {
            field: 'action',
            op: 'EQ',
            value: params.action,
          },
          {
            field: 'ip_address',
            op: 'CONTAINS',
            value: cleanText(params.ipAddress),
          },
          {
            field: 'reason',
            op: 'CONTAINS',
            value: cleanText(params.reason),
          },
          {
            field: 'operator_name',
            op: 'CONTAINS',
            value: cleanText(params.operatorName),
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
