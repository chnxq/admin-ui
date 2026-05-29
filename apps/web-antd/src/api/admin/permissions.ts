import type {
  permissionservicev1_ListPermissionGroupResponse,
  permissionservicev1_ListPermissionResponse,
  permissionservicev1_Permission,
  permissionservicev1_PermissionGroup,
} from '#/api/generated/admin/service/v1';

import { permissionClient, permissionGroupClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';
import type { AdminSorting } from './paging';

export type AdminPermission = permissionservicev1_Permission;
export type AdminPermissionGroup = permissionservicev1_PermissionGroup;
export type AdminPermissionStatus = NonNullable<
  permissionservicev1_Permission['status']
>;
export type AdminPermissionGroupStatus = NonNullable<
  permissionservicev1_PermissionGroup['status']
>;

export interface AdminPermissionListParams {
  code?: string;
  groupId?: number;
  name?: string;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
}

export interface AdminPermissionListResult {
  items: AdminPermission[];
  total: number;
}

export interface AdminPermissionGroupListResult {
  items: AdminPermissionGroup[];
  total: number;
  tree: AdminPermissionGroup[];
}

export interface AdminPermissionSaveInput {
  apiIds?: number[];
  code?: string;
  description?: string;
  groupId?: number;
  menuIds?: number[];
  name?: string;
  status?: AdminPermissionStatus;
}

export interface AdminPermissionGroupSaveInput {
  description?: string;
  module?: string;
  name?: string;
  parentId?: number;
  sortOrder?: number;
  status?: AdminPermissionGroupStatus;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toPermissionData(input: AdminPermissionSaveInput): AdminPermission {
  return {
    apiIds: input.apiIds ?? [],
    code: cleanText(input.code),
    description: cleanText(input.description),
    groupId: input.groupId,
    menuIds: input.menuIds ?? [],
    name: cleanText(input.name),
    status: input.status ?? 'ON',
  };
}

function toPermissionGroupData(
  input: AdminPermissionGroupSaveInput,
): AdminPermissionGroup {
  return {
    children: [],
    description: cleanText(input.description),
    module: cleanText(input.module),
    name: cleanText(input.name),
    parentId: input.parentId,
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 'ON',
  };
}

function clonePermissionGroup(
  group: AdminPermissionGroup,
): AdminPermissionGroup {
  return {
    ...group,
    children: undefined,
  };
}

export function buildPermissionGroupTree(items: AdminPermissionGroup[]) {
  const nodeMap = new Map<number, AdminPermissionGroup>();
  const roots: AdminPermissionGroup[] = [];

  for (const item of items) {
    if (item.id === undefined) {
      continue;
    }
    nodeMap.set(item.id, clonePermissionGroup(item));
  }

  for (const node of nodeMap.values()) {
    const parent =
      node.parentId === undefined ? undefined : nodeMap.get(node.parentId);
    if (parent) {
      parent.children = [...(parent.children ?? []), node];
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function listAdminPermissionsApi(
  params: AdminPermissionListParams = {},
): Promise<AdminPermissionListResult> {
  const response =
    await getAdminList<permissionservicev1_ListPermissionResponse>(
      '/admin/v1/permissions',
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
            field: 'group_id',
            op: 'EQ',
            value: params.groupId,
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

export async function listAdminPermissionGroupsApi(
  params: {
    page?: number;
    pageSize?: number;
  } = {},
): Promise<AdminPermissionGroupListResult> {
  const response =
    await getAdminList<permissionservicev1_ListPermissionGroupResponse>(
      '/admin/v1/permission-groups',
      toPagingRequest({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 200,
        sorting: [
          { direction: 'ASC', field: 'sort_order' },
          { direction: 'ASC', field: 'id' },
        ],
      }),
    );
  const items = response.items ?? [];

  return {
    items,
    total: toAdminTotal(response.total),
    tree: buildPermissionGroupTree(items),
  };
}

export async function createAdminPermissionApi(
  input: AdminPermissionSaveInput,
) {
  return await permissionClient.Create({
    data: toPermissionData(input),
  });
}

export async function updateAdminPermissionApi(
  id: number,
  input: AdminPermissionSaveInput,
) {
  return await permissionClient.Update({
    data: toPermissionData(input),
    id,
    updateMask: [
      'name',
      'code',
      'description',
      'status',
      'groupId',
      'menuIds',
      'apiIds',
    ].join(','),
  });
}

export async function deleteAdminPermissionApi(id: number) {
  return await permissionClient.Delete({ id });
}

export async function syncAdminPermissionsApi() {
  return await permissionClient.SyncPermissions({});
}

export async function createAdminPermissionGroupApi(
  input: AdminPermissionGroupSaveInput,
) {
  return await permissionGroupClient.Create({
    data: toPermissionGroupData(input),
  });
}

export async function updateAdminPermissionGroupApi(
  id: number,
  input: AdminPermissionGroupSaveInput,
) {
  return await permissionGroupClient.Update({
    data: toPermissionGroupData(input),
    id,
    updateMask: [
      'name',
      'module',
      'sortOrder',
      'status',
      'description',
      'parentId',
    ].join(','),
  });
}

export async function deleteAdminPermissionGroupApi(id: number) {
  return await permissionGroupClient.Delete({ id });
}
