import type { AdminSorting } from './paging';

import type {
  auditservicev1_ApiAuditLog,
  auditservicev1_ListApiAuditLogResponse,
} from '#/api/generated/admin/service/v1';

import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminApiAuditLog = auditservicev1_ApiAuditLog;

export interface AdminApiAuditLogListParams {
  apiModule?: string;
  httpMethod?: string;
  page?: number;
  pageSize?: number;
  path?: string;
  reason?: string;
  sorting?: AdminSorting[];
  statusCode?: number;
  username?: string;
}

export interface AdminApiAuditLogListResult {
  items: AdminApiAuditLog[];
  total: number;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

export async function listAdminApiAuditLogsApi(
  params: AdminApiAuditLogListParams = {},
): Promise<AdminApiAuditLogListResult> {
  const response = await getAdminList<auditservicev1_ListApiAuditLogResponse>(
    '/admin/v1/api-audit-logs',
    toPagingRequest({
      conditions: [
        {
          field: 'username',
          op: 'CONTAINS',
          value: cleanText(params.username),
        },
        {
          field: 'http_method',
          op: 'EQ',
          value: cleanText(params.httpMethod)?.toUpperCase(),
        },
        {
          field: 'path',
          op: 'CONTAINS',
          value: cleanText(params.path),
        },
        {
          field: 'api_module',
          op: 'CONTAINS',
          value: cleanText(params.apiModule),
        },
        {
          field: 'status_code',
          op: 'EQ',
          value: params.statusCode,
        },
        {
          field: 'reason',
          op: 'CONTAINS',
          value: cleanText(params.reason),
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
