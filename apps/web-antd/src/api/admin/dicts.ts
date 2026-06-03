import type { AdminSorting } from './paging';

import type {
  dictservicev1_DictEntry,
  dictservicev1_DictEntryI18n,
  dictservicev1_DictType,
  dictservicev1_ListDictEntryResponse,
  dictservicev1_ListDictTypeResponse,
} from '#/api/generated/admin/service/v1';

import { dictCategoryClient, dictLabelClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminDictCategoryLevel = 'CHILD' | 'ROOT';
export type AdminDictCategoryScene =
  | 'DEVICE'
  | 'MENU'
  | 'OTHER'
  | 'PAGE'
  | 'PROMPT';
export type AdminDictLabelKind =
  | 'BADGE'
  | 'ENUM'
  | 'HINT'
  | 'MENU'
  | 'MESSAGE'
  | 'TEXT';
export type AdminDictLabelStatus = 'OFF' | 'ON';

export interface AdminDictLabelI18n {
  description?: string;
  languageCode?: string;
  languageName?: string;
  shortText?: string;
  textValue?: string;
}

export interface AdminDictCategory {
  categoryKey?: string;
  categoryLevel?: AdminDictCategoryLevel;
  categoryName?: string;
  children?: AdminDictCategory[];
  createdAt?: string;
  deletedAt?: string;
  description?: string;
  id?: number;
  isBuiltin?: boolean;
  isEnabled?: boolean;
  parentId?: number;
  scene?: AdminDictCategoryScene;
  sortOrder?: number;
  tenantId?: number;
  tenantName?: string;
  updatedAt?: string;
}

export interface AdminDictLabel {
  categoryId?: number;
  categoryKey?: string;
  createdAt?: string;
  currentI18n?: AdminDictLabelI18n;
  defaultText?: string;
  deletedAt?: string;
  description?: string;
  id?: number;
  isBuiltin?: boolean;
  isEnabled?: boolean;
  itemsI18n?: AdminDictLabelI18n[];
  labelCode?: string;
  labelKey?: string;
  labelKind?: AdminDictLabelKind;
  payloadJson?: string;
  sortOrder?: number;
  status?: AdminDictLabelStatus;
  tenantId?: number;
  tenantName?: string;
  updatedAt?: string;
}

export interface AdminDictCategoryListParams {
  categoryKey?: string;
  categoryName?: string;
  isEnabled?: boolean;
  page?: number;
  pageSize?: number;
  scene?: AdminDictCategoryScene;
  sorting?: AdminSorting[];
}

export interface AdminDictLabelListParams {
  categoryId?: number;
  isEnabled?: boolean;
  labelCode?: string;
  labelKey?: string;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
}

export interface AdminDictCategoryListResult {
  items: AdminDictCategory[];
  total: number;
}

export interface AdminDictLabelListResult {
  items: AdminDictLabel[];
  total: number;
}

export interface AdminDictCategorySaveInput {
  categoryKey?: string;
  categoryLevel?: AdminDictCategoryLevel;
  categoryName?: string;
  description?: string;
  isBuiltin?: boolean;
  isEnabled?: boolean;
  parentId?: number;
  scene?: AdminDictCategoryScene;
  sortOrder?: number;
}

export interface AdminDictLabelSaveInput {
  categoryId?: number;
  defaultText?: string;
  description?: string;
  i18nItems?: AdminDictLabelI18n[];
  isBuiltin?: boolean;
  isEnabled?: boolean;
  labelCode?: string;
  labelKey?: string;
  labelKind?: AdminDictLabelKind;
  payloadJson?: string;
  shortTextEn?: string;
  shortTextZh?: string;
  sortOrder?: number;
  status?: AdminDictLabelStatus;
  textEn?: string;
  textZh?: string;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toTimestampText(
  value?: string | { nanos?: number; seconds?: string },
) {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (!value.seconds) {
    return undefined;
  }
  const millis =
    Number(value.seconds) * 1000 + Math.floor((value.nanos ?? 0) / 1_000_000);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : undefined;
}

function deriveSceneFromTypeCode(typeCode?: string): AdminDictCategoryScene {
  const value = (typeCode ?? '').toLowerCase();
  if (value.startsWith('page')) return 'PAGE';
  if (value.startsWith('menu')) return 'MENU';
  if (value.startsWith('prompt')) return 'PROMPT';
  if (value.startsWith('device')) return 'DEVICE';
  return 'OTHER';
}

function deriveLabelKind(entryValue?: string): AdminDictLabelKind {
  const value = (entryValue ?? '').toLowerCase();
  if (value.includes('menu')) return 'MENU';
  if (value.includes('message')) return 'MESSAGE';
  if (value.includes('enum')) return 'ENUM';
  if (value.includes('hint')) return 'HINT';
  if (value.includes('badge')) return 'BADGE';
  return 'TEXT';
}

function toAdminDictLabelI18n(
  input?: dictservicev1_DictEntryI18n,
): AdminDictLabelI18n | undefined {
  if (!input) {
    return undefined;
  }
  return {
    description: input.description,
    languageCode: input.languageCode,
    languageName: input.languageName,
    textValue: input.entryLabel,
  };
}

function toAdminDictCategory(input: dictservicev1_DictType): AdminDictCategory {
  return {
    categoryKey: input.typeCode,
    categoryLevel: 'ROOT',
    categoryName: input.typeName,
    children: [],
    createdAt: toTimestampText(input.createdAt),
    deletedAt: toTimestampText(input.deletedAt),
    description: undefined,
    id: input.id,
    isBuiltin: true,
    isEnabled: input.isEnabled ?? true,
    parentId: undefined,
    scene: deriveSceneFromTypeCode(input.typeCode),
    sortOrder: input.sortOrder,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    updatedAt: toTimestampText(input.updatedAt),
  };
}

function toAdminDictLabel(
  input: dictservicev1_DictEntry,
  category?: AdminDictCategory,
): AdminDictLabel {
  const i18nItems = Object.values(input.i18n ?? {})
    .map((item) => toAdminDictLabelI18n(item))
    .filter((item): item is AdminDictLabelI18n => item !== undefined);
  const currentI18n = toAdminDictLabelI18n(input.currentI18n);
  const defaultText =
    currentI18n?.textValue ??
    i18nItems.find((item) => item.languageCode === 'zh-CN')?.textValue ??
    i18nItems[0]?.textValue;

  return {
    categoryId: input.typeId,
    categoryKey: category?.categoryKey,
    createdAt: toTimestampText(input.createdAt),
    currentI18n,
    defaultText,
    deletedAt: toTimestampText(input.deletedAt),
    description: currentI18n?.description,
    id: input.id,
    isBuiltin: true,
    isEnabled: input.isEnabled ?? true,
    itemsI18n: i18nItems,
    labelCode: input.entryValue,
    labelKey: input.entryValue,
    labelKind: deriveLabelKind(input.entryValue),
    payloadJson:
      input.numericValue === undefined ? undefined : String(input.numericValue),
    sortOrder: input.sortOrder,
    status: input.isEnabled === false ? 'OFF' : 'ON',
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    updatedAt: toTimestampText(input.updatedAt),
  };
}

function normalizeI18nItems(
  input: AdminDictLabelSaveInput,
): Record<string, dictservicev1_DictEntryI18n> | undefined {
  const items: Record<string, dictservicev1_DictEntryI18n> = {};

  const zhText = cleanText(input.textZh);
  if (zhText) {
    items['zh-CN'] = {
      description: cleanText(input.description),
      entryLabel: zhText,
      languageCode: 'zh-CN',
      languageName: '简体中文',
    };
  }

  const enText = cleanText(input.textEn);
  if (enText) {
    items['en-US'] = {
      description: cleanText(input.description),
      entryLabel: enText,
      languageCode: 'en-US',
      languageName: 'English',
    };
  }

  if (Object.keys(items).length > 0) {
    return items;
  }

  if (!input.i18nItems?.length) {
    return undefined;
  }

  for (const item of input.i18nItems) {
    const key = cleanText(item.languageCode);
    const label = cleanText(item.textValue);
    if (!key || !label) {
      continue;
    }
    items[key] = {
      description: cleanText(item.description),
      entryLabel: label,
      languageCode: key,
      languageName: cleanText(item.languageName),
    };
  }

  return Object.keys(items).length > 0 ? items : undefined;
}

function toDictTypeData(
  input: AdminDictCategorySaveInput,
): dictservicev1_DictType {
  return {
    isEnabled: input.isEnabled ?? true,
    sortOrder: input.sortOrder ?? 0,
    typeCode: cleanText(input.categoryKey),
    typeName: cleanText(input.categoryName),
  };
}

function toDictEntryData(
  input: AdminDictLabelSaveInput,
): dictservicev1_DictEntry {
  return {
    currentI18n: undefined,
    entryValue: cleanText(input.labelCode) ?? cleanText(input.labelKey),
    i18n: normalizeI18nItems(input),
    isEnabled: input.isEnabled ?? true,
    numericValue: undefined,
    sortOrder: input.sortOrder ?? 0,
    tenantId: undefined,
    tenantName: undefined,
    typeId: input.categoryId,
  };
}

export async function listAdminDictCategoriesApi(
  params: AdminDictCategoryListParams = {},
): Promise<AdminDictCategoryListResult> {
  const response = await getAdminList<dictservicev1_ListDictTypeResponse>(
    '/admin/v1/dict/types',
    toPagingRequest({
      conditions: [
        {
          field: 'type_code',
          op: 'CONTAINS',
          value: cleanText(params.categoryKey),
        },
        {
          field: 'type_name',
          op: 'CONTAINS',
          value: cleanText(params.categoryName),
        },
        {
          field: 'is_enabled',
          op: 'EQ',
          value:
            params.isEnabled === undefined
              ? undefined
              : Number(params.isEnabled),
        },
      ],
      page: params.page,
      pageSize: params.pageSize,
      sorting: params.sorting,
    }),
  );

  const items = (response.items ?? [])
    .map((item) => toAdminDictCategory(item))
    .filter((item) => {
      if (!params.scene) {
        return true;
      }
      return item.scene === params.scene;
    });

  return {
    items,
    total: params.scene ? items.length : toAdminTotal(response.total),
  };
}

export async function createAdminDictCategoryApi(
  input: AdminDictCategorySaveInput,
) {
  return await dictCategoryClient.Create({
    data: toDictTypeData(input),
  });
}

export async function updateAdminDictCategoryApi(
  id: number,
  input: AdminDictCategorySaveInput,
) {
  return await dictCategoryClient.Update({
    data: toDictTypeData(input),
    id,
    updateMask: ['typeCode', 'typeName', 'isEnabled', 'sortOrder'].join(','),
  });
}

export async function deleteAdminDictCategoryApi(id: number) {
  return await dictCategoryClient.Delete({ ids: [id] });
}

export async function listAdminDictLabelsApi(
  params: AdminDictLabelListParams = {},
): Promise<AdminDictLabelListResult> {
  const response = await getAdminList<dictservicev1_ListDictEntryResponse>(
    '/admin/v1/dict/entries',
    toPagingRequest({
      conditions: [
        {
          field: 'type_id',
          op: 'EQ',
          value: params.categoryId,
        },
        {
          field: 'entry_value',
          op: 'CONTAINS',
          value: cleanText(params.labelKey) ?? cleanText(params.labelCode),
        },
        {
          field: 'is_enabled',
          op: 'EQ',
          value:
            params.isEnabled === undefined
              ? undefined
              : Number(params.isEnabled),
        },
      ],
      page: params.page,
      pageSize: params.pageSize,
      sorting: params.sorting,
    }),
  );

  const categories = await listAdminDictCategoriesApi({
    page: 1,
    pageSize: 500,
  });
  const categoryMap = new Map(
    categories.items.map((item) => [item.id, item] as const),
  );

  return {
    items: (response.items ?? []).map((item) =>
      toAdminDictLabel(item, categoryMap.get(item.typeId)),
    ),
    total: toAdminTotal(response.total),
  };
}

export async function createAdminDictLabelApi(input: AdminDictLabelSaveInput) {
  return await dictLabelClient.Create({
    data: toDictEntryData(input),
  });
}

export async function updateAdminDictLabelApi(
  id: number,
  input: AdminDictLabelSaveInput,
) {
  return await dictLabelClient.Update({
    data: toDictEntryData(input),
    id,
    updateMask: ['typeId', 'entryValue', 'isEnabled', 'sortOrder', 'i18n'].join(
      ',',
    ),
  });
}

export async function deleteAdminDictLabelApi(id: number) {
  return await dictLabelClient.Delete({ ids: [id] });
}
