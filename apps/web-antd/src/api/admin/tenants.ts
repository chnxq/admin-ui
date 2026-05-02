import type {
  identityservicev1_ListTenantResponse,
  identityservicev1_Tenant,
} from '#/api/generated/admin/service/v1';

import { tenantClient } from './clients';
import {
  getAdminList,
  toAdminTotal,
  toPagingRequest,
  type AdminSorting,
} from './paging';

export type AdminTenant = identityservicev1_Tenant;
export type AdminTenantAuditStatus = NonNullable<AdminTenant['auditStatus']>;
export type AdminTenantStatus = NonNullable<AdminTenant['status']>;
export type AdminTenantType = NonNullable<AdminTenant['type']>;

export interface AdminTenantListParams {
  code?: string;
  name?: string;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
}

export interface AdminTenantListResult {
  items: AdminTenant[];
  total: number;
}

export interface AdminTenantSaveInput {
  auditStatus?: AdminTenantAuditStatus;
  code?: string;
  domain?: string;
  industry?: string;
  logoUrl?: string;
  name?: string;
  remark?: string;
  status?: AdminTenantStatus;
  subscriptionPlan?: string;
  type?: AdminTenantType;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toTenantData(input: AdminTenantSaveInput): AdminTenant {
  return {
    auditStatus: input.auditStatus ?? 'APPROVED',
    code: cleanText(input.code),
    domain: cleanText(input.domain),
    industry: cleanText(input.industry),
    logoUrl: cleanText(input.logoUrl),
    name: cleanText(input.name),
    remark: cleanText(input.remark),
    status: input.status ?? 'ON',
    subscriptionPlan: cleanText(input.subscriptionPlan),
    type: input.type ?? 'TRIAL',
  };
}

export async function listAdminTenantsApi(
  params: AdminTenantListParams = {},
): Promise<AdminTenantListResult> {
  const response = await getAdminList<identityservicev1_ListTenantResponse>(
    '/admin/v1/tenants',
    toPagingRequest({
      conditions: [
        { field: 'name', op: 'CONTAINS', value: cleanText(params.name) },
        { field: 'code', op: 'CONTAINS', value: cleanText(params.code) },
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

export async function getAdminTenantApi(id: number) {
  return await tenantClient.Get({ id });
}

export async function createAdminTenantApi(input: AdminTenantSaveInput) {
  return await tenantClient.Create({
    data: toTenantData(input),
  });
}

export async function updateAdminTenantApi(
  id: number,
  input: AdminTenantSaveInput,
) {
  return await tenantClient.Update({
    data: toTenantData(input),
    id,
    updateMask: [
      'name',
      'code',
      'domain',
      'logoUrl',
      'industry',
      'type',
      'status',
      'auditStatus',
      'subscriptionPlan',
      'remark',
    ].join(','),
  });
}

export async function deleteAdminTenantApi(id: number) {
  return await tenantClient.Delete({ id });
}
