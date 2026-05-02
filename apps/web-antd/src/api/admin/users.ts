import type { AdminSorting } from './paging';

import type {
  identityservicev1_ListUserResponse,
  identityservicev1_User,
} from '#/api/generated/admin/service/v1';

import { userClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminUser = identityservicev1_User;
export type AdminUserStatus = NonNullable<identityservicev1_User['status']>;

export interface AdminUserListParams {
  mobile?: string;
  orgUnitId?: number;
  page?: number;
  pageSize?: number;
  positionId?: number;
  realname?: string;
  roleId?: number;
  sorting?: AdminSorting[];
  status?: AdminUserStatus;
  telephone?: string;
  username?: string;
}

export interface AdminUserListResult {
  items: AdminUser[];
  total: number;
}

export interface AdminUserSaveInput {
  address?: string;
  avatar?: string;
  description?: string;
  email?: string;
  gender?: identityservicev1_User['gender'];
  mobile?: string;
  nickname?: string;
  orgUnitIds?: number[];
  password?: string;
  positionIds?: number[];
  region?: string;
  realname?: string;
  remark?: string;
  roleIds?: number[];
  status?: AdminUserStatus;
  telephone?: string;
  username?: string;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toUserData(input: AdminUserSaveInput): AdminUser {
  return {
    address: cleanText(input.address),
    avatar: cleanText(input.avatar),
    description: cleanText(input.description),
    email: cleanText(input.email),
    gender: input.gender,
    mobile: cleanText(input.mobile),
    nickname: cleanText(input.nickname),
    orgUnitIds: input.orgUnitIds ?? [],
    positionIds: input.positionIds ?? [],
    region: cleanText(input.region),
    realname: cleanText(input.realname),
    remark: cleanText(input.remark),
    roleIds: input.roleIds ?? [],
    status: input.status ?? 'NORMAL',
    telephone: cleanText(input.telephone),
    username: cleanText(input.username),
  } as AdminUser;
}

export async function listAdminUsersApi(
  params: AdminUserListParams = {},
): Promise<AdminUserListResult> {
  const response = await getAdminList<identityservicev1_ListUserResponse>(
    '/admin/v1/users',
    toPagingRequest({
      conditions: [
        {
          field: 'username',
          op: 'CONTAINS',
          value: cleanText(params.username),
        },
        {
          field: 'realname',
          op: 'CONTAINS',
          value: cleanText(params.realname),
        },
        {
          field: 'mobile',
          op: 'CONTAINS',
          value: cleanText(params.mobile),
        },
        {
          field: 'telephone',
          op: 'CONTAINS',
          value: cleanText(params.telephone),
        },
        {
          field: 'org_unit_id',
          op: 'EQ',
          value: params.orgUnitId,
        },
        {
          field: 'position_id',
          op: 'EQ',
          value: params.positionId,
        },
        {
          field: 'role_id',
          op: 'EQ',
          value: params.roleId,
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

export async function getAdminUserApi(id: number) {
  return await userClient.Get({ id });
}

export async function createAdminUserApi(input: AdminUserSaveInput) {
  return await userClient.Create({
    data: toUserData(input),
    password: cleanText(input.password),
  });
}

export async function updateAdminUserApi(
  id: number,
  input: AdminUserSaveInput,
) {
  return await userClient.Update({
    data: toUserData(input),
    id,
    password: cleanText(input.password),
    updateMask: [
      'username',
      'nickname',
      'realname',
      'avatar',
      'email',
      'mobile',
      'telephone',
      'gender',
      'address',
      'region',
      'status',
      'description',
      'remark',
      'orgUnitIds',
      'positionIds',
      'roleIds',
    ].join(','),
  });
}

export async function deleteAdminUserApi(id: number) {
  return await userClient.Delete({ id });
}

export async function editAdminUserPasswordApi(
  userId: number,
  newPassword: string,
) {
  return await userClient.EditUserPassword({
    newPassword,
    userId,
  });
}
