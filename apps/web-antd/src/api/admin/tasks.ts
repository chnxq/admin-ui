import type { AdminSorting } from './paging';

import type {
  taskservicev1_ListTaskGroupResponse,
  taskservicev1_ListTaskLogResponse,
  taskservicev1_ListTaskResponse,
  taskservicev1_Task,
  taskservicev1_Task_Status,
  taskservicev1_Task_TaskType,
  taskservicev1_TaskGroup,
  taskservicev1_TaskLog,
  taskservicev1_TaskLog_Status,
} from '#/api/generated/admin/service/v1';

import { taskClient, taskGroupClient, taskLogClient } from './clients';
import { getAdminList, toAdminTotal, toPagingRequest } from './paging';

export type AdminTask = taskservicev1_Task;
export type AdminTaskGroup = taskservicev1_TaskGroup;
export type AdminTaskLog = taskservicev1_TaskLog;
export type AdminTaskType = NonNullable<taskservicev1_Task_TaskType>;
export type AdminTaskStatus = NonNullable<taskservicev1_Task_Status>;
export type AdminTaskLogStatus = NonNullable<taskservicev1_TaskLog_Status>;

export interface AdminTaskListParams {
  groupId?: number;
  name?: string;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
  status?: AdminTaskStatus;
  taskType?: AdminTaskType;
}

export interface AdminTaskGroupListParams {
  page?: number;
  pageSize?: number;
}

export interface AdminTaskLogListParams {
  executeTimeEnd?: string;
  executeTimeStart?: string;
  page?: number;
  pageSize?: number;
  sorting?: AdminSorting[];
  status?: AdminTaskLogStatus;
  taskId?: number;
}

export interface AdminTaskListResult {
  items: AdminTask[];
  total: number;
}

export interface AdminTaskGroupListResult {
  items: AdminTaskGroup[];
  total: number;
}

export interface AdminTaskLogListResult {
  items: AdminTaskLog[];
  total: number;
}

export interface AdminTaskSaveInput {
  args?: string;
  concurrent?: boolean;
  cronExpression?: string;
  groupId?: number;
  invokeTarget?: string;
  remark?: string;
  retry?: number;
  status?: AdminTaskStatus;
  taskName?: string;
  taskType?: AdminTaskType;
}

export interface AdminTaskGroupSaveInput {
  groupName?: string;
  remark?: string;
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function toTaskData(input: AdminTaskSaveInput): AdminTask {
  return {
    args: cleanText(input.args),
    concurrent: input.concurrent ?? false,
    cronExpression: cleanText(input.cronExpression),
    groupId: input.groupId,
    invokeTarget: cleanText(input.invokeTarget),
    remark: cleanText(input.remark),
    retry: input.retry ?? 0,
    status: input.status ?? 'STOPPED',
    taskName: cleanText(input.taskName),
    taskType: input.taskType ?? 'FUNCTION',
  };
}

function toTaskGroupData(input: AdminTaskGroupSaveInput): AdminTaskGroup {
  return {
    groupName: cleanText(input.groupName),
    remark: cleanText(input.remark),
  };
}

export async function listAdminTasksApi(
  params: AdminTaskListParams = {},
): Promise<AdminTaskListResult> {
  const response = await getAdminList<taskservicev1_ListTaskResponse>(
    '/admin/v1/tasks',
    toPagingRequest({
      conditions: [
        { field: 'task_name', op: 'CONTAINS', value: cleanText(params.name) },
        { field: 'group_id', op: 'EQ', value: params.groupId },
        { field: 'status', op: 'EQ', value: params.status },
        { field: 'task_type', op: 'EQ', value: params.taskType },
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

export async function listAdminTaskGroupsApi(
  params: AdminTaskGroupListParams = {},
): Promise<AdminTaskGroupListResult> {
  const response = await getAdminList<taskservicev1_ListTaskGroupResponse>(
    '/admin/v1/task-groups',
    toPagingRequest({
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 200,
      sorting: [{ direction: 'ASC', field: 'id' }],
    }),
  );

  return {
    items: response.items ?? [],
    total: toAdminTotal(response.total),
  };
}

export async function listAdminTaskLogsApi(
  params: AdminTaskLogListParams = {},
): Promise<AdminTaskLogListResult> {
  const response = await getAdminList<taskservicev1_ListTaskLogResponse>(
    '/admin/v1/task-logs',
    toPagingRequest({
      conditions: [
        { field: 'execute_time', op: 'GTE', value: params.executeTimeStart },
        { field: 'execute_time', op: 'LTE', value: params.executeTimeEnd },
        { field: 'task_id', op: 'EQ', value: params.taskId },
        { field: 'status', op: 'EQ', value: params.status },
      ],
      page: params.page,
      pageSize: params.pageSize,
      sorting:
        params.sorting && params.sorting.length > 0
          ? params.sorting
          : [{ direction: 'DESC', field: 'execute_time' }],
    }),
  );

  return {
    items: response.items ?? [],
    total: toAdminTotal(response.total),
  };
}

export async function createAdminTaskApi(input: AdminTaskSaveInput) {
  return await taskClient.Create({
    data: toTaskData(input),
  });
}

export async function updateAdminTaskApi(
  id: number,
  input: AdminTaskSaveInput,
) {
  return await taskClient.Update({
    data: toTaskData(input),
    id,
    updateMask: [
      'taskName',
      'groupId',
      'taskType',
      'cronExpression',
      'invokeTarget',
      'args',
      'retry',
      'concurrent',
      'status',
      'remark',
    ].join(','),
  });
}

export async function deleteAdminTaskApi(id: number) {
  return await taskClient.Delete({ ids: [id] });
}

export async function startAdminTaskApi(id: number) {
  return await taskClient.Start({ id });
}

export async function stopAdminTaskApi(id: number) {
  return await taskClient.Stop({ id });
}

export async function runAdminTaskOnceApi(id: number, input?: string) {
  return await taskClient.RunOnce({ id, input: cleanText(input) });
}

export async function createAdminTaskGroupApi(input: AdminTaskGroupSaveInput) {
  return await taskGroupClient.Create({
    data: toTaskGroupData(input),
  });
}

export async function updateAdminTaskGroupApi(
  id: number,
  input: AdminTaskGroupSaveInput,
) {
  return await taskGroupClient.Update({
    data: toTaskGroupData(input),
    id,
    updateMask: ['groupName', 'remark'].join(','),
  });
}

export async function deleteAdminTaskGroupApi(id: number) {
  return await taskGroupClient.Delete({ ids: [id] });
}

export async function startAdminTaskGroupApi(id: number) {
  return await taskGroupClient.Start({ id });
}

export async function stopAdminTaskGroupApi(id: number) {
  return await taskGroupClient.Stop({ id });
}

export async function runAdminTaskGroupOnceApi(id: number, input?: string) {
  return await taskGroupClient.RunOnce({ id, input: cleanText(input) });
}

export async function deleteAdminTaskLogApi(id: number) {
  return await taskLogClient.Delete({ ids: [id] });
}
