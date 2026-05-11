import type {
  internal_messageservicev1_InternalMessage,
  internal_messageservicev1_InternalMessage_Status,
  internal_messageservicev1_InternalMessage_Type,
  internal_messageservicev1_InternalMessageRecipient,
  internal_messageservicev1_SendMessageResponse,
  pagination_PagingRequest,
} from '#/api/generated/admin/service/v1';

import {
  internalMessageClient,
  internalMessageRecipientClient,
} from './clients';

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

function toPagingRequest(
  params: AdminInboxListParams = {},
): pagination_PagingRequest {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? params.limit ?? 20;
  return {
    limit: params.limit ?? pageSize,
    offset: params.offset ?? (page - 1) * pageSize,
    page,
    pageSize,
    sorting: [],
  };
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
    toPagingRequest(params),
  );
  return {
    items: response.items ?? [],
    total: toTotal(response.total),
  };
}

export async function listAdminInternalMessagesApi(
  params: AdminInternalMessageListParams = {},
): Promise<AdminInternalMessageListResult> {
  const response = await internalMessageClient.ListMessage(
    toPagingRequest(params),
  );
  return {
    items: response.items ?? [],
    total: toTotal(response.total),
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
