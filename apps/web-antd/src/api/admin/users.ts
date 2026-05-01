import type {
  identityservicev1_ListUserResponse,
  identityservicev1_User,
} from '#/api/generated/admin/service/v1';

import { userClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminUser = identityservicev1_User;
export type AdminUserStatus = NonNullable<identityservicev1_User['status']>;

export interface AdminUserListParams {
  page?: number;
  pageSize?: number;
  username?: string;
}

export interface AdminUserListResult {
  items: AdminUser[];
  total: number;
}

export interface AdminUserSaveInput {
  description?: string;
  email?: string;
  mobile?: string;
  nickname?: string;
  password?: string;
  realname?: string;
  remark?: string;
  roleIds?: number[];
  roles?: string[];
  status?: AdminUserStatus;
  username?: string;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toUserData(input: AdminUserSaveInput): AdminUser {
  return {
    description: cleanText(input.description),
    email: cleanText(input.email),
    mobile: cleanText(input.mobile),
    nickname: cleanText(input.nickname),
    realname: cleanText(input.realname),
    remark: cleanText(input.remark),
    roleIds: input.roleIds ?? [],
    roles: input.roles ?? [],
    status: input.status ?? 'NORMAL',
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
      ],
      page: params.page,
      pageSize: params.pageSize,
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
      'email',
      'mobile',
      'status',
      'description',
      'remark',
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
