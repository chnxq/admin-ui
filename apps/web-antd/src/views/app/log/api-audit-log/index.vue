<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { AdminApiAuditLog } from '#/api/admin/api-audit-logs';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { listAdminApiAuditLogsApi } from '#/api/admin/api-audit-logs';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

type ApiAuditLogRecord = AdminApiAuditLog | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const API_AUDIT_ACCESS = {
  export: ['api:audit:logs:export'],
} as const;

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(
  (value) => ({
    label: value,
    value,
  }),
);

const columns: AdminTableColumn<AdminApiAuditLog>[] = [
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.apiAuditLog.createdAt'),
    width: 170,
  },
  {
    dataIndex: 'httpMethod',
    key: 'httpMethod',
    title: $t('page.apiAuditLog.httpMethod'),
    width: 90,
  },
  {
    dataIndex: 'path',
    sortable: true,
    sorter: true,
    title: $t('page.apiAuditLog.path'),
    width: 240,
  },
  {
    dataIndex: 'username',
    sortable: true,
    sorter: true,
    title: $t('page.apiAuditLog.username'),
    width: 140,
  },
  {
    dataIndex: 'apiModule',
    key: 'apiModule',
    title: $t('page.apiAuditLog.apiModule'),
    width: 120,
  },
  {
    dataIndex: 'apiOperation',
    key: 'apiOperation',
    title: $t('page.apiAuditLog.apiOperation'),
    width: 180,
  },
  {
    dataIndex: 'statusCode',
    key: 'statusCode',
    sortable: true,
    sorter: true,
    title: $t('page.apiAuditLog.statusCode'),
    width: 100,
  },
  {
    dataIndex: 'latencyMs',
    key: 'latencyMs',
    sortable: true,
    sorter: true,
    title: $t('page.apiAuditLog.latencyMs'),
    width: 120,
  },
  {
    dataIndex: 'ipAddress',
    key: 'ipAddress',
    title: 'IP',
    width: 140,
  },
  {
    dataIndex: 'requestId',
    key: 'requestId',
    title: $t('page.apiAuditLog.requestId'),
    width: 220,
  },
  {
    dataIndex: 'reason',
    key: 'reason',
    title: $t('page.apiAuditLog.reason'),
    width: 240,
  },
];

const loading = ref(false);
const tableSurfaceRef = ref<HTMLElement>();
const logs = ref<AdminApiAuditLog[]>([]);
const sorting = ref<AdminTableSorting[]>([
  { direction: 'DESC', field: 'created_at' },
]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

const searchForm = reactive({
  apiModule: '',
  httpMethod: undefined as string | undefined,
  path: '',
  reason: '',
  statusCode: undefined as number | undefined,
  username: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const displayColumns = computed<TableColumnsType<AdminApiAuditLog>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.apiAuditLog.total')} ${total}`,
  total: pager.total,
}));

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

function getMethodColor(method?: string) {
  switch (method) {
    case 'DELETE': {
      return 'error';
    }
    case 'GET': {
      return 'processing';
    }
    case 'PATCH':
    case 'PUT': {
      return 'warning';
    }
    case 'POST': {
      return 'success';
    }
    default: {
      return 'default';
    }
  }
}

function getStatusCodeColor(statusCode?: number) {
  if (statusCode === undefined) {
    return 'default';
  }
  if (statusCode >= 500) {
    return 'error';
  }
  if (statusCode >= 400) {
    return 'warning';
  }
  if (statusCode >= 200 && statusCode < 400) {
    return 'success';
  }
  return 'default';
}

function formatLatency(value?: number) {
  return value === undefined ? '-' : `${value}`;
}

function formatReason(record: ApiAuditLogRecord) {
  const item = record as AdminApiAuditLog;
  if (item.reason?.trim()) {
    return item.reason.trim();
  }
  return item.success === false
    ? $t('page.apiAuditLog.resultFailed')
    : $t('page.apiAuditLog.resultSuccess');
}

async function loadLogs() {
  loading.value = true;
  try {
    const response = await listAdminApiAuditLogsApi({
      apiModule: searchForm.apiModule,
      httpMethod: searchForm.httpMethod,
      page: pager.page,
      pageSize: pager.pageSize,
      path: searchForm.path,
      reason: searchForm.reason,
      sorting: sorting.value,
      statusCode: searchForm.statusCode,
      username: searchForm.username,
    });
    logs.value = response.items;
    pager.total = response.total;
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  pager.page = 1;
  await loadLogs();
}

async function handleReset() {
  searchForm.apiModule = '';
  searchForm.httpMethod = undefined;
  searchForm.path = '';
  searchForm.reason = '';
  searchForm.statusCode = undefined;
  searchForm.username = '';
  pager.page = 1;
  sorting.value = [{ direction: 'DESC', field: 'created_at' }];
  await loadLogs();
}

async function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  const nextSorting = toAdminTableSorting(sorter as any);
  sorting.value =
    nextSorting.length > 0
      ? nextSorting
      : [{ direction: 'DESC', field: 'created_at' }];
  await loadLogs();
}

onMounted(() => {
  loadLogs();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.log.apiAuditLog')">
    <div ref="tableSurfaceRef" class="admin-log-surface">
      <div class="admin-log-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item :label="$t('page.apiAuditLog.username')" name="username">
            <Input
              v-model:value="searchForm.username"
              allow-clear
              :placeholder="$t('page.apiAuditLog.searchUsername')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.apiAuditLog.httpMethod')" name="httpMethod">
            <Select
              v-model:value="searchForm.httpMethod"
              allow-clear
              :options="methodOptions"
              :placeholder="$t('page.apiAuditLog.selectHttpMethod')"
              style="width: 120px"
            />
          </Form.Item>
          <Form.Item :label="$t('page.apiAuditLog.path')" name="path">
            <Input
              v-model:value="searchForm.path"
              allow-clear
              :placeholder="$t('page.apiAuditLog.searchPath')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.apiAuditLog.apiModule')" name="apiModule">
            <Input
              v-model:value="searchForm.apiModule"
              allow-clear
              :placeholder="$t('page.apiAuditLog.searchApiModule')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.apiAuditLog.statusCode')" name="statusCode">
            <InputNumber
              v-model:value="searchForm.statusCode"
              :controls="false"
              :placeholder="$t('page.apiAuditLog.searchStatusCode')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.apiAuditLog.reason')" name="reason">
            <Input
              v-model:value="searchForm.reason"
              allow-clear
              :placeholder="$t('page.apiAuditLog.searchReason')"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button html-type="submit" type="primary">
                <template #icon>
                  <IconifyIcon icon="lucide:search" />
                </template>
                {{ $t('common.search') }}
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

        <AdminTableToolbar
          v-model:column-keys="visibleColumnKeys"
          :columns="columns"
          :data-source="logs"
          :export-access-codes="API_AUDIT_ACCESS.export"
          file-name="api-audit-logs"
          :fullscreen-target="tableSurfaceRef"
          :refresh="loadLogs"
          storage-key="app-api-audit-log-list"
        />
      </div>

      <Table
        class="admin-log-table"
        :columns="displayColumns"
        :data-source="logs"
        :loading="loading"
        :pagination="tablePagination"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>

          <template v-else-if="column.key === 'httpMethod'">
            <Tag :color="getMethodColor(record.httpMethod)">
              {{ record.httpMethod || '-' }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'statusCode'">
            <Tag :color="getStatusCodeColor(record.statusCode)">
              {{ record.statusCode ?? '-' }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'latencyMs'">
            {{ formatLatency(record.latencyMs) }}
          </template>

          <template v-else-if="column.key === 'reason'">
            <span :title="formatReason(record)">
              {{ formatReason(record) }}
            </span>
          </template>
        </template>
      </Table>
    </div>
  </Page>
</template>

<style scoped>
.admin-log-surface {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  padding: 16px;
  overflow-y: auto;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-log-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.admin-log-table {
  flex: 1;
  min-height: 0;
}

@media (max-width: 640px) {
  .admin-log-surface {
    padding: 12px;
  }

  .admin-log-toolbar {
    align-items: stretch;
  }
}
</style>
