import type {
  resourceservicev1_Api,
  resourceservicev1_ListApiResponse,
} from '#/api/generated/admin/service/v1';

import { apiClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';
import type { AdminSorting } from './paging';

export type AdminApi = resourceservicev1_Api;
export type AdminApiScope = NonNullable<resourceservicev1_Api['scope']>;
export type AdminApiStatus = NonNullable<resourceservicev1_Api['status']>;

export interface AdminApiListParams {
  method?: string;
  module?: string;
  page?: number;
  pageSize?: number;
  path?: string;
  sorting?: AdminSorting[];
}

export interface AdminApiListResult {
  items: AdminApi[];
  total: number;
}

export interface AdminApiSaveInput {
  description?: string;
  method?: string;
  module?: string;
  moduleDescription?: string;
  operation?: string;
  path?: string;
  scope?: AdminApiScope;
  status?: AdminApiStatus;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toApiData(input: AdminApiSaveInput): AdminApi {
  return {
    description: cleanText(input.description),
    method: cleanText(input.method)?.toUpperCase(),
    module: cleanText(input.module),
    moduleDescription: cleanText(input.moduleDescription),
    operation: cleanText(input.operation),
    path: cleanText(input.path),
    scope: input.scope ?? 'ADMIN',
    status: input.status ?? 'ON',
  };
}

export async function listAdminApisApi(
  params: AdminApiListParams = {},
): Promise<AdminApiListResult> {
  const response = await getAdminList<resourceservicev1_ListApiResponse>(
    '/admin/v1/apis',
    toPagingRequest({
      conditions: [
        {
          field: 'method',
          op: 'EQ',
          value: cleanText(params.method),
        },
        {
          field: 'module',
          op: 'CONTAINS',
          value: cleanText(params.module),
        },
        {
          field: 'path',
          op: 'CONTAINS',
          value: cleanText(params.path),
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

export async function getAdminApiApi(id: number) {
  return await apiClient.Get({ id });
}

export async function createAdminApiApi(input: AdminApiSaveInput) {
  return await apiClient.Create({
    data: toApiData(input),
  });
}

export async function updateAdminApiApi(id: number, input: AdminApiSaveInput) {
  return await apiClient.Update({
    data: toApiData(input),
    id,
    updateMask: [
      'description',
      'method',
      'module',
      'moduleDescription',
      'operation',
      'path',
      'scope',
      'status',
    ].join(','),
  });
}

export async function deleteAdminApiApi(id: number) {
  return await apiClient.Delete({ id });
}

export async function syncAdminApisApi() {
  return await apiClient.SyncApis({});
}

export async function getAdminWalkRouteDataApi() {
  return await apiClient.GetWalkRouteData({});
}
