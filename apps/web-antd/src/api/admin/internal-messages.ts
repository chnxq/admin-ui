import type { AdminSorting } from './paging';

import type {
  internal_messageservicev1_InternalMessage,
  internal_messageservicev1_InternalMessage_Status,
  internal_messageservicev1_InternalMessage_Type,
  internal_messageservicev1_InternalMessageRecipient,
  internal_messageservicev1_SendMessageResponse,
} from '#/api/generated/admin/service/v1';

import {
  internalMessageClient,
  internalMessageRecipientClient,
} from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminInboxMessage =
  internal_messageservicev1_InternalMessageRecipient;
export type AdminInternalMessage = internal_messageservicev1_InternalMessage;
export type AdminInternalMessageStatus =
  internal_messageservicev1_InternalMessage_Status;
export type AdminInternalMessageType =
  internal_messageservicev1_InternalMessage_Type;

export interface AdminInboxListParams {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
}

export interface AdminInboxListResult {
  items: AdminInboxMessage[];
  total: number;
}

export interface AdminInternalMessageListParams {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
}

export interface AdminInternalMessageListResult {
  items: AdminInternalMessage[];
  total: number;
}

export interface AdminSendInternalMessageInput {
  content: string;
  targetAll?: boolean;
  targetUserIds?: number[];
  title: string;
  type: AdminInternalMessageType;
}

function toTotal(value?: number) {
  if (typeof value !== 'number') {
    return 0;
  }
  return Number.isFinite(value) ? value : 0;
}

export async function listAdminInboxMessagesApi(
  params: AdminInboxListParams = {},
): Promise<AdminInboxListResult> {
  const response = await internalMessageRecipientClient.ListUserInbox(
    toPagingRequest({
      page: params.page,
      pageSize: params.pageSize ?? params.limit ?? 20,
      sorting: params.sorting,
    }),
  );
  return {
    items: response.items ?? [],
    total: toTotal(response.total),
  };
}

export async function listAdminInternalMessagesApi(
  params: AdminInternalMessageListParams = {},
): Promise<AdminInternalMessageListResult> {
  const response = await getAdminList<{
    items?: internal_messageservicev1_InternalMessage[];
    total?: number | string;
  }>(
    '/admin/v1/internal-message/messages',
    toPagingRequest({
      page: params.page,
      pageSize: params.pageSize ?? params.limit ?? 20,
      sorting: params.sorting,
    }),
  );
  return {
    items: response.items ?? [],
    total: toAdminTotal(response.total),
  };
}

export async function sendAdminInternalMessageApi(
  input: AdminSendInternalMessageInput,
): Promise<internal_messageservicev1_SendMessageResponse> {
  return await internalMessageClient.SendMessage({
    content: input.content,
    targetAll: input.targetAll ?? false,
    targetUserIds: input.targetUserIds ?? [],
    title: input.title,
    type: input.type,
  });
}

export async function revokeAdminInternalMessageApi(messageId: number) {
  await internalMessageClient.RevokeMessage({
    messageId,
    userId: 0,
  });
}

export async function markAdminInboxMessagesReadApi(
  recipientIds: number[],
): Promise<void> {
  await internalMessageRecipientClient.MarkNotificationAsRead({
    recipientIds,
    userId: 0,
  });
}

export async function deleteAdminInboxMessagesApi(
  recipientIds: number[],
): Promise<void> {
  await internalMessageRecipientClient.DeleteNotificationFromInbox({
    recipientIds,
    userId: 0,
  });
}
