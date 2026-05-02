import type {
  identityservicev1_ListOrgUnitResponse,
  identityservicev1_OrgUnit,
} from '#/api/generated/admin/service/v1';

import { orgUnitClient } from './clients';
import {
  getAdminList,
  toAdminTotal,
  toPagingRequest,
  type AdminSorting,
} from './paging';

export type AdminOrgUnit = identityservicev1_OrgUnit;
export type AdminOrgUnitStatus = NonNullable<AdminOrgUnit['status']>;
export type AdminOrgUnitType = NonNullable<AdminOrgUnit['type']>;

export interface AdminOrgUnitListParams {
  code?: string;
  name?: string;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
}

export interface AdminOrgUnitListResult {
  items: AdminOrgUnit[];
  total: number;
  tree: AdminOrgUnit[];
}

export interface AdminOrgUnitSaveInput {
  address?: string;
  code?: string;
  description?: string;
  email?: string;
  name?: string;
  parentId?: number;
  phone?: string;
  remark?: string;
  sortOrder?: number;
  status?: AdminOrgUnitStatus;
  type?: AdminOrgUnitType;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toOrgUnitData(input: AdminOrgUnitSaveInput): AdminOrgUnit {
  return {
    address: cleanText(input.address),
    attributes: {},
    businessScopes: [],
    children: [],
    code: cleanText(input.code),
    description: cleanText(input.description),
    email: cleanText(input.email),
    name: cleanText(input.name),
    parentId: input.parentId,
    permissionTags: [],
    phone: cleanText(input.phone),
    remark: cleanText(input.remark),
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 'ON',
    type: input.type ?? 'DEPARTMENT',
  };
}

function cloneOrgUnit(item: AdminOrgUnit): AdminOrgUnit {
  return {
    ...item,
    attributes: item.attributes ? { ...item.attributes } : {},
    businessScopes: [...(item.businessScopes ?? [])],
    children: undefined,
    permissionTags: [...(item.permissionTags ?? [])],
  };
}

export function buildOrgUnitTree(items: AdminOrgUnit[]) {
  const nodeMap = new Map<number, AdminOrgUnit>();
  const roots: AdminOrgUnit[] = [];

  for (const item of items) {
    if (item.id === undefined) {
      continue;
    }
    nodeMap.set(item.id, cloneOrgUnit(item));
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

export async function listAdminOrgUnitsApi(
  params: AdminOrgUnitListParams = {},
): Promise<AdminOrgUnitListResult> {
  const response = await getAdminList<identityservicev1_ListOrgUnitResponse>(
    '/admin/v1/org-units',
    toPagingRequest({
      conditions: [
        { field: 'name', op: 'CONTAINS', value: cleanText(params.name) },
        { field: 'code', op: 'CONTAINS', value: cleanText(params.code) },
      ],
      page: params.page,
      pageSize: params.pageSize ?? 100,
      sorting: params.sorting,
    }),
  );
  const items = response.items ?? [];

  return {
    items,
    total: toAdminTotal(response.total),
    tree: buildOrgUnitTree(items),
  };
}

export async function getAdminOrgUnitApi(id: number) {
  return await orgUnitClient.Get({ id });
}

export async function createAdminOrgUnitApi(input: AdminOrgUnitSaveInput) {
  return await orgUnitClient.Create({
    data: toOrgUnitData(input),
  });
}

export async function updateAdminOrgUnitApi(
  id: number,
  input: AdminOrgUnitSaveInput,
) {
  return await orgUnitClient.Update({
    data: toOrgUnitData(input),
    id,
    updateMask: [
      'name',
      'code',
      'type',
      'parentId',
      'sortOrder',
      'status',
      'phone',
      'email',
      'address',
      'description',
      'remark',
    ].join(','),
  });
}

export async function deleteAdminOrgUnitApi(id: number) {
  return await orgUnitClient.Delete({ id });
}
