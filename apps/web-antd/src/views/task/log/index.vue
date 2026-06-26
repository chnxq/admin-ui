<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AdminTaskLog, AdminTaskLogStatus } from '#/api/admin/tasks';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Descriptions,
  Modal,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { taskClient } from '#/api/admin/clients';
import { listAdminTaskLogsApi } from '#/api/admin/tasks';
import { normalizeAdminTableSortDirection } from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';
import {
  buildListGridColumns as buildGeneratedListGridColumns,
  buildSearchFormOptions as buildGeneratedSearchFormOptions,
} from '#/views/generated/admin/task/log.meta';

import { formatCronDescription } from '../cron-utils';

type AdminTaskLogRow = AdminTaskLog & {
  cronExpression?: string;
  taskName?: string;
};

const TASK_LOG_ACCESS = {
  export: ['task:logs:export'],
} as const;

const { hasAccessByCodes } = useAccess();
const detailOpen = ref(false);
const currentLog = ref<AdminTaskLogRow>();
const taskNameMap = ref<Record<number, string>>({});

const statusOptions: Array<{ label: string; value: AdminTaskLogStatus }> = [
  { label: $t('page.taskLog.statusSuccess'), value: 'SUCCESS' },
  { label: $t('page.taskLog.statusFailure'), value: 'FAILURE' },
];

const generatedFormOptions = buildGeneratedSearchFormOptions($t);

const formOptions: VbenFormProps = {
  ...generatedFormOptions,
  schema: (generatedFormOptions.schema || []).map((item) => {
    if (item.fieldName === 'status') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          options: statusOptions,
        },
      };
    }
    if (item.fieldName === 'taskId') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          controls: false,
        },
      };
    }
    return item;
  }),
};

const generatedColumns = buildGeneratedListGridColumns($t) ?? [];

const gridOptions: VxeTableGridOptions<AdminTaskLogRow> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    ...generatedColumns.map((column) => {
      switch (column.field) {
        case 'error': {
          return {
            ...column,
            slots: { default: 'error' },
          };
        }
        case 'executeTime': {
          return {
            ...column,
            formatter: 'formatDateTime',
          };
        }
        case 'input': {
          return {
            ...column,
            slots: { default: 'input' },
          };
        }
        case 'output': {
          return {
            ...column,
            slots: { default: 'output' },
          };
        }
        case 'processTime': {
          return {
            ...column,
            slots: { default: 'processTime' },
          };
        }
        case 'status': {
          return {
            ...column,
            slots: { default: 'status' },
          };
        }
        case 'taskId': {
          return {
            ...column,
            slots: { default: 'taskId' },
            title: $t('page.taskLog.taskLabel'),
          };
        }
        default: {
          return column;
        }
      }
    }),
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
        formValues: Record<string, any>,
      ) => {
        const sortField = String(sort.field || 'executeTime');
        const direction =
          normalizeAdminTableSortDirection(sort.order) ?? 'DESC';

        const response = await listAdminTaskLogsApi({
          executeTimeEnd: toFilterTimeValue(
            formValues.executeTimeRange?.[1],
            true,
          ),
          executeTimeStart: toFilterTimeValue(
            formValues.executeTimeRange?.[0],
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
          status: formValues.status,
          taskId: formValues.taskId,
        });
        await loadTaskNames(response.items);
        return response;
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

async function loadTaskNames(logs: AdminTaskLogRow[]) {
  const taskIds = [
    ...new Set(
      logs
        .map((item) => item.taskId)
        .filter((item): item is number => item !== undefined),
    ),
  ];

  if (taskIds.length === 0) {
    taskNameMap.value = {};
    return;
  }

  const taskDetails = await Promise.all(
    taskIds.map(async (id) => {
      try {
        const task = await taskClient.Get({ id });
        return {
          cronExpression: task.cronExpression?.trim() || '',
          id,
          taskName: task.taskName?.trim() || '',
        };
      } catch {
        return { cronExpression: '', id, taskName: '' };
      }
    }),
  );

  const nextMap: Record<number, string> = {};
  for (const item of taskDetails) {
    if (item.taskName) {
      nextMap[item.id] = item.taskName;
    }
    const row = logs.find((log) => log.taskId === item.id);
    if (row) {
      row.taskName = item.taskName;
      row.cronExpression = item.cronExpression;
    }
  }
  taskNameMap.value = nextMap;
}

function getTaskDisplayName(log?: AdminTaskLogRow) {
  const taskId = log?.taskId;
  let taskName = log?.taskName?.trim();
  if (!taskName && taskId !== undefined) {
    taskName = taskNameMap.value[taskId];
  }
  if (taskName) {
    return taskName;
  }
  if (taskId === undefined) {
    return '-';
  }
  return String(taskId);
}

function getTaskIdText(log?: AdminTaskLogRow) {
  if (log?.taskId === undefined) {
    return '-';
  }
  return String(log.taskId);
}

function getCronDescription(expression?: string) {
  return formatCronDescription(expression) || $t('page.task.cronInvalidInline');
}

function getCronText(log?: AdminTaskLogRow) {
  const cron = log?.cronExpression?.trim();
  if (!cron) {
    return $t('page.task.cronManual');
  }
  return cron;
}

function getCronReadableText(log?: AdminTaskLogRow) {
  const cron = log?.cronExpression?.trim();
  if (!cron) {
    return $t('page.task.cronManual');
  }
  return getCronDescription(cron);
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

const [Grid] = useVbenVxeGrid<AdminTaskLogRow>({
  formOptions,
  gridClass: 'log-audit-grid',
  gridOptions,
});
</script>

<template>
  <Page auto-content-height>
    <Grid class="admin-task-log-grid-shell" :table-title="$t('menu.task.log')">
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
          <Descriptions.Item :label="$t('page.task.cronExpression')" :span="2">
            <span class="task-log-cron-inline">
              {{
                `${getCronText(currentLog)} (${getCronReadableText(currentLog)})`
              }}
            </span>
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

.task-log-cron-inline {
  font-family: Consolas, Monaco, monospace;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
  white-space: pre-wrap;
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

.admin-task-log-grid-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: calc(100vh - 240px);
}

.admin-task-log-grid-shell :deep(.vxe-grid),
.admin-task-log-grid-shell :deep(.vxe-grid--body-wrapper),
.admin-task-log-grid-shell :deep(.vxe-grid--table-wrapper),
.admin-task-log-grid-shell :deep(.vben-use-vxe-grid),
.admin-task-log-grid-shell :deep(.vben-vxe-grid) {
  min-height: 0;
}
</style>
