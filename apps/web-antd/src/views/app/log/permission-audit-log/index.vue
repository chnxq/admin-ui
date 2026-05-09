<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AdminPermissionAuditLog,
  AdminPermissionAuditLogActionType,
} from '#/api/admin/permission-audit-logs';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listAdminPermissionAuditLogsApi } from '#/api/admin/permission-audit-logs';
import { $t } from '#/locales';

const PERMISSION_AUDIT_ACCESS = {
  export: ['permission:audit:logs:export'],
} as const;

const { hasAccessByCodes } = useAccess();

const actionOptions: Array<{
  label: string;
  value: AdminPermissionAuditLogActionType;
}> = [
  { label: $t('page.permissionAuditLog.actionCreate'), value: 'CREATE' },
  { label: $t('page.permissionAuditLog.actionUpdate'), value: 'UPDATE' },
  { label: $t('page.permissionAuditLog.actionDelete'), value: 'DELETE' },
  { label: $t('page.permissionAuditLog.actionAssign'), value: 'ASSIGN' },
  { label: $t('page.permissionAuditLog.actionGrant'), value: 'GRANT' },
  { label: $t('page.permissionAuditLog.actionRevoke'), value: 'REVOKE' },
];

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.permissionAuditLog.searchTargetType'),
      },
      fieldName: 'targetType',
      label: $t('page.permissionAuditLog.targetType'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.permissionAuditLog.searchOperatorName'),
      },
      fieldName: 'operatorName',
      label: $t('page.permissionAuditLog.operatorName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: actionOptions,
        placeholder: $t('page.permissionAuditLog.selectAction'),
      },
      fieldName: 'action',
      label: $t('page.permissionAuditLog.action'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.permissionAuditLog.searchIpAddress'),
      },
      fieldName: 'ipAddress',
      label: $t('page.permissionAuditLog.ipAddress'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.permissionAuditLog.searchReason'),
      },
      fieldName: 'reason',
      label: $t('page.permissionAuditLog.reason'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        allowClear: true,
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'createdAtRange',
      label: $t('page.permissionAuditLog.createdAtRange'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<AdminPermissionAuditLog> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.permissionAuditLog.createdAt'),
      width: 150,
    },
    {
      field: 'action',
      slots: { default: 'action' },
      title: $t('page.permissionAuditLog.action'),
      width: 120,
    },
    {
      field: 'targetType',
      title: $t('page.permissionAuditLog.targetType'),
      width: 140,
    },
    {
      field: 'targetName',
      title: $t('page.permissionAuditLog.targetName'),
      width: 180,
    },
    {
      field: 'operatorName',
      title: $t('page.permissionAuditLog.operatorName'),
      width: 140,
    },
    {
      field: 'ipAddress',
      title: $t('page.permissionAuditLog.ipAddress'),
      width: 140,
    },
    {
      field: 'reason',
      slots: { default: 'reason' },
      title: $t('page.permissionAuditLog.reason'),
      width: 220,
    },
    {
      field: 'oldValue',
      slots: { default: 'oldValue' },
      title: $t('page.permissionAuditLog.oldValue'),
      width: 280,
    },
    {
      field: 'newValue',
      slots: { default: 'newValue' },
      title: $t('page.permissionAuditLog.newValue'),
      width: 280,
    },
  ],
  exportConfig: {
    filename: 'permission-audit-logs',
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

        return await listAdminPermissionAuditLogsApi({
          action: formValues.action,
          createdAtEnd: toFilterTimeValue(formValues.createdAtRange?.[1], true),
          createdAtStart: toFilterTimeValue(formValues.createdAtRange?.[0], false),
          ipAddress: formValues.ipAddress,
          operatorName: formValues.operatorName,
          page: page.currentPage,
          pageSize: page.pageSize,
          reason: formValues.reason,
          sorting: [
            {
              direction,
              field: sortField === 'createdAt' ? 'created_at' : sortField,
            },
          ],
          targetType: formValues.targetType,
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
    export: hasAccessByCodes([...PERMISSION_AUDIT_ACCESS.export]),
    refresh: true,
    zoom: true,
  },
};

function getActionText(value?: AdminPermissionAuditLogActionType) {
  switch (value) {
    case 'ASSIGN': {
      return $t('page.permissionAuditLog.actionAssign');
    }
    case 'CREATE': {
      return $t('page.permissionAuditLog.actionCreate');
    }
    case 'DELETE': {
      return $t('page.permissionAuditLog.actionDelete');
    }
    case 'GRANT': {
      return $t('page.permissionAuditLog.actionGrant');
    }
    case 'REVOKE': {
      return $t('page.permissionAuditLog.actionRevoke');
    }
    case 'UPDATE': {
      return $t('page.permissionAuditLog.actionUpdate');
    }
    default: {
      return value || $t('page.permissionAuditLog.unspecified');
    }
  }
}

function getActionColor(value?: AdminPermissionAuditLogActionType) {
  switch (value) {
    case 'ASSIGN':
    case 'GRANT':
    case 'UPDATE': {
      return '#1890FF';
    }
    case 'CREATE': {
      return 'limegreen';
    }
    case 'DELETE':
    case 'REVOKE': {
      return 'crimson';
    }
    default: {
      return '#86909C';
    }
  }
}

function formatJsonText(value?: string) {
  const text = value?.trim();
  return text || '-';
}

function toFilterTimeValue(value?: string, endOfSecond = false) {
  if (!value) {
    return undefined;
  }
  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return undefined;
  }
  return (endOfSecond ? parsed.endOf('second') : parsed.startOf('second')).toISOString();
}

const [Grid] = useVbenVxeGrid<AdminPermissionAuditLog>({
  formOptions,
  gridClass: 'log-audit-grid',
  gridOptions,
});
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('menu.log.permissionAuditLog')">
      <template #action="{ row }">
        <Tag :color="getActionColor(row.action)">
          {{ getActionText(row.action) }}
        </Tag>
      </template>

      <template #reason="{ row }">
        <span :title="row.reason || ''">
          {{ row.reason || '-' }}
        </span>
      </template>

      <template #oldValue="{ row }">
        <span :title="formatJsonText(row.oldValue)">
          {{ formatJsonText(row.oldValue) }}
        </span>
      </template>

      <template #newValue="{ row }">
        <span :title="formatJsonText(row.newValue)">
          {{ formatJsonText(row.newValue) }}
        </span>
      </template>
    </Grid>
  </Page>
</template>
