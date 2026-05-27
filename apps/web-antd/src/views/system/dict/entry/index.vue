<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminDictEntry,
  AdminDictEntryI18n,
  AdminDictEntrySaveInput,
  AdminDictType,
} from '#/api/admin/dicts';
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
  createAdminDictEntryApi,
  deleteAdminDictEntryApi,
  listAdminDictEntriesApi,
  listAdminDictTypesApi,
  updateAdminDictEntryApi,
} from '#/api/admin/dicts';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

interface AdminDictEntryFormModel extends AdminDictEntrySaveInput {
  entryLabelEn?: string;
  entryLabelZh?: string;
  isEnabled: boolean;
  numericValue: number;
  sortOrder: number;
  typeId?: number;
}

type AdminDictEntryTableRecord = AdminDictEntry | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

const DICT_ENTRY_ACCESS = {
  create: ['dict:entries:create'],
  delete: ['dict:entries:delete'],
  edit: ['dict:entries:edit'],
  export: ['dict:entries:export'],
} as const;

const enabledOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

const columns: AdminTableColumn<AdminDictEntry>[] = [
  {
    dataIndex: 'id',
    sortField: 'id',
    sortable: true,
    sorter: true,
    title: 'ID',
    width: 80,
  },
  {
    key: 'dictType',
    title: $t('page.dictEntry.typeName'),
    width: 220,
  },
  {
    dataIndex: 'entryValue',
    key: 'entryValue',
    sortField: 'entry_value',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.entryValue'),
    width: 180,
  },
  {
    key: 'entryLabel',
    title: $t('page.dictEntry.entryLabel'),
    width: 220,
  },
  {
    dataIndex: 'numericValue',
    sortField: 'numeric_value',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.numericValue'),
    width: 120,
  },
  {
    dataIndex: 'sortOrder',
    sortField: 'sort_order',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.sortOrder'),
    width: 110,
  },
  {
    dataIndex: 'isEnabled',
    key: 'isEnabled',
    sortField: 'is_enabled',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.isEnabled'),
    width: 110,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.dictEntry.createdAt'),
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
const items = ref<AdminDictEntry[]>([]);
const dictTypes = ref<AdminDictType[]>([]);
const sorting = ref<AdminTableSorting[]>([]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));

const searchForm = reactive({
  entryValue: '',
  isEnabled: undefined as number | undefined,
  typeId: undefined as number | undefined,
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const formModel = reactive<AdminDictEntryFormModel>({
  entryLabelEn: '',
  entryLabelZh: '',
  entryValue: '',
  isEnabled: true,
  numericValue: 0,
  sortOrder: 0,
  typeId: undefined,
});

const dictTypeOptions = computed(() =>
  (dictTypes.value ?? []).map((item) => ({
    label: `${item.typeName || item.typeCode || item.id} (${item.typeCode || '-'})`,
    value: item.id,
  })),
);
const dictTypeMap = computed(() => {
  const map = new Map<number, AdminDictType>();
  for (const item of dictTypes.value) {
    if (item.id) {
      map.set(item.id, item);
    }
  }
  return map;
});
const modalTitle = computed(() =>
  editingId.value
    ? $t('page.dictEntry.editTitle')
    : $t('page.dictEntry.createTitle'),
);
const displayColumns = computed<TableColumnsType<AdminDictEntry>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);
const formRules: Record<string, Rule[]> = {
  entryValue: [
    {
      message: $t('ui.formRules.required', [$t('page.dictEntry.entryValue')]),
      required: true,
    },
  ],
  entryLabelZh: [
    {
      message: $t('ui.formRules.required', [$t('page.dictEntry.entryLabelZh')]),
      required: true,
    },
  ],
  typeId: [
    {
      message: $t('ui.formRules.selectRequired', [
        $t('page.dictEntry.typeName'),
      ]),
      required: true,
    },
  ],
};

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.dictEntry.total')} ${total}`,
  total: pager.total,
}));

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function buildI18nMap(): Record<string, AdminDictEntryI18n> | undefined {
  const zhLabel = cleanText(formModel.entryLabelZh);
  const enLabel = cleanText(formModel.entryLabelEn);
  const result: Record<string, AdminDictEntryI18n> = {};

  if (zhLabel) {
    result['zh-CN'] = {
      entryLabel: zhLabel,
      languageCode: 'zh-CN',
      languageName: '简体中文',
    };
  }
  if (enLabel) {
    result['en-US'] = {
      entryLabel: enLabel,
      languageCode: 'en-US',
      languageName: 'English',
    };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function resetFormModel() {
  Object.assign(formModel, {
    entryLabelEn: '',
    entryLabelZh: '',
    entryValue: '',
    isEnabled: true,
    numericValue: 0,
    sortOrder: 0,
    typeId: undefined,
  });
}

function toAdminDictEntry(record: AdminDictEntryTableRecord) {
  return record as AdminDictEntry;
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

function resolveTypeText(record: AdminDictEntry) {
  const type = record.typeId ? dictTypeMap.value.get(record.typeId) : undefined;
  if (!type) {
    return record.typeId ? `#${record.typeId}` : '-';
  }
  return `${type.typeName || '-'} / ${type.typeCode || '-'}`;
}

function resolveEntryLabel(record: AdminDictEntry) {
  return (
    record.currentI18n?.entryLabel ||
    record.i18n?.['zh-CN']?.entryLabel ||
    record.i18n?.['en-US']?.entryLabel ||
    '-'
  );
}

async function loadDictTypes() {
  const result = await listAdminDictTypesApi({
    isEnabled: true,
    page: 1,
    pageSize: 200,
    sorting: [{ direction: 'ASC', field: 'sort_order' }],
  });
  dictTypes.value = result.items;
}

async function loadData() {
  loading.value = true;
  try {
    const result = await listAdminDictEntriesApi({
      entryValue: searchForm.entryValue,
      isEnabled:
        searchForm.isEnabled === undefined
          ? undefined
          : searchForm.isEnabled === 1,
      page: pager.page,
      pageSize: pager.pageSize,
      sorting: sorting.value,
      typeId: searchForm.typeId,
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
  searchForm.entryValue = '';
  searchForm.isEnabled = undefined;
  searchForm.typeId = undefined;
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

async function openEditModal(record: AdminDictEntryTableRecord) {
  const item = toAdminDictEntry(record);
  editingId.value = item.id;
  Object.assign(formModel, {
    entryLabelEn: item.i18n?.['en-US']?.entryLabel ?? '',
    entryLabelZh:
      item.i18n?.['zh-CN']?.entryLabel ?? item.currentI18n?.entryLabel ?? '',
    entryValue: item.entryValue ?? '',
    isEnabled: item.isEnabled ?? true,
    numericValue: item.numericValue ?? 0,
    sortOrder: item.sortOrder ?? 0,
    typeId: item.typeId,
  });
  modalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    const payload: AdminDictEntrySaveInput = {
      entryValue: formModel.entryValue,
      i18n: buildI18nMap(),
      isEnabled: formModel.isEnabled,
      numericValue: formModel.numericValue,
      sortOrder: formModel.sortOrder,
      typeId: formModel.typeId,
    };
    if (editingId.value) {
      await updateAdminDictEntryApi(editingId.value, payload);
      message.success($t('page.dictEntry.updateSuccess'));
    } else {
      await createAdminDictEntryApi(payload);
      message.success($t('page.dictEntry.createSuccess'));
    }
    modalOpen.value = false;
    await loadData();
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(record: AdminDictEntryTableRecord) {
  const item = toAdminDictEntry(record);
  if (!item.id) {
    return;
  }
  await deleteAdminDictEntryApi(item.id);
  message.success($t('page.dictEntry.deleteSuccess'));
  await loadData();
}

onMounted(async () => {
  await loadDictTypes();
  await loadData();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.system.dictEntry')">
    <div ref="tableSurfaceRef" class="admin-dict-surface">
      <div class="admin-dict-toolbar">
        <Space wrap>
          <Select
            v-model:value="searchForm.typeId"
            allow-clear
            :options="dictTypeOptions"
            :placeholder="$t('page.dictEntry.selectType')"
            style="width: 220px"
          />
          <Input
            v-model:value="searchForm.entryValue"
            allow-clear
            :placeholder="$t('page.dictEntry.searchEntryValue')"
            style="width: 180px"
            @press-enter="handleSearch"
          />
          <Select
            v-model:value="searchForm.isEnabled"
            allow-clear
            :options="enabledOptions"
            :placeholder="$t('page.dictEntry.selectEnabled')"
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
            :export-access-codes="DICT_ENTRY_ACCESS.export"
            :data-source="items"
            file-name="system-dict-entries"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadData"
            storage-key="system-dict-entry-list"
          />
          <Button
            v-access:code="DICT_ENTRY_ACCESS.create"
            type="primary"
            @click="openCreateModal"
          >
            <template #icon>
              <IconifyIcon icon="lucide:plus" />
            </template>
            {{ $t('page.dictEntry.createTitle') }}
          </Button>
        </Space>
      </div>

      <Table
        class="admin-dict-table"
        :columns="displayColumns"
        :data-source="items"
        :loading="loading"
        :pagination="tablePagination"
        :row-key="(record) => record.id ?? record.entryValue"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'dictType'">
            {{ resolveTypeText(toAdminDictEntry(record)) }}
          </template>
          <template v-else-if="column.key === 'entryLabel'">
            {{ resolveEntryLabel(toAdminDictEntry(record)) }}
          </template>
          <template v-else-if="column.key === 'isEnabled'">
            <Tag :color="statusColor(toAdminDictEntry(record).isEnabled)">
              {{ statusText(toAdminDictEntry(record).isEnabled) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(toAdminDictEntry(record).createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button
                v-access:code="DICT_ENTRY_ACCESS.edit"
                size="small"
                type="link"
                @click="openEditModal(record)"
              >
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                v-access:code="DICT_ENTRY_ACCESS.delete"
                :title="
                  $t('ui.actionMessage.deleteConfirm', [
                    $t('page.dictEntry.moduleName'),
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
      width="720px"
      @ok="handleSubmit"
    >
      <Form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.dictEntry.typeName')" name="typeId">
          <Select
            v-model:value="formModel.typeId"
            :options="dictTypeOptions"
            :placeholder="$t('page.dictEntry.selectType')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictEntry.entryValue')" name="entryValue">
          <Input
            v-model:value="formModel.entryValue"
            :placeholder="$t('page.dictEntry.placeholderEntryValue')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.dictEntry.entryLabelZh')"
          name="entryLabelZh"
        >
          <Input
            v-model:value="formModel.entryLabelZh"
            :placeholder="$t('page.dictEntry.placeholderEntryLabelZh')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.dictEntry.entryLabelEn')"
          name="entryLabelEn"
        >
          <Input
            v-model:value="formModel.entryLabelEn"
            :placeholder="$t('page.dictEntry.placeholderEntryLabelEn')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.dictEntry.numericValue')"
          name="numericValue"
        >
          <InputNumber
            v-model:value="formModel.numericValue"
            class="full-input"
          />
        </Form.Item>
        <Form.Item :label="$t('page.dictEntry.sortOrder')" name="sortOrder">
          <InputNumber v-model:value="formModel.sortOrder" class="full-input" />
        </Form.Item>
        <Form.Item :label="$t('page.dictEntry.isEnabled')" name="isEnabled">
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
