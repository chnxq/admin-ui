<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AdminApiAuditLog } from '#/api/admin/api-audit-logs';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listAdminApiAuditLogsApi } from '#/api/admin/api-audit-logs';
import { $t } from '#/locales';

const API_AUDIT_ACCESS = {
  export: ['api:audit:logs:export'],
} as const;

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(
  (value) => ({
    label: value,
    value,
  }),
);

const { hasAccessByCodes } = useAccess();

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.apiAuditLog.searchUsername'),
      },
      fieldName: 'username',
      label: $t('page.apiAuditLog.username'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.apiAuditLog.searchPath'),
      },
      fieldName: 'path',
      label: $t('page.apiAuditLog.path'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: methodOptions,
        placeholder: $t('page.apiAuditLog.selectHttpMethod'),
      },
      fieldName: 'httpMethod',
      label: $t('page.apiAuditLog.httpMethod'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.apiAuditLog.searchApiModule'),
      },
      fieldName: 'apiModule',
      label: $t('page.apiAuditLog.apiModule'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        controls: false,
        placeholder: $t('page.apiAuditLog.searchStatusCode'),
      },
      fieldName: 'statusCode',
      label: $t('page.apiAuditLog.statusCode'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.apiAuditLog.searchReason'),
      },
      fieldName: 'reason',
      label: $t('page.apiAuditLog.reason'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<AdminApiAuditLog> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.apiAuditLog.createdAt'),
      width: 150,
    },
    {
      field: 'successSummary',
      slots: { default: 'successSummary' },
      title: $t('page.apiAuditLog.statusCode'),
      width: 120,
    },
    {
      field: 'username',
      sortable: true,
      title: $t('page.apiAuditLog.username'),
      width: 140,
    },
    {
      field: 'httpMethod',
      slots: { default: 'httpMethod' },
      title: $t('page.apiAuditLog.httpMethod'),
      width: 100,
    },
    {
      field: 'path',
      sortable: true,
      title: $t('page.apiAuditLog.path'),
      width: 260,
    },
    {
      field: 'latencyMs',
      slots: { default: 'latencyMs' },
      title: $t('page.apiAuditLog.latencyMs'),
      width: 120,
    },
    {
      field: 'platformSummary',
      slots: { default: 'platformSummary' },
      title: $t('page.apiAuditLog.platform'),
      width: 170,
    },
    {
      field: 'geoLocationSummary',
      slots: { default: 'geoLocationSummary' },
      title: $t('page.apiAuditLog.geoLocation'),
      width: 220,
    },
    {
      field: 'ipAddress',
      title: $t('page.apiAuditLog.ipAddress'),
      width: 140,
    },
    {
      field: 'apiOperation',
      title: $t('page.apiAuditLog.apiOperation'),
      width: 180,
    },
  ],
  exportConfig: {
    filename: 'api-audit-logs',
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
        const sortField = String(sort.field || 'createdAt');
        const direction = sort.order === 'asc' ? 'ASC' : 'DESC';

        return await listAdminApiAuditLogsApi({
          apiModule: formValues.apiModule,
          httpMethod: formValues.httpMethod,
          page: page.currentPage,
          pageSize: page.pageSize,
          path: formValues.path,
          reason: formValues.reason,
          sorting: [
            {
              direction,
              field: sortField === 'createdAt' ? 'created_at' : sortField,
            },
          ],
          statusCode: formValues.statusCode,
          username: formValues.username,
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
    export: hasAccessByCodes([...API_AUDIT_ACCESS.export]),
    refresh: true,
    zoom: true,
  },
};

function getMethodColor(method?: string) {
  switch (method) {
    case 'DELETE': {
      return 'crimson';
    }
    case 'GET': {
      return '#1890FF';
    }
    case 'PATCH':
    case 'PUT': {
      return 'orange';
    }
    case 'POST': {
      return 'limegreen';
    }
    default: {
      return '#86909C';
    }
  }
}

function getStatusCodeColor(statusCode?: number) {
  if (statusCode === undefined) {
    return '#86909C';
  }
  if (statusCode >= 500) {
    return 'crimson';
  }
  if (statusCode >= 400) {
    return 'orange';
  }
  if (statusCode >= 200 && statusCode < 400) {
    return 'limegreen';
  }
  return '#86909C';
}

function formatSuccess(record: AdminApiAuditLog) {
  if (record.success === false) {
    return `${$t('page.apiAuditLog.resultFailed')} (${record.statusCode ?? '-'})`;
  }
  return `${$t('page.apiAuditLog.resultSuccess')} (${record.statusCode ?? '-'})`;
}

function formatLatency(value?: number) {
  return value === undefined ? '-' : `${value}`;
}

function formatPlatform(record: AdminApiAuditLog) {
  const values = [
    record.deviceInfo?.osName || record.deviceInfo?.platform,
    record.deviceInfo?.browserName,
  ]
    .map((item) => item?.trim())
    .filter(Boolean);

  return values.length > 0 ? values.join(' / ') : '-';
}

function formatGeoLocation(record: AdminApiAuditLog) {
  const values = [
    record.geoLocation?.countryCode,
    record.geoLocation?.province,
    record.geoLocation?.city,
  ]
    .map((item) => item?.trim())
    .filter(Boolean);

  return values.length > 0 ? values.join(' / ') : '-';
}

const [Grid] = useVbenVxeGrid<AdminApiAuditLog>({
  formOptions,
  gridClass: 'log-audit-grid',
  gridOptions,
});
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('menu.log.apiAuditLog')">
      <template #successSummary="{ row }">
        <Tag :color="getStatusCodeColor(row.statusCode)">
          {{ formatSuccess(row) }}
        </Tag>
      </template>

      <template #httpMethod="{ row }">
        <Tag :color="getMethodColor(row.httpMethod)">
          {{ row.httpMethod || '-' }}
        </Tag>
      </template>

      <template #latencyMs="{ row }">
        {{ formatLatency(row.latencyMs) }}
      </template>

      <template #platformSummary="{ row }">
        <span :title="formatPlatform(row)">
          {{ formatPlatform(row) }}
        </span>
      </template>

      <template #geoLocationSummary="{ row }">
        <span :title="formatGeoLocation(row)">
          {{ formatGeoLocation(row) }}
        </span>
      </template>
    </Grid>
  </Page>
</template>
