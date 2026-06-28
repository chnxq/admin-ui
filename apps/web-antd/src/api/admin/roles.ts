import type { AdminSorting } from './paging';

import type {
  permissionservicev1_ListRoleResponse,
  permissionservicev1_Role,
} from '#/api/generated/admin/service/v1';

import { roleClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminRole = permissionservicev1_Role;
export type AdminRoleStatus = NonNullable<permissionservicev1_Role['status']>;
export type AdminRoleType = NonNullable<permissionservicev1_Role['type']>;

export interface AdminRoleListParams {
  code?: string;
  name?: string;
  tenantId?: number;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
}

export interface AdminRoleListResult {
  items: AdminRole[];
  total: number;
}

export interface AdminRoleSaveInput {
  code?: string;
  description?: string;
  name?: string;
  permissions?: number[];
  sortOrder?: number;
  status?: AdminRoleStatus;
  type?: AdminRoleType;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toRoleData(input: AdminRoleSaveInput): AdminRole {
  return {
    code: cleanText(input.code),
    description: cleanText(input.description),
    name: cleanText(input.name),
    permissions: input.permissions ?? [],
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 'ON',
    type: input.type ?? 'SYSTEM',
  };
}

export async function listAdminRolesApi(
  params: AdminRoleListParams = {},
): Promise<AdminRoleListResult> {
  const response = await getAdminList<permissionservicev1_ListRoleResponse>(
    '/admin/v1/roles',
    toPagingRequest({
      conditions: [
        {
          field: 'name',
          op: 'CONTAINS',
          value: cleanText(params.name),
        },
        {
          field: 'code',
          op: 'CONTAINS',
          value: cleanText(params.code),
        },
        {
          field: 'tenant_id',
          op: 'EQ',
          value: params.tenantId,
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

export async function getAdminRoleApi(id: number) {
  return await roleClient.Get({ id });
}

export async function createAdminRoleApi(input: AdminRoleSaveInput) {
  return await roleClient.Create({
    data: toRoleData(input),
  });
}

export async function updateAdminRoleApi(
  id: number,
  input: AdminRoleSaveInput,
) {
  return await roleClient.Update({
    data: toRoleData(input),
    id,
    updateMask: [
      'name',
      'code',
      'sortOrder',
      'status',
      'description',
      'type',
      'permissions',
    ].join(','),
  });
}

export async function deleteAdminRoleApi(id: number) {
  return await roleClient.Delete({ id });
}
