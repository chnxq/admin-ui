import type { UserInfo } from '@vben/types';

import type {
  identityservicev1_ListTenantResponse,
  identityservicev1_User,
} from '#/api/generated/admin/service/v1';

import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

import { userProfileClient } from './clients';
import { unwrapAdminEnvelope } from './paging';

const DEFAULT_HOME_PATH = '/analytics';
const PROFILE_HOME_PATH = '/profile';

function toUserInfo(user: identityservicev1_User): UserInfo {
  const accessStore = useAccessStore();
  const username = user.username || '';
  const realName = user.nickname || user.realname || username;
  const tenantId = user.tenantId;
  const tenantName = user.tenantName;
  const profileCompleted = Boolean(
    (user.realname || '').trim() && (user.nickname || '').trim(),
  );

  return {
    avatar: user.avatar || '',
    desc: user.description || user.remark || '',
    homePath: profileCompleted ? DEFAULT_HOME_PATH : PROFILE_HOME_PATH,
    profileCompleted,
    realName,
    roles: user.roles ?? [],
    sessionScope: tenantId ? 'tenant' : 'platform',
    tenantId,
    tenantName,
    token: accessStore.accessToken || '',
    userId: String(user.id ?? ''),
    username,
  };
}

export async function getUserInfoApi() {
  const user = await userProfileClient.GetUser({});
  return toUserInfo(user);
}

export async function getProfileTenantOptionsApi() {
  const response = await requestClient.request<unknown>(
    '/admin/v1/me/tenant-options',
    {
      method: 'GET',
      responseReturn: 'body',
    },
  );
  return unwrapAdminEnvelope<identityservicev1_ListTenantResponse>(response);
}
