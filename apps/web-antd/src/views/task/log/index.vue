<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AdminTaskLog, AdminTaskLogStatus } from '#/api/admin/tasks';

import { computed, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  DatePicker,
  Descriptions,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listAdminTaskLogsApi } from '#/api/admin/tasks';
import { $t } from '#/locales';

type AdminTaskLogRow = AdminTaskLog & {
  task_name?: string;
  taskName?: string;
};

const TASK_LOG_ACCESS = {
  export: ['task:logs:export'],
} as const;

const { hasAccessByCodes } = useAccess();
const detailOpen = ref(false);
const currentLog = ref<AdminTaskLogRow>();

const statusOptions: Array<{ label: string; value: AdminTaskLogStatus }> = [
  { label: $t('page.taskLog.statusSuccess'), value: 'SUCCESS' },
  { label: $t('page.taskLog.statusFailure'), value: 'FAILURE' },
];

const searchForm = reactive({
  executeTimeRange: undefined as [string, string] | undefined,
  status: undefined as AdminTaskLogStatus | undefined,
  taskId: undefined as number | undefined,
});
const gridKey = ref(0);

const gridOptions: VxeTableGridOptions<AdminTaskLogRow> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'executeTime',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.taskLog.executeTime'),
      width: 160,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('page.taskLog.status'),
      width: 120,
    },
    {
      field: 'taskId',
      slots: { default: 'taskId' },
      sortable: true,
      title: $t('page.taskLog.taskLabel'),
      width: 180,
    },
    {
      field: 'processTime',
      slots: { default: 'processTime' },
      title: $t('page.taskLog.processTime'),
      width: 110,
    },
    {
      field: 'input',
      slots: { default: 'input' },
      title: $t('page.taskLog.input'),
      width: 240,
    },
    {
      field: 'output',
      slots: { default: 'output' },
      title: $t('page.taskLog.output'),
      width: 280,
    },
    {
      field: 'error',
      slots: { default: 'error' },
      title: $t('page.taskLog.error'),
      width: 220,
    },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 110,
    },
  ],
  exportConfig: {
    filename: 'task-logs',
    type: 'csv',
  },
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async (
        { page, sort }: { page: any; sort: any },
        _formValues: Record<string, any>,
      ) => {
        const sortField = String(sort.field || 'executeTime');
        const direction = sort.order === 'asc' ? 'ASC' : 'DESC';

        return await listAdminTaskLogsApi({
          executeTimeEnd: toFilterTimeValue(
            searchForm.executeTimeRange?.[1],
            true,
          ),
          executeTimeStart: toFilterTimeValue(
            searchForm.executeTimeRange?.[0],
            false,
          ),
          page: page.currentPage,
          pageSize: page.pageSize,
          sorting: [
            {
              direction,
              field: sortField === 'executeTime' ? 'execute_time' : sortField,
            },
          ],
          status: searchForm.status,
          taskId: searchForm.taskId,
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
    export: hasAccessByCodes([...TASK_LOG_ACCESS.export]),
    refresh: true,
    zoom: true,
  },
};

function formatStatus(status?: AdminTaskLogStatus) {
  switch (status) {
    case 'FAILURE': {
      return $t('page.taskLog.statusFailure');
    }
    case 'SUCCESS': {
      return $t('page.taskLog.statusSuccess');
    }
    default: {
      return $t('page.taskLog.statusUnspecified');
    }
  }
}

function statusColor(status?: AdminTaskLogStatus) {
  switch (status) {
    case 'FAILURE': {
      return 'crimson';
    }
    case 'SUCCESS': {
      return 'limegreen';
    }
    default: {
      return '#86909C';
    }
  }
}

function formatText(value?: string) {
  const text = value?.trim();
  return text || '-';
}

function getTaskDisplayName(log?: AdminTaskLogRow) {
  const taskName = log?.taskName?.trim() || log?.task_name?.trim();
  if (taskName) {
    return taskName;
  }
  if (log?.taskId === undefined) {
    return '-';
  }
  return String(log.taskId);
}

function getTaskIdText(log?: AdminTaskLogRow) {
  if (log?.taskId === undefined) {
    return '-';
  }
  return String(log.taskId);
}

function toFilterTimeValue(value?: string, endOfSecond = false) {
  if (!value) {
    return undefined;
  }
  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return undefined;
  }
  return (
    endOfSecond ? parsed.endOf('second') : parsed.startOf('second')
  ).toISOString();
}

const detailTitle = computed(() =>
  currentLog.value?.id
    ? `${$t('page.taskLog.detailTitle')} #${currentLog.value.id}`
    : $t('page.taskLog.detailTitle'),
);

function openDetail(log: AdminTaskLogRow) {
  currentLog.value = log;
  detailOpen.value = true;
}

function reloadGrid() {
  gridKey.value += 1;
}

function handleSearch() {
  reloadGrid();
}

function handleReset() {
  searchForm.executeTimeRange = undefined;
  searchForm.status = undefined;
  searchForm.taskId = undefined;
  reloadGrid();
}

const [Grid] = useVbenVxeGrid<AdminTaskLogRow>({
  gridClass: 'log-audit-grid',
  gridOptions,
});
</script>

<template>
  <Page auto-content-height>
    <div class="admin-task-log-toolbar">
      <Form
        class="admin-task-log-search"
        :model="searchForm"
        layout="inline"
        @finish="handleSearch"
      >
        <Form.Item
          class="admin-task-log-search__item admin-task-log-search__item--id"
          :label="$t('page.taskLog.taskId')"
          name="taskId"
        >
          <InputNumber
            v-model:value="searchForm.taskId"
            :controls="false"
            :placeholder="$t('page.taskLog.searchTaskId')"
          />
        </Form.Item>
        <Form.Item
          class="admin-task-log-search__item admin-task-log-search__item--status"
          :label="$t('page.taskLog.status')"
          name="status"
        >
          <Select
            v-model:value="searchForm.status"
            allow-clear
            :options="statusOptions"
            :placeholder="$t('page.taskLog.selectStatus')"
          />
        </Form.Item>
        <Form.Item
          class="admin-task-log-search__item admin-task-log-search__item--time"
          :label="$t('page.taskLog.executeTimeRange')"
          name="executeTimeRange"
        >
          <DatePicker.RangePicker
            v-model:value="searchForm.executeTimeRange"
            allow-clear
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </Form.Item>
        <Form.Item class="admin-task-log-search__actions">
          <Space>
            <Button html-type="submit" type="primary">
              <template #icon>
                <IconifyIcon icon="lucide:search" />
              </template>
              {{ $t('common.query') }}
            </Button>
            <Button @click="handleReset">
              <template #icon>
                <IconifyIcon icon="lucide:rotate-ccw" />
              </template>
              {{ $t('common.reset') }}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>

    <Grid :key="gridKey" :table-title="$t('menu.task.log')">
      <template #status="{ row }">
        <Tag :color="statusColor(row.status)">
          {{ formatStatus(row.status) }}
        </Tag>
      </template>
      <template #taskId="{ row }">
        <Tooltip>
          <template #title>
            <div class="task-log-tooltip-lines">
              <div>
                {{ `${$t('page.taskLog.taskId')}: ${getTaskIdText(row)}` }}
              </div>
            </div>
          </template>
          <span class="task-log-task-name">
            {{ getTaskDisplayName(row) }}
          </span>
        </Tooltip>
      </template>
      <template #processTime="{ row }">
        <span
          class="task-log-duration"
          :title="row.processTime !== undefined ? `${row.processTime} ms` : '-'"
        >
          {{ row.processTime !== undefined ? `${row.processTime} ms` : '-' }}
        </span>
      </template>
      <template #input="{ row }">
        <span class="task-log-text" :title="formatText(row.input)">{{
          formatText(row.input)
        }}</span>
      </template>
      <template #output="{ row }">
        <span class="task-log-text" :title="formatText(row.output)">{{
          formatText(row.output)
        }}</span>
      </template>
      <template #error="{ row }">
        <span class="task-log-text" :title="formatText(row.error)">{{
          formatText(row.error)
        }}</span>
      </template>
      <template #action="{ row }">
        <Button
          class="task-log-action"
          size="small"
          type="link"
          @click="openDetail(row)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:eye" />
          </template>
          {{ $t('page.taskLog.viewDetailButton') }}
        </Button>
      </template>
    </Grid>

    <Modal
      v-model:open="detailOpen"
      :footer="null"
      :title="detailTitle"
      width="840px"
    >
      <div class="task-log-detail">
        <div class="task-log-detail__summary">
          <div class="task-log-detail__main">
            <div class="task-log-detail__name">
              {{ getTaskDisplayName(currentLog) }}
            </div>
            <div class="task-log-detail__meta">
              {{ `${$t('page.taskLog.taskId')}: ${getTaskIdText(currentLog)}` }}
            </div>
          </div>
          <Space wrap>
            <Tag :color="statusColor(currentLog?.status)">
              {{ formatStatus(currentLog?.status) }}
            </Tag>
            <Tag>
              {{
                currentLog?.processTime !== undefined
                  ? `${currentLog.processTime} ms`
                  : '-'
              }}
            </Tag>
          </Space>
        </div>

        <Descriptions
          class="task-log-descriptions"
          :column="2"
          bordered
          size="small"
        >
          <Descriptions.Item :label="$t('page.taskLog.taskLabel')">
            <div class="task-log-detail-task">
              <div class="task-log-detail-task__name">
                {{ getTaskDisplayName(currentLog) }}
              </div>
              <div class="task-log-detail-task__id">
                {{
                  `${$t('page.taskLog.taskId')}: ${getTaskIdText(currentLog)}`
                }}
              </div>
            </div>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('page.taskLog.status')">
            <Tag :color="statusColor(currentLog?.status)">
              {{ formatStatus(currentLog?.status) }}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('page.taskLog.executeTime')">
            {{ currentLog?.executeTime || '-' }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('page.taskLog.processTime')">
            {{
              currentLog?.processTime !== undefined
                ? `${currentLog.processTime} ms`
                : '-'
            }}
          </Descriptions.Item>
          <Descriptions.Item :label="$t('page.taskLog.input')" :span="2">
            <pre class="task-log-pre">{{ formatText(currentLog?.input) }}</pre>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('page.taskLog.output')" :span="2">
            <pre class="task-log-pre">{{ formatText(currentLog?.output) }}</pre>
          </Descriptions.Item>
          <Descriptions.Item :label="$t('page.taskLog.error')" :span="2">
            <pre class="task-log-pre">{{ formatText(currentLog?.error) }}</pre>
          </Descriptions.Item>
        </Descriptions>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.task-log-tooltip-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-log-task-name {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  vertical-align: bottom;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.task-log-duration {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground) / 88%);
}

.task-log-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.task-log-action {
  padding-inline: 0;
}

.task-log-pre {
  max-height: 240px;
  padding: 10px 12px;
  margin: 0;
  overflow: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted) / 18%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.task-log-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-log-detail__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.task-log-detail__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-log-detail__name {
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.task-log-detail__meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.task-log-detail-task {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-log-detail-task__name {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.task-log-detail-task__id {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.task-log-descriptions :deep(.ant-descriptions-item-label) {
  min-width: 132px;
}

.task-log-descriptions :deep(.ant-descriptions-item-content) {
  min-width: 240px;
  overflow-wrap: anywhere;
}

.task-log-descriptions :deep(.ant-descriptions-row > th),
.task-log-descriptions :deep(.ant-descriptions-row > td) {
  vertical-align: top;
}

.admin-task-log-toolbar {
  margin-bottom: 12px;
}

.admin-task-log-search {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}

:deep(.admin-task-log-search .ant-form-item) {
  margin-bottom: 0;
}

:deep(.admin-task-log-search .ant-form-item-row) {
  display: flex;
  align-items: center;
}

:deep(.admin-task-log-search .ant-form-item-label) {
  flex: none;
  padding-bottom: 0;
  margin-right: 8px;
}

:deep(.admin-task-log-search .ant-form-item-label > label) {
  height: 32px;
  line-height: 32px;
}

:deep(.admin-task-log-search .ant-form-item-control) {
  flex: 1;
  min-width: 0;
}

:deep(.admin-task-log-search .ant-input-number),
:deep(.admin-task-log-search .ant-picker),
:deep(.admin-task-log-search .ant-select) {
  width: 100%;
}

:deep(.admin-task-log-search .ant-input-number),
:deep(.admin-task-log-search .ant-picker),
:deep(.admin-task-log-search .ant-select-selector),
:deep(.admin-task-log-search .ant-btn) {
  min-height: 32px;
}

.admin-task-log-search__item {
  min-width: 0;
}

.admin-task-log-search__item--id {
  width: 160px;
}

.admin-task-log-search__item--status {
  width: 156px;
}

.admin-task-log-search__item--time {
  width: 380px;
}

.admin-task-log-search__actions {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .admin-task-log-search {
    gap: 8px;
  }

  .admin-task-log-search__item--id,
  .admin-task-log-search__item--status,
  .admin-task-log-search__item--time {
    width: 100%;
  }
}
</style>
