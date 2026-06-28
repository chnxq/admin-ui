import type { AdminSorting } from './paging';

import type {
  identityservicev1_ListPositionResponse,
  identityservicev1_Position,
} from '#/api/generated/admin/service/v1';

import { positionClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminPosition = identityservicev1_Position;
export type AdminPositionStatus = NonNullable<AdminPosition['status']>;
export type AdminPositionType = NonNullable<AdminPosition['type']>;

export interface AdminPositionListParams {
  code?: string;
  name?: string;
  tenantId?: number;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
}

export interface AdminPositionListResult {
  items: AdminPosition[];
  total: number;
}

export interface AdminPositionSaveInput {
  code?: string;
  description?: string;
  headcount?: number;
  isKeyPosition?: boolean;
  jobFamily?: string;
  jobGrade?: string;
  level?: number;
  name?: string;
  orgUnitId?: number;
  remark?: string;
  reportsToPositionId?: number;
  sortOrder?: number;
  status?: AdminPositionStatus;
  type?: AdminPositionType;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toPositionData(input: AdminPositionSaveInput): AdminPosition {
  return {
    code: cleanText(input.code),
    description: cleanText(input.description),
    headcount: input.headcount ?? 0,
    isKeyPosition: input.isKeyPosition ?? false,
    jobFamily: cleanText(input.jobFamily),
    jobGrade: cleanText(input.jobGrade),
    level: input.level ?? 0,
    name: cleanText(input.name),
    orgUnitId: input.orgUnitId,
    remark: cleanText(input.remark),
    reportsToPositionId: input.reportsToPositionId,
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 'ON',
    type: input.type ?? 'REGULAR',
  };
}

export async function listAdminPositionsApi(
  params: AdminPositionListParams = {},
): Promise<AdminPositionListResult> {
  const response = await getAdminList<identityservicev1_ListPositionResponse>(
    '/admin/v1/positions',
    toPagingRequest({
      conditions: [
        { field: 'name', op: 'CONTAINS', value: cleanText(params.name) },
        { field: 'code', op: 'CONTAINS', value: cleanText(params.code) },
        { field: 'tenant_id', op: 'EQ', value: params.tenantId },
      ],
      page: params.page,
      pageSize: params.pageSize,
      sorting: params.sorting,
    }),
  );

  return {
    items: response.items ?? [],
    total: toAdminTotal(response.total),
  };
}

export async function getAdminPositionApi(id: number) {
  return await positionClient.Get({ id });
}

export async function createAdminPositionApi(input: AdminPositionSaveInput) {
  return await positionClient.Create({
    data: toPositionData(input),
  });
}

export async function updateAdminPositionApi(
  id: number,
  input: AdminPositionSaveInput,
) {
  return await positionClient.Update({
    data: toPositionData(input),
    id,
    updateMask: [
      'name',
      'code',
      'type',
      'headcount',
      'sortOrder',
      'status',
      'orgUnitId',
      'reportsToPositionId',
      'jobFamily',
      'jobGrade',
      'level',
      'isKeyPosition',
      'description',
      'remark',
    ].join(','),
  });
}

export async function deleteAdminPositionApi(id: number) {
  return await positionClient.Delete({ id });
}
