<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AdminLoginAuditLog,
  AdminLoginAuditLogActionType,
  AdminLoginAuditLogLoginMethod,
  AdminLoginAuditLogRiskLevel,
  AdminLoginAuditLogStatus,
} from '#/api/admin/login-audit-logs';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { listAdminLoginAuditLogsApi } from '#/api/admin/login-audit-logs';
import { $t } from '#/locales';
import { buildSearchFormOptions as buildGeneratedSearchFormOptions } from '#/views/generated/admin/app/log/login-audit-log.meta';

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

const { hasAccessByCodes } = useAccess();

const generatedFormOptions = buildGeneratedSearchFormOptions($t);

const formOptions: VbenFormProps = {
  ...generatedFormOptions,
  schema: (generatedFormOptions.schema || []).map((item) => {
    switch (item.fieldName) {
      case 'actionType': {
        return {
          ...item,
          componentProps: {
            ...item.componentProps,
            options: actionTypeOptions,
          },
        };
      }
      case 'riskLevel': {
        return {
          ...item,
          componentProps: {
            ...item.componentProps,
            options: riskLevelOptions,
          },
        };
      }
      case 'status': {
        return {
          ...item,
          componentProps: {
            ...item.componentProps,
            options: statusOptions,
          },
        };
      }
      default: {
        return item;
      }
    }
  }),
};

const gridOptions: VxeTableGridOptions<AdminLoginAuditLog> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.loginAuditLog.createdAt'),
      width: 150,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('page.loginAuditLog.status'),
      width: 110,
    },
    {
      field: 'username',
      sortable: true,
      title: $t('page.loginAuditLog.username'),
      width: 140,
    },
    {
      field: 'actionType',
      slots: { default: 'actionType' },
      title: $t('page.loginAuditLog.actionType'),
      width: 130,
    },
    {
      field: 'riskLevel',
      slots: { default: 'riskLevel' },
      title: $t('page.loginAuditLog.riskLevel'),
      width: 120,
    },
    {
      field: 'platformSummary',
      slots: { default: 'platformSummary' },
      title: $t('page.loginAuditLog.platform'),
      width: 170,
    },
    {
      field: 'geoLocationSummary',
      slots: { default: 'geoLocationSummary' },
      title: $t('page.loginAuditLog.geoLocation'),
      width: 240,
    },
    {
      field: 'ipAddress',
      title: $t('page.loginAuditLog.ipAddress'),
      width: 140,
    },
    {
      field: 'loginMethod',
      slots: { default: 'loginMethod' },
      title: $t('page.loginAuditLog.loginMethod'),
      width: 130,
    },
    {
      field: 'deviceInfo.userAgent',
      slots: { default: 'userAgent' },
      title: 'User-Agent',
      width: 280,
    },
  ],
  exportConfig: {
    filename: 'login-audit-logs',
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

        return await listAdminLoginAuditLogsApi({
          actionType: formValues.actionType,
          createdAtEnd: toFilterTimeValue(formValues.createdAtRange?.[1], true),
          createdAtStart: toFilterTimeValue(
            formValues.createdAtRange?.[0],
            false,
          ),
          ipAddress: formValues.ipAddress,
          page: page.currentPage,
          pageSize: page.pageSize,
          riskLevel: formValues.riskLevel,
          sorting: [
            {
              direction,
              field: sortField === 'createdAt' ? 'created_at' : sortField,
            },
          ],
          status: formValues.status,
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
    export: hasAccessByCodes([...LOGIN_AUDIT_ACCESS.export]),
    refresh: true,
    zoom: true,
  },
};

function getActionTypeText(value?: AdminLoginAuditLogActionType) {
  switch (value) {
    case 'KICKED_OUT': {
      return $t('page.loginAuditLog.actionKickedOut');
    }
    case 'LOGIN': {
      return $t('page.loginAuditLog.actionLogin');
    }
    case 'LOGOUT': {
      return $t('page.loginAuditLog.actionLogout');
    }
    case 'PASSWORD_RESET': {
      return $t('page.loginAuditLog.actionPasswordReset');
    }
    case 'SESSION_EXPIRED': {
      return $t('page.loginAuditLog.actionSessionExpired');
    }
    default: {
      return $t('page.loginAuditLog.unspecified');
    }
  }
}

function getRiskLevelText(value?: AdminLoginAuditLogRiskLevel) {
  switch (value) {
    case 'HIGH': {
      return $t('page.loginAuditLog.riskHigh');
    }
    case 'LOW': {
      return $t('page.loginAuditLog.riskLow');
    }
    case 'MEDIUM': {
      return $t('page.loginAuditLog.riskMedium');
    }
    default: {
      return $t('page.loginAuditLog.unspecified');
    }
  }
}

function getStatusText(value?: AdminLoginAuditLogStatus) {
  switch (value) {
    case 'FAILED': {
      return $t('page.loginAuditLog.statusFailed');
    }
    case 'LOCKED': {
      return $t('page.loginAuditLog.statusLocked');
    }
    case 'PARTIAL': {
      return $t('page.loginAuditLog.statusPartial');
    }
    case 'SUCCESS': {
      return $t('page.loginAuditLog.statusSuccess');
    }
    default: {
      return $t('page.loginAuditLog.unspecified');
    }
  }
}

function getStatusColor(value?: AdminLoginAuditLogStatus) {
  switch (value) {
    case 'FAILED': {
      return 'crimson';
    }
    case 'LOCKED':
    case 'PARTIAL': {
      return 'orange';
    }
    case 'SUCCESS': {
      return 'limegreen';
    }
    default: {
      return '#86909C';
    }
  }
}

function getActionTypeColor(value?: AdminLoginAuditLogActionType) {
  switch (value) {
    case 'KICKED_OUT':
    case 'PASSWORD_RESET':
    case 'SESSION_EXPIRED': {
      return 'orange';
    }
    case 'LOGIN': {
      return 'limegreen';
    }
    case 'LOGOUT': {
      return '#1890FF';
    }
    default: {
      return '#86909C';
    }
  }
}

function getRiskLevelColor(value?: AdminLoginAuditLogRiskLevel) {
  switch (value) {
    case 'HIGH': {
      return 'crimson';
    }
    case 'LOW': {
      return 'limegreen';
    }
    case 'MEDIUM': {
      return 'orange';
    }
    default: {
      return '#86909C';
    }
  }
}

function formatPlatform(record: AdminLoginAuditLog) {
  const values = [
    record.deviceInfo?.osName || record.deviceInfo?.platform,
    record.deviceInfo?.browserName,
  ]
    .map((item) => item?.trim())
    .filter(Boolean);

  return values.length > 0 ? values.join(' / ') : '-';
}

function formatGeoLocation(record: AdminLoginAuditLog) {
  const values = [
    record.geoLocation?.countryCode,
    record.geoLocation?.province,
    record.geoLocation?.city,
  ]
    .map((item) => item?.trim())
    .filter(Boolean);

  return values.length > 0 ? values.join(' / ') : '-';
}

function formatFailureReason(record: AdminLoginAuditLog) {
  return record.failureReason?.trim() || formatGeoLocation(record);
}

function formatLoginMethod(value?: string) {
  switch (value as AdminLoginAuditLogLoginMethod | undefined) {
    case 'BIOMETRIC': {
      return $t('page.loginAuditLog.methodBiometric');
    }
    case 'FIDO2': {
      return $t('page.loginAuditLog.methodFido2');
    }
    case 'OIDC_SOCIAL': {
      return $t('page.loginAuditLog.methodOidcSocial');
    }
    case 'PASSWORD': {
      return $t('page.loginAuditLog.methodPassword');
    }
    case 'QR_CODE': {
      return $t('page.loginAuditLog.methodQrCode');
    }
    case 'SMS_CODE': {
      return $t('page.loginAuditLog.methodSmsCode');
    }
    default: {
      return value?.trim() || '-';
    }
  }
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

const [Grid] = useVbenVxeGrid<AdminLoginAuditLog>({
  formOptions,
  gridClass: 'log-audit-grid',
  gridOptions,
});
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('menu.log.loginAuditLog')">
      <template #status="{ row }">
        <Tag :color="getStatusColor(row.status)">
          {{ getStatusText(row.status) }}
        </Tag>
      </template>

      <template #actionType="{ row }">
        <Tag :color="getActionTypeColor(row.actionType)">
          {{ getActionTypeText(row.actionType) }}
        </Tag>
      </template>

      <template #riskLevel="{ row }">
        <Tag :color="getRiskLevelColor(row.riskLevel)">
          {{ getRiskLevelText(row.riskLevel) }}
        </Tag>
      </template>

      <template #platformSummary="{ row }">
        <span :title="formatPlatform(row)">
          {{ formatPlatform(row) }}
        </span>
      </template>

      <template #geoLocationSummary="{ row }">
        <span :title="formatFailureReason(row)">
          {{ formatFailureReason(row) }}
        </span>
      </template>

      <template #loginMethod="{ row }">
        {{ formatLoginMethod(row.loginMethod) }}
      </template>

      <template #userAgent="{ row }">
        <span :title="row.deviceInfo?.userAgent || ''">
          {{ row.deviceInfo?.userAgent || '-' }}
        </span>
      </template>
    </Grid>
  </Page>
</template>
