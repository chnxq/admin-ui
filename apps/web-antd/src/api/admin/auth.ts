import { authenticationClient } from './clients';
import { getCaptchaApi, getPermissionCodesApi } from './portal';

const REFRESH_TOKEN_STORAGE_KEY = 'admin.refresh_token';

export interface LoginParams {
  captchaCode?: string;
  captchaId?: string;
  password?: string;
  username?: string;
}

export interface LoginResult {
  accessToken: string;
}

export interface RefreshTokenResult {
  data: string;
  status: number;
}

export interface CaptchaResult {
  captchaId: string;
  expiresIn?: number;
  imageBase64: string;
}

function getStorage() {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function getRefreshToken() {
  return getStorage()?.getItem(REFRESH_TOKEN_STORAGE_KEY) || '';
}

function setRefreshToken(token?: string) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (token) {
    storage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  } else {
    storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

function requireAccessToken(accessToken?: string) {
  if (!accessToken) {
    throw new Error('Login response does not include access_token.');
  }

  return accessToken;
}

export async function loginApi(data: LoginParams): Promise<LoginResult> {
  const response = await authenticationClient.Login({
    client_id: data.captchaId,
    client_type: 'admin',
    code: data.captchaCode,
    grant_type: 'password',
    password: data.password,
    username: data.username,
  });
  const accessToken = requireAccessToken(response.access_token);

  setRefreshToken(response.refresh_token);

  return { accessToken };
}

export async function refreshTokenApi(): Promise<RefreshTokenResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('Refresh token is empty.');
  }

  const response = await authenticationClient.RefreshToken({
    client_type: 'admin',
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const accessToken = requireAccessToken(response.access_token);

  setRefreshToken(response.refresh_token || refreshToken);

  return {
    data: accessToken,
    status: 200,
  };
}

export async function logoutApi() {
  try {
    await authenticationClient.Logout({});
  } finally {
    setRefreshToken();
  }
}

export async function getAccessCodesApi() {
  return await getPermissionCodesApi();
}

export async function getCaptchaApiV1(): Promise<CaptchaResult> {
  const response = await getCaptchaApi();
  if (!response.captchaId || !response.imageBase64) {
    throw new Error('captcha response is invalid');
  }
  return {
    captchaId: response.captchaId,
    expiresIn: response.expiresIn,
    imageBase64: response.imageBase64,
  };
}
