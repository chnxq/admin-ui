import type { RequestClientConfig } from '@vben/request';

import { useAccessStore } from '@vben/stores';

import { handleUnauthorizedError, requestClient } from '#/api/request';

interface GeneratedRequest {
  body: null | string;
  method: string;
  path: string;
}

interface GeneratedRequestMeta {
  method: string;
  service: string;
}

interface ResponseEnvelope<T = unknown> {
  code?: number | string;
  data?: T;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

const publicAuthPaths = new Set([
  '/admin/v1/auth-sessions',
  '/admin/v1/captcha',
  '/admin/v1/login',
  '/admin/v1/logout',
  '/admin/v1/refresh-token',
  '/admin/v1/register',
  '/admin/v1/social-auth/miniapp:exchange-code',
  '/admin/v1/social-auth:complete',
  '/admin/v1/social-auth:confirm-bind-or-register',
  '/admin/v1/social-auth:start',
]);

function shouldHandleUnauthorized(path: string) {
  const accessStore = useAccessStore();
  if (!accessStore.accessToken) {
    return false;
  }
  if (publicAuthPaths.has(path)) {
    return false;
  }
  return true;
}

function parseBody(body: null | string) {
  if (body === null || body === '') {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function unwrapEnvelope<T>(response: unknown, meta: GeneratedRequestMeta): T {
  if (!isRecord(response) || !('code' in response) || !('data' in response)) {
    return response as T;
  }

  const envelope = response as ResponseEnvelope<T>;
  if (envelope.code === 0 || envelope.code === '0') {
    return envelope.data as T;
  }

  throw new Error(
    envelope.message ||
      `${meta.service}.${meta.method} failed with code ${String(envelope.code)}`,
  );
}

export async function adminRequestHandler<T = unknown>(
  request: GeneratedRequest,
  meta: GeneratedRequestMeta,
): Promise<T> {
  const method = request.method.toUpperCase();
  const path = normalizePath(request.path);
  const body = parseBody(request.body);
  const config: RequestClientConfig = {
    method: method as RequestClientConfig['method'],
    responseReturn: 'body',
  };

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    config.data = body;
  }

  let response: unknown;
  try {
    response = await requestClient.request<unknown>(path, config);
  } catch (error: any) {
    const status = error?.response?.status;
    const reason =
      typeof error?.response?.data?.reason === 'string'
        ? error.response.data.reason.trim().toUpperCase()
        : '';
    if (
      (status === 401 ||
        reason === 'UNAUTHORIZED' ||
        reason === 'TOKEN_EXPIRED') &&
      shouldHandleUnauthorized(path)
    ) {
      await handleUnauthorizedError(false);
    }
    throw error;
  }

  return unwrapEnvelope<T>(response, meta);
}
