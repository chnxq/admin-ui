<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AdminApi,
  AdminApiSaveInput,
  AdminApiScope,
  AdminApiStatus,
} from '#/api/admin/apis';

import { computed, nextTick, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Form, message, Modal, Popconfirm, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAdminApiApi,
  deleteAdminApiApi,
  listAdminApisApi,
  syncAdminApisApi,
  updateAdminApiApi,
} from '#/api/admin/apis';
import AdminGeneratedForm from '#/components/admin-generated-form/index.vue';
import { $t } from '#/locales';
import {
  buildFormOptions as buildGeneratedDialogFormOptions,
  buildListGridColumns as buildGeneratedListGridColumns,
  buildSearchFormOptions as buildGeneratedSearchFormOptions,
} from '#/views/generated/admin/system/api.meta';

interface AdminApiFormModel extends AdminApiSaveInput {
  method: string;
  path: string;
  scope: AdminApiScope;
  status: AdminApiStatus;
}

const API_ACCESS = {
  create: ['apis:create'],
  delete: ['apis:delete'],
  edit: ['apis:edit'],
  export: ['apis:export'],
  sync: ['apis:sync:create'],
} as const;

const methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(
  (value) => ({
    label: value,
    value,
  }),
);

const scopeOptions = [
  { label: $t('enum.api.scope.ADMIN'), value: 'ADMIN' },
  { label: $t('enum.api.scope.APP'), value: 'APP' },
];

const statusOptions = [
  { label: $t('enum.status.ON'), value: 'ON' },
  { label: $t('enum.status.OFF'), value: 'OFF' },
];

const statusTextMap: Record<AdminApiStatus, string> = {
  OFF: $t('enum.status.OFF'),
  ON: $t('enum.status.ON'),
};

const scopeTextMap: Record<AdminApiScope, string> = {
  ADMIN: $t('enum.api.scope.ADMIN'),
  API_SCOPE_INVALID: $t('enum.api.scope.API_SCOPE_INVALID'),
  APP: $t('enum.api.scope.APP'),
};

const syncing = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref();

const formModel = reactive<AdminApiFormModel>({
  description: '',
  method: 'GET',
  module: '',
  moduleDescription: '',
  operation: '',
  path: '',
  scope: 'ADMIN',
  status: 'ON',
});

const modalTitle = computed(() =>
  editingId.value ? $t('page.api.editTitle') : $t('page.api.createTitle'),
);

const generatedFormOptions = buildGeneratedSearchFormOptions($t);
const generatedDialogFormOptions = buildGeneratedDialogFormOptions($t);

const formOptions: VbenFormProps = {
  ...generatedFormOptions,
  schema: (generatedFormOptions.schema || []).map((item) => {
    if (item.fieldName === 'method') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          options: methodOptions,
        },
      };
    }
    return item;
  }),
};

const dialogFormSchema = computed(() =>
  (generatedDialogFormOptions.schema || []).map((item: any) => {
    const fieldName = item.fieldName;
    if (fieldName === 'path') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          placeholder: $t('page.api.placeholderPath'),
        },
        rules: [
          {
            message: $t('ui.formRules.required', [$t('page.api.path')]),
            required: true,
          },
        ],
      };
    }
    if (fieldName === 'method') {
      return {
        ...item,
        component: 'Select',
        componentProps: {
          ...item.componentProps,
          options: methodOptions,
        },
        rules: [
          {
            message: $t('ui.formRules.selectRequired', [$t('page.api.method')]),
            required: true,
          },
        ],
      };
    }
    if (fieldName === 'scope') {
      return {
        ...item,
        component: 'Select',
        componentProps: {
          ...item.componentProps,
          options: scopeOptions,
        },
        rules: [
          {
            message: $t('ui.formRules.selectRequired', [$t('page.api.scope')]),
            required: true,
          },
        ],
      };
    }
    if (fieldName === 'status') {
      return {
        ...item,
        component: 'Select',
        componentProps: {
          ...item.componentProps,
          options: statusOptions,
        },
        rules: [
          {
            message: $t('ui.formRules.selectRequired', [$t('page.api.status')]),
            required: true,
          },
        ],
      };
    }
    const placeholderMap: Record<string, string> = {
      description: $t('page.api.placeholderDescription'),
      module: $t('page.api.placeholderModule'),
      moduleDescription: $t('page.api.placeholderModuleDescription'),
      operation: $t('page.api.placeholderOperation'),
    };
    return {
      ...item,
      componentProps: {
        ...item.componentProps,
        placeholder: fieldName ? placeholderMap[fieldName] : undefined,
      },
    };
  }),
);

const generatedColumns = buildGeneratedListGridColumns($t) ?? [];

const gridOptions: VxeTableGridOptions<AdminApi> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    ...generatedColumns,
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 150,
    },
  ],
  exportConfig: {
    filename: 'system-apis',
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
        const sortField = String(sort.field || 'id');
        const direction = sort.order === 'asc' ? 'ASC' : 'DESC';

        return await listAdminApisApi({
          method: formValues.method,
          module: formValues.module,
          page: page.currentPage,
          pageSize: page.pageSize,
          path: formValues.path,
          sorting: [
            {
              direction,
              field: sortField === 'createdAt' ? 'created_at' : sortField,
            },
          ],
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
    export: true,
    refresh: true,
    slots: {
      toolPrefix: 'toolPrefix',
    },
    zoom: true,
  },
};

function resetFormModel() {
  Object.assign(formModel, {
    description: '',
    method: 'GET',
    module: '',
    moduleDescription: '',
    operation: '',
    path: '',
    scope: 'ADMIN',
    status: 'ON',
  });
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
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

function getStatusText(status?: AdminApiStatus) {
  return status ? statusTextMap[status] : '-';
}

function getStatusColor(status?: AdminApiStatus) {
  return status === 'ON' ? 'success' : 'error';
}

function getScopeText(scope?: AdminApiScope) {
  return scope ? scopeTextMap[scope] : '-';
}

async function openCreate() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEdit(record: AdminApi) {
  if (!record.id) {
    message.warning($t('page.api.missingId'));
    return;
  }

  editingId.value = record.id;
  Object.assign(formModel, {
    description: record.description ?? '',
    method: record.method ?? 'GET',
    module: record.module ?? '',
    moduleDescription: record.moduleDescription ?? '',
    operation: record.operation ?? '',
    path: record.path ?? '',
    scope: record.scope ?? 'ADMIN',
    status: record.status ?? 'ON',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitApi() {
  await formRef.value?.validate();

  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminApiApi(editingId.value, formModel);
      message.success($t('page.api.updateSuccess'));
    } else {
      await createAdminApiApi(formModel);
      message.success($t('page.api.createSuccess'));
    }
    modalOpen.value = false;
    gridApi.reload();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminApi) {
  if (!record.id) {
    message.warning($t('page.api.missingId'));
    return;
  }

  await deleteAdminApiApi(record.id);
  message.success($t('page.api.deleteSuccess'));
  gridApi.reload();
}

async function handleSync() {
  syncing.value = true;
  try {
    await syncAdminApisApi();
    message.success($t('page.api.syncSuccess'));
    await gridApi.reload();
  } finally {
    syncing.value = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid<AdminApi>({
  formOptions,
  gridOptions,
  gridClass: 'admin-api-grid',
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.api')">
    <Grid :table-title="$t('menu.system.api')">
      <template #toolPrefix>
        <div class="admin-api-tool-prefix">
          <div class="admin-api-tool-prefix__item">
            <Popconfirm
              :title="$t('page.api.syncConfirm')"
              @confirm="handleSync"
            >
              <Button v-access:code="API_ACCESS.sync" :loading="syncing">
                <template #icon>
                  <IconifyIcon icon="lucide:refresh-cw" />
                </template>
                {{ $t('page.api.syncButton') }}
              </Button>
            </Popconfirm>
          </div>
          <div class="admin-api-tool-prefix__item">
            <Button
              v-access:code="API_ACCESS.create"
              type="primary"
              @click="openCreate"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              {{ $t('page.api.createTitle') }}
            </Button>
          </div>
        </div>
      </template>

      <template #method="{ row }">
        <Tag :color="getMethodColor(row.method)">
          {{ row.method || '-' }}
        </Tag>
      </template>

      <template #scope="{ row }">
        <Tag>{{ getScopeText(row.scope) }}</Tag>
      </template>

      <template #status="{ row }">
        <Tag :color="getStatusColor(row.status)">
          {{ getStatusText(row.status) }}
        </Tag>
      </template>

      <template #createdAt="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>

      <template #action="{ row }">
        <Space>
          <Button
            v-access:code="API_ACCESS.edit"
            size="small"
            type="link"
            @click="openEdit(row)"
          >
            <template #icon>
              <IconifyIcon icon="lucide:pencil" />
            </template>
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            :title="
              $t('ui.actionMessage.deleteConfirm', [$t('page.api.moduleName')])
            "
            @confirm="handleDelete(row)"
          >
            <Button
              v-access:code="API_ACCESS.delete"
              danger
              size="small"
              type="link"
            >
              <template #icon>
                <IconifyIcon icon="lucide:trash-2" />
              </template>
              {{ $t('common.delete') }}
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>

    <Modal
      v-model:open="modalOpen"
      destroy-on-close
      :confirm-loading="submitting"
      :title="modalTitle"
      @ok="submitApi"
    >
      <Form ref="formRef" :model="formModel" layout="vertical">
        <AdminGeneratedForm :model="formModel" :schema="dialogFormSchema" />
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-api-tool-prefix {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin-right: 8px;
}

.admin-api-tool-prefix__item {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.admin-api-tool-prefix :deep(.ant-popconfirm-open),
.admin-api-tool-prefix :deep(.ant-popover-open) {
  display: inline-flex;
  align-items: center;
}

.admin-api-tool-prefix :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
}
</style>
