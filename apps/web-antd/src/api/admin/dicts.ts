import type { AdminSorting } from './paging';

import type {
  dictservicev1_DictCategory,
  dictservicev1_DictCategory_CategoryLevel,
  dictservicev1_DictCategory_Scene,
  dictservicev1_DictLabel,
  dictservicev1_DictLabel_LabelKind,
  dictservicev1_DictLabel_Status,
  dictservicev1_DictLabelI18n,
  dictservicev1_ListDictCategoryResponse,
  dictservicev1_ListDictLabelResponse,
} from '#/api/generated/admin/service/v1';

import { dictCategoryClient, dictLabelClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminDictCategoryLevel = Exclude<
  dictservicev1_DictCategory_CategoryLevel,
  'CATEGORY_LEVEL_UNSPECIFIED'
>;
export type AdminDictCategoryScene = Exclude<
  dictservicev1_DictCategory_Scene,
  'SCENE_UNSPECIFIED'
>;
export type AdminDictLabelKind = Exclude<
  dictservicev1_DictLabel_LabelKind,
  'LABEL_KIND_UNSPECIFIED'
>;
export type AdminDictLabelStatus = Exclude<
  dictservicev1_DictLabel_Status,
  'STATUS_UNSPECIFIED'
>;

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

function normalizeCategoryLevel(
  level?: dictservicev1_DictCategory_CategoryLevel,
): AdminDictCategoryLevel | undefined {
  if (!level || level === 'CATEGORY_LEVEL_UNSPECIFIED') {
    return undefined;
  }
  return level;
}

function normalizeCategoryScene(
  scene?: dictservicev1_DictCategory_Scene,
): AdminDictCategoryScene | undefined {
  if (!scene || scene === 'SCENE_UNSPECIFIED') {
    return undefined;
  }
  return scene;
}

function normalizeLabelKind(
  kind?: dictservicev1_DictLabel_LabelKind,
): AdminDictLabelKind | undefined {
  if (!kind || kind === 'LABEL_KIND_UNSPECIFIED') {
    return undefined;
  }
  return kind;
}

function normalizeLabelStatus(
  status?: dictservicev1_DictLabel_Status,
): AdminDictLabelStatus | undefined {
  if (!status || status === 'STATUS_UNSPECIFIED') {
    return undefined;
  }
  return status;
}

function toAdminDictLabelI18n(
  input?: dictservicev1_DictLabelI18n,
): AdminDictLabelI18n | undefined {
  if (!input) {
    return undefined;
  }
  return {
    description: input.description,
    languageCode: input.languageCode,
    languageName: input.languageName,
    shortText: input.shortText,
    textValue: input.textValue,
  };
}

function toAdminDictCategory(
  input: dictservicev1_DictCategory,
): AdminDictCategory {
  return {
    categoryKey: input.categoryKey,
    categoryLevel: normalizeCategoryLevel(input.categoryLevel),
    categoryName: input.categoryName,
    children: (input.children ?? []).map((item) => toAdminDictCategory(item)),
    createdAt: toTimestampText(input.createdAt),
    deletedAt: toTimestampText(input.deletedAt),
    description: input.description,
    id: input.id,
    isBuiltin: input.isBuiltin,
    isEnabled: input.isEnabled,
    parentId: input.parentId,
    scene: normalizeCategoryScene(input.scene),
    sortOrder: input.sortOrder,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    updatedAt: toTimestampText(input.updatedAt),
  };
}

function toAdminDictLabel(
  input: dictservicev1_DictLabel,
  category?: AdminDictCategory,
): AdminDictLabel {
  const itemsI18n = (input.itemsI18n ?? [])
    .map((item) => toAdminDictLabelI18n(item))
    .filter((item): item is AdminDictLabelI18n => item !== undefined);
  const currentI18n = toAdminDictLabelI18n(input.currentI18n);
  const defaultText =
    input.defaultText ||
    currentI18n?.textValue ||
    itemsI18n.find((item) => item.languageCode === 'zh-CN')?.textValue ||
    itemsI18n[0]?.textValue;

  return {
    categoryId: input.categoryId,
    categoryKey: category?.categoryKey,
    createdAt: toTimestampText(input.createdAt),
    currentI18n,
    defaultText,
    deletedAt: toTimestampText(input.deletedAt),
    description: input.description,
    id: input.id,
    isBuiltin: input.isBuiltin,
    isEnabled: input.isEnabled,
    itemsI18n,
    labelCode: input.labelCode,
    labelKey: input.labelKey,
    labelKind: normalizeLabelKind(input.labelKind),
    payloadJson: input.payloadJson,
    sortOrder: input.sortOrder,
    status: normalizeLabelStatus(input.status),
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    updatedAt: toTimestampText(input.updatedAt),
  };
}

function normalizeI18nItems(
  input: AdminDictLabelSaveInput,
): dictservicev1_DictLabelI18n[] | undefined {
  const items = new Map<string, dictservicev1_DictLabelI18n>();

  const zhText = cleanText(input.textZh);
  if (zhText) {
    items.set('zh-CN', {
      description: cleanText(input.description),
      languageCode: 'zh-CN',
      languageName: '简体中文',
      shortText: cleanText(input.shortTextZh),
      textValue: zhText,
    });
  }

  const enText = cleanText(input.textEn);
  if (enText) {
    items.set('en-US', {
      description: cleanText(input.description),
      languageCode: 'en-US',
      languageName: 'English',
      shortText: cleanText(input.shortTextEn),
      textValue: enText,
    });
  }

  for (const item of input.i18nItems ?? []) {
    const key = cleanText(item.languageCode);
    const textValue = cleanText(item.textValue);
    if (!key || !textValue) {
      continue;
    }
    items.set(key, {
      description: cleanText(item.description),
      languageCode: key,
      languageName: cleanText(item.languageName),
      shortText: cleanText(item.shortText),
      textValue,
    });
  }

  return items.size > 0 ? [...items.values()] : undefined;
}

function toDictCategoryData(
  input: AdminDictCategorySaveInput,
): dictservicev1_DictCategory {
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

function toDictLabelData(
  input: AdminDictLabelSaveInput,
): dictservicev1_DictLabel {
  const itemsI18n = normalizeI18nItems(input);

  return {
    categoryId: input.categoryId,
    currentI18n: undefined,
    defaultText:
      cleanText(input.defaultText) ??
      cleanText(input.textZh) ??
      cleanText(input.textEn),
    description: cleanText(input.description),
    isBuiltin: input.isBuiltin ?? true,
    isEnabled: input.isEnabled ?? true,
    itemsI18n,
    labelCode: cleanText(input.labelCode),
    labelKey: cleanText(input.labelKey),
    labelKind: input.labelKind,
    payloadJson: cleanText(input.payloadJson),
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? (input.isEnabled === false ? 'OFF' : 'ON'),
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
          value: params.scene,
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
    items: (response.items ?? []).map((item) => toAdminDictCategory(item)),
    total: toAdminTotal(response.total),
  };
}

export async function createAdminDictCategoryApi(
  input: AdminDictCategorySaveInput,
): Promise<void> {
  await dictCategoryClient.Create({
    data: toDictCategoryData(input),
  });
}

export async function updateAdminDictCategoryApi(
  id: number,
  input: AdminDictCategorySaveInput,
): Promise<void> {
  await dictCategoryClient.Update({
    data: toDictCategoryData(input),
    id,
    updateMask: [
      'categoryKey',
      'categoryLevel',
      'categoryName',
      'description',
      'isBuiltin',
      'isEnabled',
      'parentId',
      'scene',
      'sortOrder',
    ].join(','),
  });
}

export async function deleteAdminDictCategoryApi(id: number): Promise<void> {
  await dictCategoryClient.Delete({ ids: [id] });
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

  const categories = await listAdminDictCategoriesApi({
    page: 1,
    pageSize: 500,
  });
  const categoryMap = new Map(
    categories.items.map((item) => [item.id, item] as const),
  );

  return {
    items: (response.items ?? []).map((item) =>
      toAdminDictLabel(item, categoryMap.get(item.categoryId)),
    ),
    total: toAdminTotal(response.total),
  };
}

export async function createAdminDictLabelApi(
  input: AdminDictLabelSaveInput,
): Promise<void> {
  await dictLabelClient.Create({
    data: toDictLabelData(input),
  });
}

export async function updateAdminDictLabelApi(
  id: number,
  input: AdminDictLabelSaveInput,
): Promise<void> {
  await dictLabelClient.Update({
    data: toDictLabelData(input),
    id,
    updateMask: [
      'categoryId',
      'defaultText',
      'description',
      'isBuiltin',
      'isEnabled',
      'itemsI18n',
      'labelCode',
      'labelKey',
      'labelKind',
      'payloadJson',
      'sortOrder',
      'status',
    ].join(','),
  });
}

export async function deleteAdminDictLabelApi(id: number): Promise<void> {
  await dictLabelClient.Delete({ ids: [id] });
}
