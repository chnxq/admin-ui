import type { BasicUserInfo } from '@vben-core/typings';

/** 用户信息 */
interface UserInfo extends BasicUserInfo {
  /**
   * 用户描述
   */
  desc: string;
  /**
   * 首页地址
   */
  homePath: string;

  /**
   * accessToken
   */
  token: string;
  /**
   * 当前会话租户ID，平台态为空
   */
  tenantId?: number;
  /**
   * 当前会话租户名称，平台态为空
   */
  tenantName?: string;
  /**
   * 当前会话范围
   */
  sessionScope?: 'platform' | 'tenant';
}

export type { UserInfo };
