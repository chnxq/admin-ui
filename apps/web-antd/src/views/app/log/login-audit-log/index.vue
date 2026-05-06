<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type {
  AdminLoginAuditLog,
  AdminLoginAuditLogActionType,
  AdminLoginAuditLogRiskLevel,
  AdminLoginAuditLogStatus,
} from '#/api/admin/login-audit-logs';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Form, Input, Select, Space, Table, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { listAdminLoginAuditLogsApi } from '#/api/admin/login-audit-logs';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

type LoginAuditLogRecord = AdminLoginAuditLog | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const LOGIN_AUDIT_ACCESS = {
  export: ['login:audit:logs:export'],
} as const;

const actionTypeOptions: Array<{
  label: string;
  value: AdminLoginAuditLogActionType;
}> = [
  { label: $t('page.loginAuditLog.actionLogin'), value: 'LOGIN' },
  { label: $t('page.loginAuditLog.actionLogout'), value: 'LOGOUT' },
  {
    label: $t('page.loginAuditLog.actionSessionExpired'),
    value: 'SESSION_EXPIRED',
  },
  { label: $t('page.loginAuditLog.actionKickedOut'), value: 'KICKED_OUT' },
  {
    label: $t('page.loginAuditLog.actionPasswordReset'),
    value: 'PASSWORD_RESET',
  },
];

const riskLevelOptions: Array<{
  label: string;
  value: AdminLoginAuditLogRiskLevel;
}> = [
  { label: $t('page.loginAuditLog.riskLow'), value: 'LOW' },
  { label: $t('page.loginAuditLog.riskMedium'), value: 'MEDIUM' },
  { label: $t('page.loginAuditLog.riskHigh'), value: 'HIGH' },
];

const statusOptions: Array<{ label: string; value: AdminLoginAuditLogStatus }> =
  [
    { label: $t('page.loginAuditLog.statusSuccess'), value: 'SUCCESS' },
    { label: $t('page.loginAuditLog.statusFailed'), value: 'FAILED' },
    { label: $t('page.loginAuditLog.statusPartial'), value: 'PARTIAL' },
    { label: $t('page.loginAuditLog.statusLocked'), value: 'LOCKED' },
  ];

const actionTypeTextMap: Record<AdminLoginAuditLogActionType, string> = {
  ACTION_TYPE_UNSPECIFIED: $t('page.loginAuditLog.unspecified'),
  KICKED_OUT: $t('page.loginAuditLog.actionKickedOut'),
  LOGIN: $t('page.loginAuditLog.actionLogin'),
  LOGOUT: $t('page.loginAuditLog.actionLogout'),
  PASSWORD_RESET: $t('page.loginAuditLog.actionPasswordReset'),
  SESSION_EXPIRED: $t('page.loginAuditLog.actionSessionExpired'),
};

const riskLevelTextMap: Record<AdminLoginAuditLogRiskLevel, string> = {
  HIGH: $t('page.loginAuditLog.riskHigh'),
  LOW: $t('page.loginAuditLog.riskLow'),
  MEDIUM: $t('page.loginAuditLog.riskMedium'),
  RISK_LEVEL_UNSPECIFIED: $t('page.loginAuditLog.unspecified'),
};

const statusTextMap: Record<AdminLoginAuditLogStatus, string> = {
  FAILED: $t('page.loginAuditLog.statusFailed'),
  LOCKED: $t('page.loginAuditLog.statusLocked'),
  PARTIAL: $t('page.loginAuditLog.statusPartial'),
  STATUS_UNSPECIFIED: $t('page.loginAuditLog.unspecified'),
  SUCCESS: $t('page.loginAuditLog.statusSuccess'),
};

const columns: AdminTableColumn<AdminLoginAuditLog>[] = [
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.loginAuditLog.createdAt'),
    width: 170,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.loginAuditLog.status'),
    width: 100,
  },
  {
    dataIndex: 'username',
    sortable: true,
    sorter: true,
    title: $t('page.loginAuditLog.username'),
    width: 140,
  },
  {
    dataIndex: 'actionType',
    key: 'actionType',
    title: $t('page.loginAuditLog.actionType'),
    width: 120,
  },
  {
    dataIndex: 'riskLevel',
    key: 'riskLevel',
    title: $t('page.loginAuditLog.riskLevel'),
    width: 110,
  },
  {
    dataIndex: 'ipAddress',
    key: 'ipAddress',
    title: $t('page.loginAuditLog.ipAddress'),
    width: 140,
  },
  {
    dataIndex: 'loginMethod',
    key: 'loginMethod',
    title: $t('page.loginAuditLog.loginMethod'),
    width: 120,
  },
  {
    dataIndex: 'deviceInfo.platform',
    key: 'platform',
    title: $t('page.loginAuditLog.platform'),
    width: 120,
  },
  {
    dataIndex: 'deviceInfo.userAgent',
    key: 'userAgent',
    title: 'User-Agent',
    width: 280,
  },
  {
    dataIndex: 'failureReason',
    key: 'failureReason',
    title: $t('page.loginAuditLog.failureReason'),
    width: 220,
  },
];

const loading = ref(false);
const tableSurfaceRef = ref<HTMLElement>();
const logs = ref<AdminLoginAuditLog[]>([]);
const sorting = ref<AdminTableSorting[]>([
  { direction: 'DESC', field: 'created_at' },
]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

const searchForm = reactive({
  actionType: undefined as AdminLoginAuditLogActionType | undefined,
  ipAddress: '',
  riskLevel: undefined as AdminLoginAuditLogRiskLevel | undefined,
  status: undefined as AdminLoginAuditLogStatus | undefined,
  username: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const displayColumns = computed<TableColumnsType<AdminLoginAuditLog>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.loginAuditLog.total')} ${total}`,
  total: pager.total,
}));

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

function getActionTypeText(value?: AdminLoginAuditLogActionType) {
  return value ? actionTypeTextMap[value] ?? value : '-';
}

function getRiskLevelText(value?: AdminLoginAuditLogRiskLevel) {
  return value ? riskLevelTextMap[value] ?? value : '-';
}

function getStatusText(value?: AdminLoginAuditLogStatus) {
  return value ? statusTextMap[value] ?? value : '-';
}

function getStatusColor(value?: AdminLoginAuditLogStatus) {
  switch (value) {
    case 'FAILED':
    case 'LOCKED': {
      return 'error';
    }
    case 'PARTIAL': {
      return 'warning';
    }
    case 'SUCCESS': {
      return 'success';
    }
    default: {
      return 'default';
    }
  }
}

function getRiskLevelColor(value?: AdminLoginAuditLogRiskLevel) {
  switch (value) {
    case 'HIGH': {
      return 'error';
    }
    case 'MEDIUM': {
      return 'warning';
    }
    case 'LOW': {
      return 'success';
    }
    default: {
      return 'default';
    }
  }
}

function formatGeoLocation(record: LoginAuditLogRecord) {
  const location = (record as AdminLoginAuditLog).geoLocation;
  const values = [location?.countryCode, location?.province, location?.city]
    .map((item) => item?.trim())
    .filter(Boolean);
  return values.length > 0 ? values.join(' / ') : '-';
}

async function loadLogs() {
  loading.value = true;
  try {
    const response = await listAdminLoginAuditLogsApi({
      actionType: searchForm.actionType,
      ipAddress: searchForm.ipAddress,
      page: pager.page,
      pageSize: pager.pageSize,
      riskLevel: searchForm.riskLevel,
      sorting: sorting.value,
      status: searchForm.status,
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
  searchForm.actionType = undefined;
  searchForm.ipAddress = '';
  searchForm.riskLevel = undefined;
  searchForm.status = undefined;
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
  <Page auto-content-height :title="$t('menu.log.loginAuditLog')">
    <div ref="tableSurfaceRef" class="admin-log-surface">
      <div class="admin-log-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item :label="$t('page.loginAuditLog.username')" name="username">
            <Input
              v-model:value="searchForm.username"
              allow-clear
              :placeholder="$t('page.loginAuditLog.searchUsername')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.loginAuditLog.ipAddress')" name="ipAddress">
            <Input
              v-model:value="searchForm.ipAddress"
              allow-clear
              :placeholder="$t('page.loginAuditLog.searchIpAddress')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.loginAuditLog.actionType')" name="actionType">
            <Select
              v-model:value="searchForm.actionType"
              allow-clear
              :options="actionTypeOptions"
              :placeholder="$t('page.loginAuditLog.selectActionType')"
              style="width: 140px"
            />
          </Form.Item>
          <Form.Item :label="$t('page.loginAuditLog.riskLevel')" name="riskLevel">
            <Select
              v-model:value="searchForm.riskLevel"
              allow-clear
              :options="riskLevelOptions"
              :placeholder="$t('page.loginAuditLog.selectRiskLevel')"
              style="width: 120px"
            />
          </Form.Item>
          <Form.Item :label="$t('page.loginAuditLog.status')" name="status">
            <Select
              v-model:value="searchForm.status"
              allow-clear
              :options="statusOptions"
              :placeholder="$t('page.loginAuditLog.selectStatus')"
              style="width: 120px"
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
          :export-access-codes="LOGIN_AUDIT_ACCESS.export"
          file-name="login-audit-logs"
          :fullscreen-target="tableSurfaceRef"
          :refresh="loadLogs"
          storage-key="app-login-audit-log-list"
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

          <template v-else-if="column.key === 'status'">
            <Tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'actionType'">
            {{ getActionTypeText(record.actionType) }}
          </template>

          <template v-else-if="column.key === 'riskLevel'">
            <Tag :color="getRiskLevelColor(record.riskLevel)">
              {{ getRiskLevelText(record.riskLevel) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'platform'">
            {{ record.deviceInfo?.platform || '-' }}
          </template>

          <template v-else-if="column.key === 'userAgent'">
            <span :title="record.deviceInfo?.userAgent || ''">
              {{ record.deviceInfo?.userAgent || '-' }}
            </span>
          </template>

          <template v-else-if="column.key === 'failureReason'">
            <span :title="record.failureReason || formatGeoLocation(record)">
              {{ record.failureReason || formatGeoLocation(record) }}
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
