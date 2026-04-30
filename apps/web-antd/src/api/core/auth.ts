import {
  getAccessCodesApi as getAdminAccessCodesApi,
  loginApi as loginAdminApi,
  logoutApi as logoutAdminApi,
  refreshTokenApi as refreshAdminTokenApi,
} from '../admin/auth';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return loginAdminApi(data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return refreshAdminTokenApi();
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return logoutAdminApi();
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return getAdminAccessCodesApi();
}
