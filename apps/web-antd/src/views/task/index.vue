<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';

import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AdminTask,
  AdminTaskGroup,
  AdminTaskGroupSaveInput,
  AdminTaskSaveInput,
  AdminTaskStatus,
  AdminTaskType,
} from '#/api/admin/tasks';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

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

import { useVbenVxeGrid } from '#/adapter/vxe-table';
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
const groups = ref<AdminTaskGroup[]>([]);
const selectedGroupId = ref<number>();
const gridKey = ref(0);

const taskModalOpen = ref(false);
const taskSubmitting = ref(false);
const editingTaskId = ref<number>();
const taskFormRef = ref();

const groupModalOpen = ref(false);
const groupSubmitting = ref(false);
const editingGroupId = ref<number>();
const groupFormRef = ref();

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

const groupColumns: any[] = [
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

const taskFormRules = computed<Record<string, Rule[]>>(() => ({
  groupId: [
    {
      message: $t('page.task.groupRequired'),
      required: true,
    },
  ],
  taskName: [
    {
      message: $t('page.task.taskNameRequired'),
      required: true,
    },
  ],
}));

const groupFormRules = computed<Record<string, Rule[]>>(() => ({
  groupName: [
    {
      message: $t('page.task.groupNameRequired'),
      required: true,
    },
  ],
}));

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.task.placeholderSearchTaskName'),
      },
      fieldName: 'name',
      label: $t('page.task.taskName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions,
        placeholder: $t('page.task.placeholderStatus'),
      },
      fieldName: 'status',
      label: $t('page.task.status'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: typeOptions,
        placeholder: $t('page.task.placeholderTaskType'),
      },
      fieldName: 'taskType',
      label: $t('page.task.taskType'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<AdminTask> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'taskName',
      slots: { default: 'taskName' },
      sortable: true,
      title: $t('page.task.taskName'),
      width: 180,
    },
    {
      field: 'taskType',
      slots: { default: 'taskType' },
      sortable: true,
      title: $t('page.task.taskType'),
      width: 120,
    },
    {
      field: 'cronExpression',
      slots: { default: 'cronExpression' },
      sortable: true,
      title: $t('page.task.cronExpression'),
      width: 220,
    },
    {
      field: 'invokeTarget',
      sortable: true,
      title: $t('page.task.invokeTarget'),
      width: 240,
    },
    {
      field: 'retry',
      sortable: true,
      title: $t('page.task.retry'),
      width: 90,
    },
    {
      field: 'concurrent',
      slots: { default: 'concurrent' },
      sortable: true,
      title: $t('page.task.concurrent'),
      width: 100,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      sortable: true,
      title: $t('page.task.status'),
      width: 110,
    },
    {
      field: 'updatedAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.task.updatedAt'),
      width: 170,
    },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 320,
    },
  ],
  exportConfig: {
    filename: 'task-list',
    type: 'csv',
  },
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async (
        { page, sort }: { page: any; sort: any },
        formValues: Record<string, any>,
      ) => {
        const sortField = String(sort.field || 'updatedAt');
        const direction = sort.order === 'asc' ? 'ASC' : 'DESC';

        return await listAdminTasksApi({
          groupId: selectedGroupId.value,
          name: formValues.name,
          page: page.currentPage,
          pageSize: page.pageSize,
          sorting: [
            {
              direction,
              field: sortField === 'updatedAt' ? 'updated_at' : sortField,
            },
          ],
          status: formValues.status,
          taskType: formValues.taskType,
        });
      },
    },
    sort: true,
  },
  rowConfig: {
    isHover: true,
  },
  stripe: true,
  toolbarConfig: {
    custom: true,
    export: hasAccessByCodes([...TASK_ACCESS.export]),
    refresh: true,
    slots: {
      toolPrefix: 'toolPrefix',
    },
    zoom: true,
  },
};

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

function reloadGrid() {
  gridKey.value += 1;
}

async function handleSelectGroup(group?: AdminTaskGroup) {
  selectedGroupId.value = group?.id;
  await nextTick();
  reloadGrid();
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
    reloadGrid();
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
  try {
    await deleteAdminTaskGroupApi(group.id);
    message.success($t('page.task.groupDeleteSuccess'));
    if (selectedGroupId.value === group.id) {
      selectedGroupId.value = undefined;
    }
    await loadGroups();
    reloadGrid();
  } catch (error) {
    message.error(
      (error as Error).message || $t('page.task.groupDeleteFailed'),
    );
  }
}

async function handleGroupStart(group: AdminTaskGroup) {
  if (!group.id) {
    return;
  }
  try {
    await startAdminTaskGroupApi(group.id);
    message.success($t('page.task.groupStartSuccess'));
    reloadGrid();
  } catch (error) {
    message.error((error as Error).message || $t('page.task.groupStartFailed'));
  }
}

async function handleGroupStop(group: AdminTaskGroup) {
  if (!group.id) {
    return;
  }
  try {
    await stopAdminTaskGroupApi(group.id);
    message.success($t('page.task.groupStopSuccess'));
    reloadGrid();
  } catch (error) {
    message.error((error as Error).message || $t('page.task.groupStopFailed'));
  }
}

async function handleGroupRunOnce(group: AdminTaskGroup) {
  if (!group.id) {
    return;
  }
  try {
    await runAdminTaskGroupOnceApi(group.id);
    message.success($t('page.task.groupRunOnceSuccess'));
    reloadGrid();
  } catch (error) {
    message.error(
      (error as Error).message || $t('page.task.groupRunOnceFailed'),
    );
  }
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
    reloadGrid();
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
  try {
    await deleteAdminTaskApi(task.id);
    message.success($t('page.task.taskDeleteSuccess'));
    reloadGrid();
  } catch (error) {
    message.error((error as Error).message || $t('page.task.taskDeleteFailed'));
  }
}

async function handleTaskStart(task: AdminTask) {
  if (!task.id) {
    return;
  }
  try {
    await startAdminTaskApi(task.id);
    message.success($t('page.task.taskStartSuccess'));
    reloadGrid();
  } catch (error) {
    message.error((error as Error).message || $t('page.task.taskStartFailed'));
  }
}

async function handleTaskStop(task: AdminTask) {
  if (!task.id) {
    return;
  }
  try {
    await stopAdminTaskApi(task.id);
    message.success($t('page.task.taskStopSuccess'));
    reloadGrid();
  } catch (error) {
    message.error((error as Error).message || $t('page.task.taskStopFailed'));
  }
}

async function handleTaskRunOnce(task: AdminTask) {
  if (!task.id) {
    return;
  }
  try {
    await runAdminTaskOnceApi(task.id);
    message.success($t('page.task.taskRunOnceSuccess'));
    reloadGrid();
  } catch (error) {
    message.error(
      (error as Error).message || $t('page.task.taskRunOnceFailed'),
    );
  }
}

function groupRowProps(record: AdminTaskGroup) {
  return {
    onClick: () => void handleSelectGroup(record),
  };
}

const [Grid] = useVbenVxeGrid({
  formOptions,
  gridClass: 'admin-task-grid',
  gridOptions,
});

onMounted(async () => {
  await loadGroups();
  await nextTick();
  reloadGrid();
});
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

      <section class="admin-task-surface">
        <div class="task-group-context">
          <span class="task-group-context__value">
            {{ selectedGroupLabel }}
          </span>
        </div>

        <Grid :key="gridKey" :table-title="$t('page.task.taskListTitle')">
          <template #toolPrefix>
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
          </template>

          <template #taskName="{ row }">
            <Tooltip :title="row.remark || $t('page.task.remarkEmpty')">
              <span class="task-main">{{ row.taskName || '-' }}</span>
            </Tooltip>
          </template>

          <template #taskType="{ row }">
            {{ getTaskTypeText(row.taskType) }}
          </template>

          <template #cronExpression="{ row }">
            <div class="task-cron-cell">
              <span class="task-cron-chip">
                {{ row.cronExpression || $t('page.task.cronManual') }}
              </span>
            </div>
          </template>

          <template #concurrent="{ row }">
            {{ row.concurrent ? $t('page.task.yes') : $t('page.task.no') }}
          </template>

          <template #status="{ row }">
            <Tag :color="getStatusColor(row.status)">
              {{ getStatusText(row.status) }}
            </Tag>
          </template>

          <template #action="{ row }">
            <Space class="task-action-cell" :size="6">
              <Button
                v-if="hasAccessByCodes([...TASK_ACCESS.edit])"
                class="task-action-link"
                size="small"
                type="link"
                @click="handleOpenEditTask(row)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:pencil" />
                </template>
                {{ $t('page.task.editButton') }}
              </Button>
              <Button
                v-if="hasAccessByCodes([...TASK_ACCESS.start])"
                class="task-action-link"
                size="small"
                type="link"
                @click="handleTaskStart(row)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:play" />
                </template>
                {{ $t('page.task.startButton') }}
              </Button>
              <Button
                v-if="hasAccessByCodes([...TASK_ACCESS.stop])"
                class="task-action-link"
                size="small"
                type="link"
                @click="handleTaskStop(row)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:square" />
                </template>
                {{ $t('page.task.stopButton') }}
              </Button>
              <Button
                v-if="hasAccessByCodes([...TASK_ACCESS.runOnce])"
                class="task-action-link"
                size="small"
                type="link"
                @click="handleTaskRunOnce(row)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:send" />
                </template>
                {{ $t('page.task.runButton') }}
              </Button>
              <Popconfirm
                v-if="hasAccessByCodes([...TASK_ACCESS.delete])"
                :title="$t('page.task.deleteTaskConfirm')"
                @confirm="handleDeleteTask(row)"
              >
                <Button
                  class="task-action-link"
                  danger
                  size="small"
                  type="link"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:trash-2" />
                  </template>
                  {{ $t('page.task.deleteButton') }}
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </Grid>
      </section>
    </div>

    <Modal
      v-model:open="groupModalOpen"
      :confirm-loading="groupSubmitting"
      destroy-on-close
      force-render
      get-container="body"
      :title="
        editingGroupId
          ? $t('page.task.editGroupTitle')
          : $t('page.task.createGroupTitle')
      "
      @cancel="groupModalOpen = false"
      @ok="handleSubmitGroup"
    >
      <Form
        ref="groupFormRef"
        :model="groupFormModel"
        :rules="groupFormRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.task.groupName')" name="groupName">
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
      destroy-on-close
      force-render
      get-container="body"
      :title="
        editingTaskId
          ? $t('page.task.editTaskTitle')
          : $t('page.task.createTaskTitle')
      "
      width="720px"
      @cancel="taskModalOpen = false"
      @ok="handleSubmitTask"
    >
      <Form
        ref="taskFormRef"
        :model="taskFormModel"
        :rules="taskFormRules"
        layout="vertical"
      >
        <div class="admin-task-form-grid">
          <Form.Item :label="$t('page.task.taskName')" name="taskName">
            <Input
              v-model:value="taskFormModel.taskName"
              :placeholder="$t('page.task.placeholderTaskName')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.task.groupName')" name="groupId">
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
  min-height: calc(100vh - 160px);
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-task-surface {
  min-width: 0;
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

.task-group-context {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  margin-bottom: 16px;
  background: hsl(var(--muted) / 18%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.task-group-context__value {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
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
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  justify-content: flex-start;
  min-width: 260px;
  line-height: 1.2;
}

.task-action-link {
  padding-inline: 0;
}

.admin-task-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.admin-task-surface :deep(.vben-use-vxe-grid),
.admin-task-surface :deep(.vben-vxe-grid),
.admin-task-surface :deep(.vxe-grid),
.admin-task-surface :deep(.vxe-grid--body-wrapper),
.admin-task-surface :deep(.vxe-table--render-wrapper) {
  min-width: 0;
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
    min-height: auto;
    padding: 12px;
  }

  .task-group-context {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
