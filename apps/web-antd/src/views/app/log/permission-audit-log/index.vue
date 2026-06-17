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
import {
  buildListGridColumns as buildGeneratedListGridColumns,
  buildSearchFormOptions as buildGeneratedSearchFormOptions,
} from '#/views/generated/admin/app/log/permission-audit-log.meta';

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

const generatedFormOptions = buildGeneratedSearchFormOptions($t);

const formOptions: VbenFormProps = {
  ...generatedFormOptions,
  schema: (generatedFormOptions.schema || []).map((item) => {
    if (item.fieldName === 'action') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          options: actionOptions,
        },
      };
    }
    return item;
  }),
};

const generatedColumns = buildGeneratedListGridColumns($t) ?? [];

const gridOptions: VxeTableGridOptions<AdminPermissionAuditLog> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: generatedColumns.map((column) => {
    switch (column.field) {
      case 'action': {
        return {
          ...column,
          slots: { default: 'action' },
        };
      }
      case 'createdAt': {
        return {
          ...column,
          formatter: 'formatDateTime',
        };
      }
      case 'newValue': {
        return {
          ...column,
          slots: { default: 'newValue' },
        };
      }
      case 'oldValue': {
        return {
          ...column,
          slots: { default: 'oldValue' },
        };
      }
      case 'reason': {
        return {
          ...column,
          slots: { default: 'reason' },
        };
      }
      default: {
        return column;
      }
    }
  }),
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
          createdAtStart: toFilterTimeValue(
            formValues.createdAtRange?.[0],
            false,
          ),
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
  return (
    endOfSecond ? parsed.endOf('second') : parsed.startOf('second')
  ).toISOString();
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
