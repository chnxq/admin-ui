import type { RouteRecordStringComponent } from '@vben/types';

import { getAllMenusApi as getAdminAllMenusApi } from '../admin/portal';

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi() {
  return getAdminAllMenusApi() as Promise<RouteRecordStringComponent[]>;
}
