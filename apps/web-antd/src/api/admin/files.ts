import type { AdminSorting } from './paging';

import type {
  pagination_PagingRequest,
  storageservicev1_File,
  storageservicev1_ListFileResponse,
} from '#/api/generated/admin/service/v1';

import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

import { fileClient } from './clients';
import {
  getAdminList,
  toAdminTotal,
  toPagingRequest,
  unwrapAdminEnvelope,
} from './paging';

export type AdminFile = storageservicev1_File;

export interface AdminFileBrowserInfo {
  bucketName: string;
  downloadUrl: string;
  extension: string;
  fileDirectory: string;
  fileName: string;
  id: number;
  objectName: string;
  previewType: string;
  previewUrl: string;
  size: number;
  sizeFormat: string;
  tenantId?: number;
  tenantName?: string;
}

export interface AdminFileListParams {
  bucketName?: string;
  extension?: string;
  fileDirectory?: string;
  fileName?: string;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
  tenantId?: number;
}

export interface AdminFileListResult {
  items: AdminFile[];
  total: number;
}

export interface AdminFileUploadInput {
  bucketName?: string;
  file: File;
  folder?: string;
}

export interface AdminFileContentResult {
  blob: Blob;
  contentType: string;
  fileName?: string;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function buildAuthHeaders(extraHeaders: HeadersInit = {}) {
  const accessStore = useAccessStore();
  const headers = new Headers(extraHeaders);
  if (accessStore.accessToken) {
    headers.set('Authorization', `Bearer ${accessStore.accessToken}`);
  }
  headers.set('Accept-Language', navigator.language);
  return headers;
}

function buildAdminFileApiPath(id: number, action: 'download' | 'preview') {
  return `/api/admin/v1/files/${id}/${action}`;
}

function parseContentDispositionFileName(value: null | string) {
  if (!value) {
    return undefined;
  }
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const plainMatch = value.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1];
}

function buildFilePagingRequest(
  params: AdminFileListParams = {},
): pagination_PagingRequest {
  return toPagingRequest({
    conditions: [
      {
        field: 'bucket_name',
        op: 'CONTAINS',
        value: cleanText(params.bucketName),
      },
      {
        field: 'file_directory',
        op: 'CONTAINS',
        value: cleanText(params.fileDirectory),
      },
      {
        field: 'file_name',
        op: 'CONTAINS',
        value: cleanText(params.fileName),
      },
      {
        field: 'extension',
        op: 'EQ',
        value: cleanText(params.extension),
      },
      {
        field: 'tenant_id',
        op: 'EQ',
        value: params.tenantId,
      },
    ],
    page: params.page,
    pageSize: params.pageSize,
    sorting:
      params.sorting && params.sorting.length > 0
        ? params.sorting
        : [
            { direction: 'DESC', field: 'created_at' },
            { direction: 'DESC', field: 'id' },
          ],
  });
}

export async function listAdminFilesApi(
  params: AdminFileListParams = {},
): Promise<AdminFileListResult> {
  const response = await getAdminList<storageservicev1_ListFileResponse>(
    '/admin/v1/files',
    buildFilePagingRequest(params),
  );

  return {
    items: response.items ?? [],
    total: toAdminTotal(response.total),
  };
}

export async function getAdminFileBrowserInfoApi(id: number) {
  const response = await requestClient.request<unknown>(
    `/admin/v1/files/${id}/browser`,
    {
      method: 'GET',
      responseReturn: 'body',
    },
  );
  return unwrapAdminEnvelope<AdminFileBrowserInfo>(response);
}

export async function uploadAdminFileApi(input: AdminFileUploadInput) {
  const formData = new FormData();
  formData.append('file', input.file);
  if (input.folder?.trim()) {
    formData.append('folder', input.folder.trim());
  }
  if (input.bucketName?.trim()) {
    formData.append('bucketName', input.bucketName.trim());
  }

  const response = await fetch('/api/admin/v1/files/upload-multipart', {
    body: formData,
    headers: buildAuthHeaders(),
    method: 'POST',
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || 'upload failed');
  }
  return unwrapAdminEnvelope<AdminFileBrowserInfo>(payload);
}

export async function deleteAdminFileBinaryApi(id: number) {
  const response = await requestClient.request<unknown>(
    `/admin/v1/files/${id}/binary`,
    {
      method: 'DELETE',
      responseReturn: 'body',
    },
  );
  await unwrapAdminEnvelope(response);
}

export async function deleteAdminFileMetadataApi(id: number) {
  await fileClient.Delete({ id });
}

export function buildAdminFilePreviewUrl(id: number) {
  return buildAdminFileApiPath(id, 'preview');
}

export function buildAdminFileDownloadUrl(id: number) {
  return buildAdminFileApiPath(id, 'download');
}

export async function fetchAdminFilePreviewTextApi(id: number) {
  const response = await fetch(buildAdminFilePreviewUrl(id), {
    headers: buildAuthHeaders({ Accept: 'text/plain' }),
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error('failed to load preview');
  }
  return await response.text();
}

export async function fetchAdminFileContentApi(
  id: number,
  action: 'download' | 'preview',
): Promise<AdminFileContentResult> {
  const response = await fetch(buildAdminFileApiPath(id, action), {
    headers: buildAuthHeaders(),
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`failed to ${action} file`);
  }
  return {
    blob: await response.blob(),
    contentType: response.headers.get('Content-Type') || '',
    fileName: parseContentDispositionFileName(
      response.headers.get('Content-Disposition'),
    ),
  };
}
