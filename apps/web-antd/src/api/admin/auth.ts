import { authenticationClient } from './clients';
import { getPermissionCodesApi } from './portal';

const REFRESH_TOKEN_STORAGE_KEY = 'admin.refresh_token';

export interface LoginParams {
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
    client_type: 'admin',
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
