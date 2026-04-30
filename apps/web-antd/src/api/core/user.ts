import type { UserInfo } from '@vben/types';

import { getUserInfoApi as getAdminUserInfoApi } from '../admin/user';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return getAdminUserInfoApi() as Promise<UserInfo>;
}
