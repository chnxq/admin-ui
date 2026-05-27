<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type { AdminDictType, AdminDictTypeSaveInput } from '#/api/admin/dicts';
import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createAdminDictTypeApi,
  deleteAdminDictTypeApi,
  listAdminDictTypesApi,
  updateAdminDictTypeApi,
} from '#/api/admin/dicts';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface AdminDictTypeFormModel extends AdminDictTypeSaveInput {
  isEnabled: boolean;
  sortOrder: number;
  typeCode: string;
  typeName: string;
}

type AdminDictTypeTableRecord = AdminDictType | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const DICT_TYPE_ACCESS = {
  create: ['dict:types:create'],
  delete: ['dict:types:delete'],
  edit: ['dict:types:edit'],
  export: ['dict:types:export'],
} as const;

const enabledOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

const columns: AdminTableColumn<AdminDictType>[] = [
  {
    dataIndex: 'id',
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: 'ID',
    width: 80,
  },
  {
    dataIndex: 'typeCode',
    key: 'typeCode',
    sortField: 'type_code',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.typeCode'),
    width: 220,
  },
  {
    dataIndex: 'typeName',
    key: 'typeName',
    sortField: 'type_name',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.typeName'),
    width: 220,
  },
  {
    dataIndex: 'isEnabled',
    key: 'isEnabled',
    sortField: 'is_enabled',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.isEnabled'),
    width: 110,
  },
  {
    dataIndex: 'sortOrder',
    sortField: 'sort_order',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.sortOrder'),
    width: 110,
  },
  {
    dataIndex: 'tenantName',
    title: $t('page.dictType.tenantName'),
    width: 180,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.dictType.createdAt'),
    width: 170,
  },
  {
    fixed: 'right',
    key: 'action',
    title: $t('ui.table.action'),
    width: 150,
  },
];

const loading = ref(false);
const modalOpen = ref(false);
const submitting = ref(false);
const editingId = ref<number>();
const formRef = ref<FormInstance>();
const tableSurfaceRef = ref<HTMLElement>();
const items = ref<AdminDictType[]>([]);
const sorting = ref<AdminTableSorting[]>([]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

const searchForm = reactive({
  isEnabled: undefined as number | undefined,
  typeCode: '',
  typeName: '',
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const formModel = reactive<AdminDictTypeFormModel>({
  isEnabled: true,
  sortOrder: 0,
  typeCode: '',
  typeName: '',
});

const modalTitle = computed(() =>
  editingId.value
    ? $t('page.dictType.editTitle')
    : $t('page.dictType.createTitle'),
);
const displayColumns = computed<TableColumnsType<AdminDictType>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules: Record<string, Rule[]> = {
  typeCode: [
    {
      message: $t('ui.formRules.required', [$t('page.dictType.typeCode')]),
      required: true,
    },
  ],
  typeName: [
    {
      message: $t('ui.formRules.required', [$t('page.dictType.typeName')]),
      required: true,
    },
  ],
};

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.dictType.total')} ${total}`,
  total: pager.total,
}));

function resetFormModel() {
  Object.assign(formModel, {
    isEnabled: true,
    sortOrder: 0,
    typeCode: '',
    typeName: '',
  });
}

function toAdminDictType(record: AdminDictTypeTableRecord) {
  return record as AdminDictType;
}

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function statusColor(enabled?: boolean) {
  return enabled ? 'success' : 'default';
}

function statusText(enabled?: boolean) {
  return enabled ? $t('common.enabled') : $t('common.disabled');
}

async function loadData() {
  loading.value = true;
  try {
    const result = await listAdminDictTypesApi({
      isEnabled:
        searchForm.isEnabled === undefined
          ? undefined
          : searchForm.isEnabled === 1,
      page: pager.page,
      pageSize: pager.pageSize,
      sorting: sorting.value,
      typeCode: searchForm.typeCode,
      typeName: searchForm.typeName,
    });
    items.value = result.items;
    pager.total = result.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pager.page = 1;
  void loadData();
}

function handleReset() {
  searchForm.isEnabled = undefined;
  searchForm.typeCode = '';
  searchForm.typeName = '';
  pager.page = 1;
  sorting.value = [];
  void loadData();
}

function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorter as any);
  void loadData();
}

async function openCreateModal() {
  editingId.value = undefined;
  resetFormModel();
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function openEditModal(record: AdminDictTypeTableRecord) {
  const item = toAdminDictType(record);
  editingId.value = item.id;
  Object.assign(formModel, {
    isEnabled: item.isEnabled ?? true,
    sortOrder: item.sortOrder ?? 0,
    typeCode: item.typeCode ?? '',
    typeName: item.typeName ?? '',
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    if (editingId.value) {
      await updateAdminDictTypeApi(editingId.value, formModel);
      message.success($t('page.dictType.updateSuccess'));
    } else {
      await createAdminDictTypeApi(formModel);
      message.success($t('page.dictType.createSuccess'));
    }
    modalOpen.value = false;
    await loadData();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminDictTypeTableRecord) {
  const item = toAdminDictType(record);
  if (!item.id) {
    return;
  }
  await deleteAdminDictTypeApi(item.id);
  message.success($t('page.dictType.deleteSuccess'));
  await loadData();
}

onMounted(() => {
  void loadData();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.dictType')">
    <div ref="tableSurfaceRef" class="admin-dict-surface">
      <div class="admin-dict-toolbar">
        <Space wrap>
          <Input
            v-model:value="searchForm.typeName"
            allow-clear
            :placeholder="$t('page.dictType.searchTypeName')"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Input
            v-model:value="searchForm.typeCode"
            allow-clear
            :placeholder="$t('page.dictType.searchTypeCode')"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Select
            v-model:value="searchForm.isEnabled"
            allow-clear
            :options="enabledOptions"
            :placeholder="$t('page.dictType.selectEnabled')"
            style="width: 160px"
          />
          <Button type="primary" @click="handleSearch">
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
        <Space>
          <AdminTableToolbar
            v-model:column-keys="visibleColumnKeys"
            :columns="columns"
            :export-access-codes="DICT_TYPE_ACCESS.export"
            :data-source="items"
            file-name="system-dict-types"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadData"
            storage-key="system-dict-type-list"
          />
          <Button
            v-access:code="DICT_TYPE_ACCESS.create"
            type="primary"
            @click="openCreateModal"
          >
            <template #icon>
              <IconifyIcon icon="lucide:plus" />
            </template>
            {{ $t('page.dictType.createTitle') }}
          </Button>
        </Space>
      </div>

      <Table
        class="admin-dict-table"
        :columns="displayColumns"
        :data-source="items"
        :loading="loading"
        :pagination="tablePagination"
        :row-key="(record) => record.id ?? record.typeCode ?? record.typeName"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'isEnabled'">
            <Tag :color="statusColor(toAdminDictType(record).isEnabled)">
              {{ statusText(toAdminDictType(record).isEnabled) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(toAdminDictType(record).createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button
                v-access:code="DICT_TYPE_ACCESS.edit"
                size="small"
                type="link"
                @click="openEditModal(record)"
              >
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                v-access:code="DICT_TYPE_ACCESS.delete"
                :title="
                  $t('ui.actionMessage.deleteConfirm', [
                    $t('page.dictType.moduleName'),
                  ])
                "
                @confirm="handleDelete(record)"
              >
                <Button danger size="small" type="link">
                  {{ $t('common.delete') }}
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </div>

    <Modal
      v-model:open="modalOpen"
      :confirm-loading="submitting"
      :title="modalTitle"
      destroy-on-close
      @ok="handleSubmit"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.dictType.typeName')" name="typeName">
          <Input
            v-model:value="formModel.typeName"
            :placeholder="$t('page.dictType.placeholderTypeName')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictType.typeCode')" name="typeCode">
          <Input
            v-model:value="formModel.typeCode"
            :placeholder="$t('page.dictType.placeholderTypeCode')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictType.sortOrder')" name="sortOrder">
          <InputNumber v-model:value="formModel.sortOrder" class="full-input" />
        </Form.Item>
        <Form.Item :label="$t('page.dictType.isEnabled')" name="isEnabled">
          <Switch v-model:checked="formModel.isEnabled" />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-dict-surface {
  min-height: 100%;
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-dict-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.admin-dict-table {
  width: 100%;
}

.full-input {
  width: 100%;
}

@media (max-width: 768px) {
  .admin-dict-surface {
    padding: 12px;
  }

  .admin-dict-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
