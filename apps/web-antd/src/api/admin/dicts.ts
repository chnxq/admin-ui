import type { AdminSorting } from './paging';

import type {
  dictservicev1_DictCategory,
  dictservicev1_DictLabel,
  dictservicev1_DictLabelI18n,
  dictservicev1_ListDictCategoryResponse,
  dictservicev1_ListDictLabelResponse,
} from '#/api/generated/admin/service/v1';

import { dictCategoryClient, dictLabelClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminDictCategory = dictservicev1_DictCategory;
export type AdminDictLabel = dictservicev1_DictLabel;
export type AdminDictLabelI18n = dictservicev1_DictLabelI18n;

export type AdminDictCategoryLevel =
  dictservicev1_DictCategory['categoryLevel'];
export type AdminDictCategoryScene = dictservicev1_DictCategory['scene'];
export type AdminDictLabelKind = dictservicev1_DictLabel['labelKind'];
export type AdminDictLabelStatus = dictservicev1_DictLabel['status'];

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

function normalizePayloadJson(value?: string) {
  const text = cleanText(value);
  return text || undefined;
}

function normalizeI18nItems(
  input: AdminDictLabelSaveInput,
): AdminDictLabelI18n[] | undefined {
  const items: AdminDictLabelI18n[] = [];

  const zhText = cleanText(input.textZh);
  const zhShortText = cleanText(input.shortTextZh);
  if (zhText || zhShortText) {
    items.push({
      description: cleanText(input.description),
      languageCode: 'zh-CN',
      languageName: '简体中文',
      shortText: zhShortText,
      textValue: zhText,
    });
  }

  const enText = cleanText(input.textEn);
  const enShortText = cleanText(input.shortTextEn);
  if (enText || enShortText) {
    items.push({
      description: cleanText(input.description),
      languageCode: 'en-US',
      languageName: 'English',
      shortText: enShortText,
      textValue: enText,
    });
  }

  if (items.length > 0) {
    return items;
  }
  return input.i18nItems?.length ? input.i18nItems : undefined;
}

function toDictCategoryData(
  input: AdminDictCategorySaveInput,
): AdminDictCategory {
  return {
    categoryKey: cleanText(input.categoryKey),
    categoryLevel: input.categoryLevel,
    categoryName: cleanText(input.categoryName),
    children: undefined,
    description: cleanText(input.description),
    isBuiltin: input.isBuiltin ?? true,
    isEnabled: input.isEnabled ?? true,
    parentId: input.parentId,
    scene: input.scene,
    sortOrder: input.sortOrder ?? 0,
  };
}

function toDictLabelData(input: AdminDictLabelSaveInput): AdminDictLabel {
  return {
    categoryId: input.categoryId,
    defaultText: cleanText(input.defaultText),
    description: cleanText(input.description),
    isBuiltin: input.isBuiltin ?? true,
    isEnabled: input.isEnabled ?? true,
    itemsI18n: normalizeI18nItems(input),
    labelCode: cleanText(input.labelCode),
    labelKey: cleanText(input.labelKey),
    labelKind: input.labelKind,
    payloadJson: normalizePayloadJson(input.payloadJson),
    sortOrder: input.sortOrder ?? 0,
    status: input.status,
  };
}

export async function listAdminDictCategoriesApi(
  params: AdminDictCategoryListParams = {},
): Promise<AdminDictCategoryListResult> {
  const response = await getAdminList<dictservicev1_ListDictCategoryResponse>(
    '/admin/v1/dict/categories',
    toPagingRequest({
      conditions: [
        {
          field: 'category_key',
          op: 'CONTAINS',
          value: cleanText(params.categoryKey),
        },
        {
          field: 'category_name',
          op: 'CONTAINS',
          value: cleanText(params.categoryName),
        },
        {
          field: 'scene',
          op: 'EQ',
          value: cleanText(params.scene),
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

  return {
    items: response.items ?? [],
    total: toAdminTotal(response.total),
  };
}

export async function createAdminDictCategoryApi(
  input: AdminDictCategorySaveInput,
) {
  return await dictCategoryClient.Create({
    data: toDictCategoryData(input),
  });
}

export async function updateAdminDictCategoryApi(
  id: number,
  input: AdminDictCategorySaveInput,
) {
  return await dictCategoryClient.Update({
    data: toDictCategoryData(input),
    id,
    updateMask: [
      'parentId',
      'categoryKey',
      'categoryName',
      'categoryLevel',
      'scene',
      'isBuiltin',
      'isEnabled',
      'sortOrder',
      'description',
    ].join(','),
  });
}

export async function deleteAdminDictCategoryApi(id: number) {
  return await dictCategoryClient.Delete({ ids: [id] });
}

export async function listAdminDictLabelsApi(
  params: AdminDictLabelListParams = {},
): Promise<AdminDictLabelListResult> {
  const response = await getAdminList<dictservicev1_ListDictLabelResponse>(
    '/admin/v1/dict/labels',
    toPagingRequest({
      conditions: [
        {
          field: 'category_id',
          op: 'EQ',
          value: params.categoryId,
        },
        {
          field: 'label_key',
          op: 'CONTAINS',
          value: cleanText(params.labelKey),
        },
        {
          field: 'label_code',
          op: 'CONTAINS',
          value: cleanText(params.labelCode),
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

  return {
    items: response.items ?? [],
    total: toAdminTotal(response.total),
  };
}

export async function createAdminDictLabelApi(input: AdminDictLabelSaveInput) {
  return await dictLabelClient.Create({
    data: toDictLabelData(input),
  });
}

export async function updateAdminDictLabelApi(
  id: number,
  input: AdminDictLabelSaveInput,
) {
  return await dictLabelClient.Update({
    data: toDictLabelData(input),
    id,
    updateMask: [
      'categoryId',
      'labelKey',
      'labelCode',
      'labelKind',
      'defaultText',
      'payloadJson',
      'isBuiltin',
      'isEnabled',
      'status',
      'sortOrder',
      'description',
      'itemsI18n',
    ].join(','),
  });
}

export async function deleteAdminDictLabelApi(id: number) {
  return await dictLabelClient.Delete({ ids: [id] });
}
