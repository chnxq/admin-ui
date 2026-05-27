import type { RequestClientConfig } from '@vben/request';

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
    response = await requestClient.request<unknown>(
      normalizePath(request.path),
      config,
    );
  } catch (error: any) {
    const status = error?.response?.status;
    const reason =
      typeof error?.response?.data?.reason === 'string'
        ? error.response.data.reason.trim().toUpperCase()
        : '';
    if (status === 401 || reason === 'UNAUTHORIZED') {
      await handleUnauthorizedError(false);
    }
    throw error;
  }

  return unwrapEnvelope<T>(response, meta);
}
