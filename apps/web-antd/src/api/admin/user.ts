import type { UserInfo } from '@vben/types';

import type { identityservicev1_User } from '#/api/generated/admin/service/v1';

import { useAccessStore } from '@vben/stores';

import { userProfileClient } from './clients';

const DEFAULT_HOME_PATH = '/analytics';

function toUserInfo(user: identityservicev1_User): UserInfo {
  const accessStore = useAccessStore();
  const username = user.username || '';
  const realName = user.nickname || user.realname || username;
  const tenantId = user.tenantId;
  const tenantName = user.tenantName;

  return {
    avatar: user.avatar || '',
    desc: user.description || user.remark || '',
    homePath: DEFAULT_HOME_PATH,
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
