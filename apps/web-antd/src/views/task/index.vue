<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TableColumnType,
  TablePaginationConfig,
} from 'ant-design-vue';

import type {
  AdminTask,
  AdminTaskGroup,
  AdminTaskGroupSaveInput,
  AdminTaskSaveInput,
  AdminTaskStatus,
  AdminTaskType,
} from '#/api/admin/tasks';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, reactive, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Menu,
  message,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  createAdminTaskApi,
  createAdminTaskGroupApi,
  deleteAdminTaskApi,
  deleteAdminTaskGroupApi,
  listAdminTaskGroupsApi,
  listAdminTasksApi,
  runAdminTaskGroupOnceApi,
  runAdminTaskOnceApi,
  startAdminTaskApi,
  startAdminTaskGroupApi,
  stopAdminTaskApi,
  stopAdminTaskGroupApi,
  updateAdminTaskApi,
  updateAdminTaskGroupApi,
} from '#/api/admin/tasks';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface TaskFormModel extends AdminTaskSaveInput {
  args: string;
  concurrent: boolean;
  cronExpression: string;
  invokeTarget: string;
  remark: string;
  retry: number;
  status: AdminTaskStatus;
  taskName: string;
  taskType: AdminTaskType;
}

interface GroupFormModel extends AdminTaskGroupSaveInput {
  groupName: string;
  remark: string;
}

interface TaskSearchFormModel {
  name: string;
  status?: AdminTaskStatus;
  taskType?: AdminTaskType;
}

type AdminTaskTableChangeSorter =
  | Parameters<NonNullable<InstanceType<typeof Table>['$props']['onChange']>>[2]
  | TableColumnType<AdminTask>['sorter'];

const TASK_ACCESS = {
  create: ['tasks:create'],
  delete: ['tasks:delete'],
  edit: ['tasks:edit'],
  export: ['tasks:export'],
  groupCreate: ['task:groups:create'],
  groupDelete: ['task:groups:delete'],
  groupEdit: ['task:groups:edit'],
  groupRunOnce: ['task:groups:run:once'],
  groupStart: ['task:groups:start'],
  groupStop: ['task:groups:stop'],
  runOnce: ['tasks:run:once'],
  start: ['tasks:start'],
  stop: ['tasks:stop'],
} as const;

const { hasAccessByCodes } = useAccess();

const groupLoading = ref(false);
const taskLoading = ref(false);
const taskModalOpen = ref(false);
const groupModalOpen = ref(false);
const taskSubmitting = ref(false);
const groupSubmitting = ref(false);
const editingTaskId = ref<number>();
const editingGroupId = ref<number>();
const selectedGroupId = ref<number>();
const taskTableSurfaceRef = ref<HTMLElement>();
const taskFormRef = ref<FormInstance>();
const groupFormRef = ref<FormInstance>();
const groups = ref<AdminTaskGroup[]>([]);
const taskRows = ref<AdminTask[]>([]);
const taskSorting = ref<AdminTableSorting[]>([
  { direction: 'DESC', field: 'updated_at' },
]);
const taskPagination = reactive<TablePaginationConfig>({
  current: 1,
  pageSize: 10,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number) => `${$t('page.task.total')} ${total} 条`,
  total: 0,
});
const taskSearchForm = reactive<TaskSearchFormModel>({
  name: '',
  status: undefined,
  taskType: undefined,
});

const statusOptions: Array<{ label: string; value: AdminTaskStatus }> = [
  { label: $t('page.task.statusStopped'), value: 'STOPPED' },
  { label: $t('page.task.statusRunning'), value: 'RUNNING' },
  { label: $t('page.task.statusDisabled'), value: 'DISABLED' },
];

const typeOptions: Array<{ label: string; value: AdminTaskType }> = [
  { label: $t('page.task.typeFunction'), value: 'FUNCTION' },
  { label: $t('page.task.typeApi'), value: 'API' },
  { label: $t('page.task.typeExternal'), value: 'EXTERNAL' },
];

const taskFormModel = reactive<TaskFormModel>({
  args: '',
  concurrent: false,
  cronExpression: '',
  groupId: undefined,
  invokeTarget: '',
  remark: '',
  retry: 0,
  status: 'STOPPED',
  taskName: '',
  taskType: 'FUNCTION',
});

const groupFormModel = reactive<GroupFormModel>({
  groupName: '',
  remark: '',
});

const selectedGroup = computed(() =>
  groups.value.find((item) => item.id === selectedGroupId.value),
);

const selectedGroupLabel = computed(
  () => selectedGroup.value?.groupName || $t('page.task.allGroups'),
);

const taskGroupOptions = computed(() =>
  groups.value
    .filter((item) => typeof item.id === 'number')
    .map((item) => ({
      label: item.groupName || '-',
      value: item.id as number,
    })),
);

const taskModalTitle = computed(() =>
  editingTaskId.value
    ? $t('page.task.editTaskTitle')
    : $t('page.task.createTaskTitle'),
);

const groupModalTitle = computed(() =>
  editingGroupId.value
    ? $t('page.task.editGroupTitle')
    : $t('page.task.createGroupTitle'),
);

const groupColumns: TableColumnsType<AdminTaskGroup> = [
  {
    key: 'selected',
    width: 52,
  },
  {
    dataIndex: 'groupName',
    key: 'groupName',
    title: $t('page.task.groupName'),
  },
  {
    key: 'action',
    title: $t('ui.table.action'),
    width: 88,
    align: 'center',
  },
];

function formatGroupTenantLabel(group: AdminTaskGroup) {
  const tenantId = group.tenantId;
  if (!tenantId) {
    return $t('page.task.platformOwner');
  }
  return `${$t('page.task.tenantPrefix')} #${tenantId}`;
}

function getStatusText(status?: AdminTaskStatus) {
  switch (status) {
    case 'DISABLED': {
      return $t('page.task.statusDisabled');
    }
    case 'RUNNING': {
      return $t('page.task.statusRunning');
    }
    case 'STOPPED': {
      return $t('page.task.statusStopped');
    }
    default: {
      return $t('page.task.statusUnspecified');
    }
  }
}

function getStatusColor(status?: AdminTaskStatus) {
  switch (status) {
    case 'DISABLED': {
      return 'warning';
    }
    case 'RUNNING': {
      return 'processing';
    }
    case 'STOPPED': {
      return 'default';
    }
    default: {
      return 'default';
    }
  }
}

function getTaskTypeText(value?: AdminTaskType) {
  switch (value) {
    case 'API': {
      return $t('page.task.typeApi');
    }
    case 'EXTERNAL': {
      return $t('page.task.typeExternal');
    }
    case 'FUNCTION': {
      return $t('page.task.typeFunction');
    }
    default: {
      return $t('page.task.typeUnspecified');
    }
  }
}

const taskColumns: AdminTableColumn<AdminTask>[] = [
  {
    key: 'taskName',
    sortField: 'task_name',
    sortable: true,
    sorter: true,
    title: $t('page.task.taskName'),
    width: 180,
  },
  {
    key: 'taskType',
    sortField: 'task_type',
    sortable: true,
    sorter: true,
    title: $t('page.task.taskType'),
    width: 120,
  },
  {
    key: 'cronExpression',
    sortField: 'cron_expression',
    sortable: true,
    sorter: true,
    title: $t('page.task.cronExpression'),
    width: 220,
  },
  {
    key: 'invokeTarget',
    sortField: 'invoke_target',
    sortable: true,
    sorter: true,
    title: $t('page.task.invokeTarget'),
    width: 240,
  },
  {
    key: 'retry',
    sortField: 'retry',
    sortable: true,
    sorter: true,
    title: $t('page.task.retry'),
    width: 90,
  },
  {
    key: 'concurrent',
    sortField: 'concurrent',
    sortable: true,
    sorter: true,
    title: $t('page.task.concurrent'),
    width: 100,
  },
  {
    key: 'status',
    sortField: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.task.status'),
    width: 110,
  },
  {
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    title: $t('page.task.updatedAt'),
    width: 170,
  },
  {
    alwaysVisible: true,
    exportDisabled: true,
    key: 'action',
    title: $t('ui.table.action'),
    width: 300,
  },
];

const visibleTaskColumnKeys = ref<string[]>(
  getDefaultVisibleColumnKeys(taskColumns).filter(
    (key): key is string => typeof key === 'string',
  ),
);

const displayTaskColumns = computed(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(taskColumns, taskSorting.value),
    visibleTaskColumnKeys.value,
  ),
);

function resetTaskForm() {
  editingTaskId.value = undefined;
  Object.assign(taskFormModel, {
    args: '',
    concurrent: false,
    cronExpression: '',
    groupId: selectedGroupId.value,
    invokeTarget: '',
    remark: '',
    retry: 0,
    status: 'STOPPED',
    taskName: '',
    taskType: 'FUNCTION',
  });
}

function resetGroupForm() {
  editingGroupId.value = undefined;
  Object.assign(groupFormModel, {
    groupName: '',
    remark: '',
  });
}

async function loadGroups() {
  groupLoading.value = true;
  try {
    const response = await listAdminTaskGroupsApi();
    groups.value = response.items;
    if (
      selectedGroupId.value !== undefined &&
      !groups.value.some((item) => item.id === selectedGroupId.value)
    ) {
      selectedGroupId.value = undefined;
    }
    if (selectedGroupId.value === undefined && groups.value.length > 0) {
      selectedGroupId.value = groups.value[0]?.id;
    }
  } catch (error) {
    message.error((error as Error).message || $t('page.task.loadGroupsFailed'));
  } finally {
    groupLoading.value = false;
  }
}

async function handleSelectGroup(group?: AdminTaskGroup) {
  selectedGroupId.value = group?.id;
  taskPagination.current = 1;
  await loadTasks();
}

function handleOpenCreateGroup() {
  resetGroupForm();
  groupModalOpen.value = true;
}

function handleOpenEditGroup(group: AdminTaskGroup) {
  editingGroupId.value = group.id;
  Object.assign(groupFormModel, {
    groupName: group.groupName || '',
    remark: group.remark || '',
  });
  groupModalOpen.value = true;
}

async function handleSubmitGroup() {
  await groupFormRef.value?.validate();
  groupSubmitting.value = true;
  try {
    if (editingGroupId.value) {
      await updateAdminTaskGroupApi(editingGroupId.value, groupFormModel);
      message.success($t('page.task.groupUpdateSuccess'));
    } else {
      await createAdminTaskGroupApi(groupFormModel);
      message.success($t('page.task.groupCreateSuccess'));
    }
    groupModalOpen.value = false;
    await loadGroups();
    await loadTasks();
  } catch (error) {
    message.error(
      (error as Error).message || $t('page.task.groupSubmitFailed'),
    );
  } finally {
    groupSubmitting.value = false;
  }
}

async function handleDeleteGroup(group: AdminTaskGroup) {
  if (!group.id) {
    return;
  }
  await deleteAdminTaskGroupApi(group.id);
  message.success($t('page.task.groupDeleteSuccess'));
  if (selectedGroupId.value === group.id) {
    selectedGroupId.value = undefined;
  }
  await loadGroups();
  await loadTasks();
}

async function handleGroupStart(group: AdminTaskGroup) {
  if (!group.id) {
    return;
  }
  await startAdminTaskGroupApi(group.id);
  message.success($t('page.task.groupStartSuccess'));
}

async function handleGroupStop(group: AdminTaskGroup) {
  if (!group.id) {
    return;
  }
  await stopAdminTaskGroupApi(group.id);
  message.success($t('page.task.groupStopSuccess'));
}

async function handleGroupRunOnce(group: AdminTaskGroup) {
  if (!group.id) {
    return;
  }
  await runAdminTaskGroupOnceApi(group.id);
  message.success($t('page.task.groupRunOnceSuccess'));
}

function handleOpenCreateTask() {
  resetTaskForm();
  taskModalOpen.value = true;
}

function handleOpenEditTask(task: AdminTask) {
  editingTaskId.value = task.id;
  Object.assign(taskFormModel, {
    args: task.args || '',
    concurrent: task.concurrent ?? false,
    cronExpression: task.cronExpression || '',
    groupId: task.groupId,
    invokeTarget: task.invokeTarget || '',
    remark: task.remark || '',
    retry: task.retry ?? 0,
    status: task.status ?? 'STOPPED',
    taskName: task.taskName || '',
    taskType: task.taskType ?? 'FUNCTION',
  });
  taskModalOpen.value = true;
}

async function handleSubmitTask() {
  await taskFormRef.value?.validate();
  taskSubmitting.value = true;
  try {
    if (editingTaskId.value) {
      await updateAdminTaskApi(editingTaskId.value, taskFormModel);
      message.success($t('page.task.taskUpdateSuccess'));
    } else {
      await createAdminTaskApi(taskFormModel);
      message.success($t('page.task.taskCreateSuccess'));
    }
    taskModalOpen.value = false;
    await loadTasks();
  } catch (error) {
    message.error((error as Error).message || $t('page.task.taskSubmitFailed'));
  } finally {
    taskSubmitting.value = false;
  }
}

async function handleDeleteTask(task: AdminTask) {
  if (!task.id) {
    return;
  }
  await deleteAdminTaskApi(task.id);
  message.success($t('page.task.taskDeleteSuccess'));
  await loadTasks();
}

async function handleTaskStart(task: AdminTask) {
  if (!task.id) {
    return;
  }
  await startAdminTaskApi(task.id);
  message.success($t('page.task.taskStartSuccess'));
  await loadTasks();
}

async function handleTaskStop(task: AdminTask) {
  if (!task.id) {
    return;
  }
  await stopAdminTaskApi(task.id);
  message.success($t('page.task.taskStopSuccess'));
  await loadTasks();
}

async function handleTaskRunOnce(task: AdminTask) {
  if (!task.id) {
    return;
  }
  await runAdminTaskOnceApi(task.id);
  message.success($t('page.task.taskRunOnceSuccess'));
  await loadTasks();
}

function formatTaskTime(value?: string) {
  return value || '-';
}

function toTaskSorting(
  sorter?: AdminTaskTableChangeSorter,
): AdminTableSorting[] {
  let items: AdminTaskTableChangeSorter[] = [];
  if (Array.isArray(sorter)) {
    items = sorter;
  } else if (sorter) {
    items = [sorter];
  }
  const result: AdminTableSorting[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('order' in item)) {
      continue;
    }
    const order = item.order;
    let field = '';
    if (item.column && 'sortField' in item.column) {
      field = String(item.column.sortField || '');
    }
    if (!field) {
      continue;
    }
    if (order === 'ascend') {
      result.push({ direction: 'ASC', field });
      continue;
    }
    if (order === 'descend') {
      result.push({ direction: 'DESC', field });
    }
  }
  return result;
}

async function loadTasks() {
  taskLoading.value = true;
  try {
    const response = await listAdminTasksApi({
      groupId: selectedGroupId.value,
      name: taskSearchForm.name,
      page: taskPagination.current,
      pageSize: taskPagination.pageSize,
      sorting: taskSorting.value,
      status: taskSearchForm.status,
      taskType: taskSearchForm.taskType,
    });
    taskRows.value = response.items;
    taskPagination.total = response.total;
  } catch (error) {
    message.error((error as Error).message || $t('page.task.loadTasksFailed'));
  } finally {
    taskLoading.value = false;
  }
}

async function handleSearchTasks() {
  taskPagination.current = 1;
  await loadTasks();
}

async function handleResetTasks() {
  taskSearchForm.name = '';
  taskSearchForm.status = undefined;
  taskSearchForm.taskType = undefined;
  taskSorting.value = [{ direction: 'DESC', field: 'updated_at' }];
  taskPagination.current = 1;
  await loadTasks();
}

async function handleTaskTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTaskTableChangeSorter,
) {
  taskPagination.current = pagination.current ?? 1;
  taskPagination.pageSize = pagination.pageSize ?? 10;
  taskSorting.value = toTaskSorting(sorter);
  if (taskSorting.value.length === 0) {
    taskSorting.value = [{ direction: 'DESC', field: 'updated_at' }];
  }
  await loadTasks();
}

async function handleReload() {
  await loadGroups();
  await loadTasks();
}

function groupRowProps(record: AdminTaskGroup) {
  return {
    onClick: () => void handleSelectGroup(record),
  };
}

watch(
  () => selectedGroupId.value,
  (value) => {
    if (value !== undefined) {
      void loadTasks();
    }
  },
  { immediate: false },
);

void handleReload();
</script>

<template>
  <Page auto-content-height :title="$t('menu.task.task')">
    <div class="admin-task-layout">
      <section class="admin-task-groups">
        <div class="admin-task-panel-header">
          <div>
            <div class="admin-task-panel-title">
              {{ $t('page.task.groupPanelTitle') }}
            </div>
            <div class="admin-task-panel-subtitle">
              {{ $t('page.task.groupPanelDesc') }}
            </div>
          </div>
          <Space wrap>
            <Button
              v-if="hasAccessByCodes([...TASK_ACCESS.groupCreate])"
              type="primary"
              @click="handleOpenCreateGroup"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              {{ $t('page.task.createGroupButton') }}
            </Button>
          </Space>
        </div>

        <Table
          :columns="groupColumns"
          :custom-row="groupRowProps"
          :data-source="groups"
          :loading="groupLoading"
          :pagination="false"
          :row-class-name="
            (record) =>
              record.id === selectedGroupId ? 'admin-task-group-row-active' : ''
          "
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'groupName'">
              <button
                class="admin-task-group-trigger"
                type="button"
                @click.stop="void handleSelectGroup(record)"
              >
                <Tooltip
                  :title="`${record.groupName || '-'} / ${formatGroupTenantLabel(record)} / ${record.remark || $t('page.task.groupRemarkEmpty')}`"
                >
                  <span class="admin-task-group-main">
                    {{ record.groupName || '-' }}
                  </span>
                </Tooltip>
              </button>
            </template>
            <template v-else-if="column.key === 'selected'">
              <Radio
                :checked="record.id === selectedGroupId"
                @click.stop="void handleSelectGroup(record)"
              />
            </template>
            <template v-else-if="column.key === 'action'">
              <Dropdown trigger="click">
                <Button size="small" type="link" @click.stop>
                  <template #icon>
                    <IconifyIcon icon="lucide:ellipsis" />
                  </template>
                </Button>
                <template #overlay>
                  <Menu @click.stop>
                    <Menu.Item
                      v-if="hasAccessByCodes([...TASK_ACCESS.groupEdit])"
                      @click="handleOpenEditGroup(record)"
                    >
                      <Space size="small">
                        <IconifyIcon icon="lucide:pencil" />
                        <span>{{ $t('page.task.editButton') }}</span>
                      </Space>
                    </Menu.Item>
                    <Menu.Item
                      v-if="hasAccessByCodes([...TASK_ACCESS.groupStart])"
                      @click="handleGroupStart(record)"
                    >
                      <Space size="small">
                        <IconifyIcon icon="lucide:play" />
                        <span>{{ $t('page.task.startButton') }}</span>
                      </Space>
                    </Menu.Item>
                    <Menu.Item
                      v-if="hasAccessByCodes([...TASK_ACCESS.groupStop])"
                      @click="handleGroupStop(record)"
                    >
                      <Space size="small">
                        <IconifyIcon icon="lucide:square" />
                        <span>{{ $t('page.task.stopButton') }}</span>
                      </Space>
                    </Menu.Item>
                    <Menu.Item
                      v-if="hasAccessByCodes([...TASK_ACCESS.groupRunOnce])"
                      @click="handleGroupRunOnce(record)"
                    >
                      <Space size="small">
                        <IconifyIcon icon="lucide:send" />
                        <span>{{ $t('page.task.runOnceButton') }}</span>
                      </Space>
                    </Menu.Item>
                    <Menu.Divider
                      v-if="hasAccessByCodes([...TASK_ACCESS.groupDelete])"
                    />
                    <Menu.Item
                      v-if="hasAccessByCodes([...TASK_ACCESS.groupDelete])"
                      danger
                    >
                      <Popconfirm
                        :title="$t('page.task.deleteGroupConfirm')"
                        @confirm="handleDeleteGroup(record)"
                      >
                        <Space size="small" @click.stop>
                          <IconifyIcon icon="lucide:trash-2" />
                          <span>{{ $t('page.task.deleteButton') }}</span>
                        </Space>
                      </Popconfirm>
                    </Menu.Item>
                  </Menu>
                </template>
              </Dropdown>
            </template>
          </template>
          <template #emptyText>
            <Empty :description="$t('page.task.emptyGroups')" size="small" />
          </template>
        </Table>
      </section>

      <section ref="taskTableSurfaceRef" class="admin-task-surface">
        <div class="admin-task-panel-header">
          <div>
            <div class="admin-task-panel-title">
              {{ selectedGroupLabel }}
            </div>
            <div class="admin-task-panel-subtitle">
              {{ $t('page.task.taskPanelDesc') }}
            </div>
          </div>
        </div>

        <div class="admin-task-toolbar">
          <Form
            class="admin-task-search"
            :model="taskSearchForm"
            layout="inline"
            @finish="handleSearchTasks"
          >
            <Form.Item
              class="admin-task-search__item"
              :label="$t('page.task.taskName')"
              name="name"
            >
              <Input
                v-model:value="taskSearchForm.name"
                allow-clear
                :placeholder="$t('page.task.placeholderSearchTaskName')"
              />
            </Form.Item>
            <Form.Item
              class="admin-task-search__item"
              :label="$t('page.task.status')"
              name="status"
            >
              <Select
                v-model:value="taskSearchForm.status"
                allow-clear
                :options="statusOptions"
                :placeholder="$t('page.task.placeholderStatus')"
              />
            </Form.Item>
            <Form.Item
              class="admin-task-search__item"
              :label="$t('page.task.taskType')"
              name="taskType"
            >
              <Select
                v-model:value="taskSearchForm.taskType"
                allow-clear
                :options="typeOptions"
                :placeholder="$t('page.task.placeholderTaskType')"
              />
            </Form.Item>
            <Form.Item class="admin-task-search__actions">
              <Space>
                <Button html-type="submit" type="primary">
                  <template #icon>
                    <IconifyIcon icon="lucide:search" />
                  </template>
                  {{ $t('common.query') }}
                </Button>
                <Button @click="handleResetTasks">
                  <template #icon>
                    <IconifyIcon icon="lucide:rotate-ccw" />
                  </template>
                  {{ $t('common.reset') }}
                </Button>
              </Space>
            </Form.Item>
          </Form>

          <Space class="admin-task-toolbar__actions">
            <AdminTableToolbar
              v-model:column-keys="visibleTaskColumnKeys"
              :columns="taskColumns"
              :data-source="taskRows"
              :export-access-codes="TASK_ACCESS.export"
              file-name="task-list"
              :fullscreen-target="taskTableSurfaceRef"
              :refresh="loadTasks"
              storage-key="task-list"
            />
            <Button
              v-if="hasAccessByCodes([...TASK_ACCESS.create])"
              type="primary"
              @click="handleOpenCreateTask"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              {{ $t('page.task.createTaskButton') }}
            </Button>
          </Space>
        </div>

        <Table
          class="admin-task-table"
          :columns="displayTaskColumns"
          :data-source="taskRows"
          :loading="taskLoading"
          :pagination="taskPagination"
          row-key="id"
          size="middle"
          @change="handleTaskTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'taskName'">
              <div class="task-cell">
                <Tooltip :title="record.remark || $t('page.task.remarkEmpty')">
                  <span class="task-main">{{ record.taskName || '-' }}</span>
                </Tooltip>
              </div>
            </template>

            <template v-else-if="column.key === 'taskType'">
              {{ getTaskTypeText(record.taskType) }}
            </template>

            <template v-else-if="column.key === 'cronExpression'">
              <div class="task-cron-cell">
                <span class="task-cron-chip">
                  {{ record.cronExpression || $t('page.task.cronManual') }}
                </span>
              </div>
            </template>

            <template v-else-if="column.key === 'concurrent'">
              {{ record.concurrent ? $t('page.task.yes') : $t('page.task.no') }}
            </template>

            <template v-else-if="column.key === 'status'">
              <Tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </Tag>
            </template>

            <template v-else-if="column.key === 'updatedAt'">
              {{ formatTaskTime(record.updatedAt) }}
            </template>

            <template v-else-if="column.key === 'action'">
              <Space class="task-action-cell" size="small" wrap>
                <Button
                  v-if="hasAccessByCodes([...TASK_ACCESS.edit])"
                  size="small"
                  type="link"
                  @click="handleOpenEditTask(record as AdminTask)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:pencil" />
                  </template>
                  {{ $t('page.task.editTaskButton') }}
                </Button>
                <Button
                  v-if="hasAccessByCodes([...TASK_ACCESS.start])"
                  size="small"
                  type="link"
                  @click="handleTaskStart(record as AdminTask)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:play" />
                  </template>
                  {{ $t('page.task.startTaskButton') }}
                </Button>
                <Button
                  v-if="hasAccessByCodes([...TASK_ACCESS.stop])"
                  size="small"
                  type="link"
                  @click="handleTaskStop(record as AdminTask)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:square" />
                  </template>
                  {{ $t('page.task.stopTaskButton') }}
                </Button>
                <Button
                  v-if="hasAccessByCodes([...TASK_ACCESS.runOnce])"
                  size="small"
                  type="link"
                  @click="handleTaskRunOnce(record as AdminTask)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:send" />
                  </template>
                  {{ $t('page.task.runTaskOnceButton') }}
                </Button>
                <Popconfirm
                  v-if="hasAccessByCodes([...TASK_ACCESS.delete])"
                  :title="$t('page.task.deleteTaskConfirm')"
                  @confirm="handleDeleteTask(record as AdminTask)"
                >
                  <Button danger size="small" type="link">
                    <template #icon>
                      <IconifyIcon icon="lucide:trash-2" />
                    </template>
                    {{ $t('page.task.deleteTaskButton') }}
                  </Button>
                </Popconfirm>
              </Space>
            </template>
          </template>
        </Table>
      </section>
    </div>

    <Modal
      v-model:open="groupModalOpen"
      :confirm-loading="groupSubmitting"
      force-render
      get-container="body"
      :title="groupModalTitle"
      destroy-on-close
      @cancel="groupModalOpen = false"
      @ok="handleSubmitGroup"
    >
      <Form ref="groupFormRef" :model="groupFormModel" layout="vertical">
        <Form.Item
          :label="$t('page.task.groupName')"
          name="groupName"
          :rules="[
            {
              required: true,
              message: $t('page.task.groupNameRequired'),
            },
          ]"
        >
          <Input
            v-model:value="groupFormModel.groupName"
            :placeholder="$t('page.task.placeholderGroupName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.task.groupRemark')" name="remark">
          <Input.TextArea
            v-model:value="groupFormModel.remark"
            :placeholder="$t('page.task.placeholderGroupRemark')"
            :rows="3"
          />
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      v-model:open="taskModalOpen"
      :confirm-loading="taskSubmitting"
      force-render
      get-container="body"
      :title="taskModalTitle"
      destroy-on-close
      width="720px"
      @cancel="taskModalOpen = false"
      @ok="handleSubmitTask"
    >
      <Form ref="taskFormRef" :model="taskFormModel" layout="vertical">
        <div class="admin-task-form-grid">
          <Form.Item
            :label="$t('page.task.taskName')"
            name="taskName"
            :rules="[
              {
                required: true,
                message: $t('page.task.taskNameRequired'),
              },
            ]"
          >
            <Input
              v-model:value="taskFormModel.taskName"
              :placeholder="$t('page.task.placeholderTaskName')"
            />
          </Form.Item>
          <Form.Item
            :label="$t('page.task.groupName')"
            name="groupId"
            :rules="[
              {
                required: true,
                message: $t('page.task.groupRequired'),
              },
            ]"
          >
            <Select
              v-model:value="taskFormModel.groupId"
              :options="taskGroupOptions"
              :placeholder="$t('page.task.placeholderGroup')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.task.taskType')" name="taskType">
            <Select
              v-model:value="taskFormModel.taskType"
              :options="typeOptions"
              :placeholder="$t('page.task.placeholderTaskType')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.task.status')" name="status">
            <Select
              v-model:value="taskFormModel.status"
              :options="statusOptions"
              :placeholder="$t('page.task.placeholderStatus')"
            />
          </Form.Item>
          <Form.Item
            :label="$t('page.task.cronExpression')"
            name="cronExpression"
          >
            <Input
              v-model:value="taskFormModel.cronExpression"
              :placeholder="$t('page.task.placeholderCronExpression')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.task.invokeTarget')" name="invokeTarget">
            <Input
              v-model:value="taskFormModel.invokeTarget"
              :placeholder="$t('page.task.placeholderInvokeTarget')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.task.retry')" name="retry">
            <InputNumber
              v-model:value="taskFormModel.retry"
              :max="5"
              :min="0"
              style="width: 100%"
            />
          </Form.Item>
          <Form.Item :label="$t('page.task.concurrent')" name="concurrent">
            <Switch v-model:checked="taskFormModel.concurrent" />
          </Form.Item>
        </div>
        <Form.Item :label="$t('page.task.args')" name="args">
          <Input.TextArea
            v-model:value="taskFormModel.args"
            :placeholder="$t('page.task.placeholderArgs')"
            :rows="4"
          />
        </Form.Item>
        <Form.Item :label="$t('page.task.remark')" name="remark">
          <Input.TextArea
            v-model:value="taskFormModel.remark"
            :placeholder="$t('page.task.placeholderRemark')"
            :rows="3"
          />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-task-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.admin-task-groups,
.admin-task-surface {
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-task-panel-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.admin-task-panel-title {
  font-size: 16px;
  font-weight: 600;
}

.admin-task-panel-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--vben-text-secondary-color);
}

.admin-task-toolbar {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.admin-task-search {
  flex: 1;
  gap: 0 8px;
  min-width: 0;
}

.admin-task-search__item {
  margin-bottom: 8px;
}

.admin-task-search__actions {
  margin-bottom: 8px;
}

.admin-task-toolbar__actions {
  flex-shrink: 0;
}

.task-group-context {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 16px;
  background: hsl(var(--muted) / 18%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.task-group-context__label {
  font-size: 12px;
  color: var(--vben-text-secondary-color);
}

.task-group-context__value {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.admin-task-group-trigger {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
  padding: 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.admin-task-group-main,
.task-main {
  font-weight: 400;
  color: hsl(var(--foreground));
}

.admin-task-group-row-active :deep(td) {
  background: rgb(24 144 255 / 8%) !important;
}

.admin-task-group-row-active :deep(.ant-radio-inner) {
  border-color: rgb(24 144 255);
}

.admin-task-group-row-active :deep(.ant-radio-inner::after) {
  background-color: rgb(24 144 255);
}

.task-cell {
  display: flex;
  flex-direction: column;
}

.task-cron-cell {
  display: flex;
  align-items: center;
}

.task-cron-chip {
  display: inline-flex;
  max-width: 100%;
  padding: 6px 10px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.2;
  color: hsl(var(--foreground));
  white-space: nowrap;
  background: hsl(var(--muted) / 20%);
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.task-action-cell {
  justify-content: flex-start;
  min-width: 240px;
}

.admin-task-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 960px) {
  .admin-task-layout {
    grid-template-columns: 1fr;
  }

  .admin-task-form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .admin-task-groups,
  .admin-task-surface {
    padding: 12px;
  }

  .admin-task-toolbar {
    flex-direction: column;
  }

  .task-group-context {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
