import type { AdminSorting } from './paging';

import type {
  resourceservicev1_ListMenuResponse,
  resourceservicev1_Menu,
} from '#/api/generated/admin/service/v1';

import { requestClient } from '#/api/request';

import { menuClient } from './clients';
import {
  getAdminList,
  toAdminTotal,
  toPagingRequest,
  unwrapAdminEnvelope,
} from './paging';

export type AdminMenu = resourceservicev1_Menu;
export type AdminMenuStatus = NonNullable<resourceservicev1_Menu['status']>;
export type AdminMenuType = NonNullable<resourceservicev1_Menu['type']>;

export interface AdminMenuListParams {
  name?: string;
  page?: number;
  pageSize?: number;
  path?: string;
  sorting?: AdminSorting[];
}

export interface AdminMenuListResult {
  items: AdminMenu[];
  total: number;
  tree: AdminMenu[];
}

export interface AdminMenuSaveInput {
  authority?: string[];
  component?: string;
  icon?: string;
  ignoreAccess?: boolean;
  menuVisibleWithForbidden?: boolean;
  name?: string;
  parentId?: number;
  path?: string;
  redirect?: string;
  status?: AdminMenuStatus;
  title?: string;
  type?: AdminMenuType;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toMenuData(input: AdminMenuSaveInput): AdminMenu {
  return {
    children: [],
    component: cleanText(input.component),
    meta: {
      authority: input.authority?.filter(Boolean) ?? [],
      icon: cleanText(input.icon),
      ignoreAccess: input.ignoreAccess,
      menuVisibleWithForbidden: input.menuVisibleWithForbidden,
      title: cleanText(input.title) ?? cleanText(input.name) ?? '',
    },
    name: cleanText(input.name),
    parentId: input.parentId,
    path: cleanText(input.path),
    redirect: cleanText(input.redirect),
    status: input.status ?? 'ON',
    type: input.type ?? 'MENU',
  };
}

function cloneMenu(menu: AdminMenu): AdminMenu {
  return {
    ...menu,
    children: undefined,
    meta: menu.meta ? { ...menu.meta } : undefined,
  };
}

export function buildMenuTree(items: AdminMenu[]) {
  const nodeMap = new Map<number, AdminMenu>();
  const roots: AdminMenu[] = [];

  for (const item of items) {
    if (item.id === undefined) {
      continue;
    }
    nodeMap.set(item.id, cloneMenu(item));
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

export async function listAdminMenusApi(
  params: AdminMenuListParams = {},
): Promise<AdminMenuListResult> {
  const response = await getAdminList<resourceservicev1_ListMenuResponse>(
    '/admin/v1/menus',
    toPagingRequest({
      conditions: [
        {
          field: 'name',
          op: 'CONTAINS',
          value: cleanText(params.name),
        },
        {
          field: 'path',
          op: 'CONTAINS',
          value: cleanText(params.path),
        },
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
    tree: buildMenuTree(items),
  };
}

export async function getAdminMenuApi(id: number) {
  return await menuClient.Get({ id });
}

export async function createAdminMenuApi(input: AdminMenuSaveInput) {
  return await menuClient.Create({
    data: toMenuData(input),
  });
}

export async function updateAdminMenuApi(
  id: number,
  input: AdminMenuSaveInput,
) {
  return await menuClient.Update({
    data: toMenuData(input),
    id,
    updateMask: [
      'status',
      'type',
      'path',
      'redirect',
      'name',
      'component',
      'meta',
      'parentId',
    ].join(','),
  });
}

export async function deleteAdminMenuApi(id: number) {
  return await menuClient.Delete({ id });
}

export async function syncAdminMenusApi() {
  const response = await requestClient.request<unknown>(
    '/admin/v1/menus:sync',
    {
      method: 'POST',
      responseReturn: 'body',
    },
  );
  return unwrapAdminEnvelope(response);
}
