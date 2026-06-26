import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

const reasonToI18nKey: Record<string, string> = {
  BAD_REQUEST: 'authentication.serverError.badRequest',
  FORBIDDEN: 'authentication.serverError.forbidden',
  INCORRECT_ACCESS_TOKEN: 'authentication.serverError.incorrectAccessToken',
  INCORRECT_PASSWORD: 'authentication.serverError.incorrectPassword',
  INCORRECT_REFRESH_TOKEN: 'authentication.serverError.incorrectRefreshToken',
  INTERNAL_SERVER_ERROR: 'authentication.serverError.internalServerError',
  INVALID_PASSWORD: 'authentication.serverError.invalidPassword',
  TOKEN_EXPIRED: 'authentication.serverError.tokenExpired',
  UNAUTHORIZED: 'authentication.serverError.unauthorized',
  USER_NOT_FOUND: 'authentication.serverError.userNotFound',
};

const messageToI18nKey: Record<string, string> = {
  'captcha_id and code are required':
    'authentication.serverError.captchaRequired',
  'incorrect password': 'authentication.serverError.incorrectPassword',
  'invalid captcha code': 'authentication.serverError.invalidCaptchaCode',
};

let unauthorizedLogoutPromise: null | Promise<void> = null;

const publicRequestPaths = new Set([
  '/admin/v1/captcha',
  '/admin/v1/login',
  '/admin/v1/refresh-token',
]);

function resolveErrorMessage(error: any, fallbackMessage: string) {
  const responseData = error?.response?.data ?? {};
  let rawMessage = '';
  if (typeof responseData?.error === 'string') {
    rawMessage = responseData.error.trim();
  } else if (typeof responseData?.message === 'string') {
    rawMessage = responseData.message.trim();
  }
  if (rawMessage) {
    const normalizedMessage = rawMessage.toLowerCase();
    const mappedKey = messageToI18nKey[normalizedMessage];
    if (mappedKey) {
      return $t(mappedKey);
    }
  }

  const reason =
    typeof responseData?.reason === 'string'
      ? responseData.reason.trim().toUpperCase()
      : '';
  if (reason && reasonToI18nKey[reason]) {
    return $t(reasonToI18nKey[reason]);
  }

  if (rawMessage) {
    return rawMessage;
  }
  return fallbackMessage;
}

export async function handleUnauthorizedError(redirect: boolean = true) {
  if (unauthorizedLogoutPromise) {
    return unauthorizedLogoutPromise;
  }

  const authStore = useAuthStore();
  unauthorizedLogoutPromise = authStore.logout(redirect).finally(() => {
    unauthorizedLogoutPromise = null;
  });
  return unauthorizedLogoutPromise;
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await handleUnauthorizedError(false);
    }
  }

  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi();
    const newToken = resp.data;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  function shouldAttachAccessToken(url?: string) {
    if (!url) {
      return true;
    }
    const normalizedUrl = url.split('?')[0] || '';
    return !publicRequestPaths.has(normalizedUrl);
  }

  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      if (shouldAttachAccessToken(config.url)) {
        config.headers.Authorization = formatToken(accessStore.accessToken);
      } else if (config.headers.Authorization) {
        delete config.headers.Authorization;
      }
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );

  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      message.error(resolveErrorMessage(error, msg));
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
