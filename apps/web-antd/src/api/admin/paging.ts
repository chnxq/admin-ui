import type {
  pagination_FilterCondition,
  pagination_FilterExpr,
  pagination_Operator,
  pagination_PagingRequest,
} from '#/api/generated/admin/service/v1';

import { requestClient } from '#/api/request';

export interface AdminFilterCondition {
  field: string;
  op: pagination_Operator;
  value?: number | string;
  values?: Array<number | string>;
}

export interface AdminPagingParams {
  conditions?: AdminFilterCondition[];
  page?: number;
  pageSize?: number;
}

interface ResponseEnvelope<T = unknown> {
  code?: number | string;
  data?: T;
  message?: string;
}

function toFilterCondition(
  condition: AdminFilterCondition,
): pagination_FilterCondition {
  return {
    field: condition.field,
    op: condition.op,
    value: condition.value === undefined ? undefined : String(condition.value),
    values: condition.values?.map(String),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function appendParam(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  params.append(key, String(value));
}

function appendFilterExpr(
  params: URLSearchParams,
  filterExpr?: pagination_FilterExpr,
) {
  if (!filterExpr) {
    return;
  }

  appendParam(params, 'filterExpr.type', filterExpr.type);
  for (const condition of filterExpr.conditions ?? []) {
    appendParam(params, 'filterExpr.conditions.field', condition.field);
    appendParam(params, 'filterExpr.conditions.op', condition.op);
    appendParam(params, 'filterExpr.conditions.value', condition.value);
    appendParam(params, 'filterExpr.conditions.datePart', condition.datePart);
    appendParam(params, 'filterExpr.conditions.jsonPath', condition.jsonPath);
    for (const value of condition.values ?? []) {
      appendParam(params, 'filterExpr.conditions.values', value);
    }
  }
}

export function buildFilterExpr(
  conditions: AdminFilterCondition[] = [],
): pagination_FilterExpr | undefined {
  const normalized = conditions
    .filter((condition) => {
      if (condition.value !== undefined && condition.value !== '') {
        return true;
      }
      return condition.values !== undefined && condition.values.length > 0;
    })
    .map((condition) => toFilterCondition(condition));

  if (normalized.length === 0) {
    return undefined;
  }

  return {
    conditions: normalized,
    groups: undefined,
    type: 'AND',
  };
}

export function toPagingRequest({
  conditions,
  page = 1,
  pageSize = 10,
}: AdminPagingParams = {}): pagination_PagingRequest {
  return {
    filterExpr: buildFilterExpr(conditions),
    limit: pageSize,
    offset: (page - 1) * pageSize,
    page,
    pageSize,
    sorting: undefined,
  };
}

export function buildPagingQuery(params: pagination_PagingRequest) {
  const query = new URLSearchParams();
  appendParam(query, 'page', params.page);
  appendParam(query, 'pageSize', params.pageSize);
  appendParam(query, 'offset', params.offset);
  appendParam(query, 'limit', params.limit);
  appendParam(query, 'token', params.token);
  appendParam(query, 'noPaging', params.noPaging);
  appendParam(query, 'query', params.query);
  appendParam(query, 'filter', params.filter);
  appendFilterExpr(query, params.filterExpr);
  appendParam(query, 'orderBy', params.orderBy);

  return query.toString();
}

export function unwrapAdminEnvelope<T>(response: unknown): T {
  if (!isRecord(response) || !('code' in response) || !('data' in response)) {
    return response as T;
  }

  const envelope = response as ResponseEnvelope<T>;
  if (envelope.code === 0 || envelope.code === '0') {
    return envelope.data as T;
  }

  throw new Error(
    envelope.message || `request failed with code ${String(envelope.code)}`,
  );
}

export function toAdminTotal(total: number | string | undefined): number {
  if (typeof total === 'number') {
    return total;
  }
  if (typeof total === 'string') {
    const normalized = Number(total);
    return Number.isFinite(normalized) ? normalized : 0;
  }
  return 0;
}

export async function getAdminList<T>(
  path: string,
  params: pagination_PagingRequest,
): Promise<T> {
  const query = buildPagingQuery(params);
  const response = await requestClient.request<unknown>(
    query ? `${path}?${query}` : path,
    {
      method: 'GET',
      responseReturn: 'body',
    },
  );

  return unwrapAdminEnvelope<T>(response);
}
