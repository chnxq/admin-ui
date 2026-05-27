import type { AdminSorting } from './paging';

import type {
  dictservicev1_DictEntry,
  dictservicev1_DictEntryI18n,
  dictservicev1_DictType,
  dictservicev1_ListDictEntryResponse,
  dictservicev1_ListDictTypeResponse,
} from '#/api/generated/admin/service/v1';

import { dictEntryClient, dictTypeClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminDictType = dictservicev1_DictType;
export type AdminDictEntry = dictservicev1_DictEntry;
export type AdminDictEntryI18n = dictservicev1_DictEntryI18n;

export interface AdminDictTypeListParams {
  isEnabled?: boolean;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
  typeCode?: string;
  typeName?: string;
}

export interface AdminDictEntryListParams {
  entryValue?: string;
  isEnabled?: boolean;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
  typeId?: number;
}

export interface AdminDictTypeListResult {
  items: AdminDictType[];
  total: number;
}

export interface AdminDictEntryListResult {
  items: AdminDictEntry[];
  total: number;
}

export interface AdminDictTypeSaveInput {
  isEnabled?: boolean;
  sortOrder?: number;
  typeCode?: string;
  typeName?: string;
}

export interface AdminDictEntrySaveInput {
  currentI18n?: AdminDictEntryI18n;
  entryValue?: string;
  i18n?: Record<string, AdminDictEntryI18n>;
  isEnabled?: boolean;
  numericValue?: number;
  sortOrder?: number;
  typeId?: number;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toDictTypeData(input: AdminDictTypeSaveInput): AdminDictType {
  return {
    isEnabled: input.isEnabled ?? true,
    sortOrder: input.sortOrder ?? 0,
    typeCode: cleanText(input.typeCode),
    typeName: cleanText(input.typeName),
  };
}

function cleanI18nMap(
  value?: Record<string, AdminDictEntryI18n>,
): Record<string, AdminDictEntryI18n> | undefined {
  if (!value) {
    return undefined;
  }

  const entries: Array<[string, AdminDictEntryI18n]> = [];
  for (const [key, item] of Object.entries(value)) {
    const entryLabel = cleanText(item?.entryLabel);
    const description = cleanText(item?.description);
    const languageCode = cleanText(item?.languageCode) ?? key;
    const languageName = cleanText(item?.languageName);
    if (!entryLabel && !description) {
      continue;
    }
    entries.push([
      key,
      {
        description,
        entryLabel,
        languageCode,
        languageName,
      },
    ]);
  }

  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function toDictEntryData(input: AdminDictEntrySaveInput): AdminDictEntry {
  return {
    currentI18n: input.currentI18n,
    entryValue: cleanText(input.entryValue),
    i18n: cleanI18nMap(input.i18n),
    isEnabled: input.isEnabled ?? true,
    numericValue: input.numericValue ?? 0,
    sortOrder: input.sortOrder ?? 0,
    typeId: input.typeId,
  };
}

export async function listAdminDictTypesApi(
  params: AdminDictTypeListParams = {},
): Promise<AdminDictTypeListResult> {
  const response = await getAdminList<dictservicev1_ListDictTypeResponse>(
    '/admin/v1/dict/types',
    toPagingRequest({
      conditions: [
        {
          field: 'type_code',
          op: 'CONTAINS',
          value: cleanText(params.typeCode),
        },
        {
          field: 'type_name',
          op: 'CONTAINS',
          value: cleanText(params.typeName),
        },
        {
          field: 'is_enabled',
          op: 'EQ',
          value:
            params.isEnabled === undefined
              ? undefined
              : (params.isEnabled
                ? 1
                : 0),
        },
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

export async function createAdminDictTypeApi(input: AdminDictTypeSaveInput) {
  return await dictTypeClient.Create({
    data: toDictTypeData(input),
  });
}

export async function updateAdminDictTypeApi(
  id: number,
  input: AdminDictTypeSaveInput,
) {
  return await dictTypeClient.Update({
    data: toDictTypeData(input),
    id,
    updateMask: ['typeCode', 'typeName', 'isEnabled', 'sortOrder'].join(','),
  });
}

export async function deleteAdminDictTypeApi(id: number) {
  return await dictTypeClient.Delete({ ids: [id] });
}

export async function listAdminDictEntriesApi(
  params: AdminDictEntryListParams = {},
): Promise<AdminDictEntryListResult> {
  const response = await getAdminList<dictservicev1_ListDictEntryResponse>(
    '/admin/v1/dict/entries',
    toPagingRequest({
      conditions: [
        {
          field: 'type_id',
          op: 'EQ',
          value: params.typeId,
        },
        {
          field: 'entry_value',
          op: 'CONTAINS',
          value: cleanText(params.entryValue),
        },
        {
          field: 'is_enabled',
          op: 'EQ',
          value:
            params.isEnabled === undefined
              ? undefined
              : (params.isEnabled
                ? 1
                : 0),
        },
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

export async function createAdminDictEntryApi(input: AdminDictEntrySaveInput) {
  return await dictEntryClient.Create({
    data: toDictEntryData(input),
  });
}

export async function updateAdminDictEntryApi(
  id: number,
  input: AdminDictEntrySaveInput,
) {
  return await dictEntryClient.Update({
    data: toDictEntryData(input),
    id,
    updateMask: [
      'typeId',
      'entryValue',
      'numericValue',
      'isEnabled',
      'sortOrder',
      'i18n',
    ].join(','),
  });
}

export async function deleteAdminDictEntryApi(id: number) {
  return await dictEntryClient.Delete({ ids: [id] });
}
