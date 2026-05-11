<script lang="ts" setup>
import type {
  FormInstance,
  TableColumnsType,
  TablePaginationConfig,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  AdminTableColumn,
  AdminTableSorting,
} from '#/components/admin-table-toolbar/shared';

import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Checkbox,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  listAdminInternalMessagesApi,
  revokeAdminInternalMessageApi,
  sendAdminInternalMessageApi,
} from '#/api/admin/internal-messages';
import AdminTableToolbar from '#/components/admin-table-toolbar/index.vue';
import {
  applyAdminTableSorting,
  filterVisibleAdminTableColumns,
  getDefaultVisibleColumnKeys,
  toAdminTableSorting,
} from '#/components/admin-table-toolbar/shared';
import { $t } from '#/locales';

type AdminInternalMessage = Awaited<
  ReturnType<typeof listAdminInternalMessagesApi>
>['items'][number];
type AdminInternalMessageType = NonNullable<AdminInternalMessage['type']>;
type AdminInternalMessageStatus = NonNullable<AdminInternalMessage['status']>;
type AdminSendInternalMessageInput = Parameters<
  typeof sendAdminInternalMessageApi
>[0];

type AdminInternalMessageTableRecord =
  | AdminInternalMessage
  | Record<string, any>;
type AdminTableChangeSorter = Parameters<
  NonNullable<InstanceType<typeof Table>['$props']['onChange']>
>[2];

interface SendFormModel {
  content: string;
  targetAll: boolean;
  targetUserIds: string;
  title: string;
  type: AdminInternalMessageType;
}

const INTERNAL_MESSAGE_ACCESS = {
  export: ['internal:message:export', 'internal-messages:export'],
  revoke: [
    'internal:message:create',
    'internal:message:edit',
    'internal-messages:revoke',
  ],
  send: ['internal:message:create', 'internal-messages:send'],
} as const;

const typeOptions: Array<{ label: string; value: AdminInternalMessageType }> = [
  { label: $t('page.internalMessage.typeNotification'), value: 'NOTIFICATION' },
  { label: $t('page.internalMessage.typePrivate'), value: 'PRIVATE' },
  { label: $t('page.internalMessage.typeGroup'), value: 'GROUP' },
];

const columns: AdminTableColumn<AdminInternalMessage>[] = [
  {
    dataIndex: 'title',
    key: 'title',
    sortable: true,
    sorter: true,
    title: $t('page.internalMessage.title'),
    width: 220,
  },
  {
    key: 'content',
    title: $t('page.internalMessage.content'),
    width: 360,
  },
  {
    dataIndex: 'type',
    key: 'type',
    sortable: true,
    sorter: true,
    title: $t('page.internalMessage.type'),
    width: 120,
  },
  {
    dataIndex: 'status',
    key: 'status',
    sortable: true,
    sorter: true,
    title: $t('page.internalMessage.status'),
    width: 120,
  },
  {
    dataIndex: 'senderName',
    key: 'senderName',
    title: $t('page.internalMessage.senderName'),
    width: 150,
  },
  {
    dataIndex: 'createdAt',
    key: 'createdAt',
    sortField: 'created_at',
    sortable: true,
    sorter: true,
    title: $t('page.internalMessage.createdAt'),
    width: 170,
  },
  {
    fixed: 'right',
    key: 'action',
    title: $t('ui.table.action'),
    width: 110,
  },
];

const { hasAccessByCodes } = useAccess();
const loading = ref(false);
const sendModalOpen = ref(false);
const sending = ref(false);
const tableSurfaceRef = ref<HTMLElement>();
const messages = ref<AdminInternalMessage[]>([]);
const sorting = ref<AdminTableSorting[]>([]);
const visibleColumnKeys = ref<string[]>(getDefaultVisibleColumnKeys(columns));
const formRef = ref<FormInstance>();

const searchForm = reactive({
  title: '',
  type: undefined as AdminInternalMessageType | undefined,
});

const pager = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

const sendFormModel = reactive<SendFormModel>({
  content: '',
  targetAll: true,
  targetUserIds: '',
  title: '',
  type: 'NOTIFICATION',
});

const displayColumns = computed<TableColumnsType<AdminInternalMessage>>(() =>
  filterVisibleAdminTableColumns(
    applyAdminTableSorting(columns, sorting.value),
    visibleColumnKeys.value,
  ),
);

const tablePagination = computed<TablePaginationConfig>(() => ({
  current: pager.page,
  pageSize: pager.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `${$t('page.internalMessage.total')} ${total}`,
  total: pager.total,
}));

const formRules = computed<Record<string, Rule[]>>(() => ({
  content: [
    {
      message: $t('ui.formRules.required', [
        $t('page.internalMessage.content'),
      ]),
      required: true,
    },
  ],
  title: [
    {
      message: $t('ui.formRules.required', [$t('page.internalMessage.title')]),
      required: true,
    },
  ],
  type: [
    {
      message: $t('ui.formRules.selectRequired', [
        $t('page.internalMessage.type'),
      ]),
      required: true,
    },
  ],
}));

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function toAdminMessage(record: AdminInternalMessageTableRecord) {
  return record as AdminInternalMessage;
}

function getTypeText(type?: AdminInternalMessageType) {
  switch (type) {
    case 'GROUP': {
      return $t('page.internalMessage.typeGroup');
    }
    case 'NOTIFICATION': {
      return $t('page.internalMessage.typeNotification');
    }
    case 'PRIVATE': {
      return $t('page.internalMessage.typePrivate');
    }
    default: {
      return '-';
    }
  }
}

function getTypeColor(type?: AdminInternalMessageType) {
  switch (type) {
    case 'GROUP': {
      return 'blue';
    }
    case 'NOTIFICATION': {
      return 'purple';
    }
    case 'PRIVATE': {
      return 'cyan';
    }
    default: {
      return 'default';
    }
  }
}

function getStatusText(status?: AdminInternalMessageStatus) {
  switch (status) {
    case 'ARCHIVED': {
      return $t('page.internalMessage.statusArchived');
    }
    case 'DELETED': {
      return $t('page.internalMessage.statusDeleted');
    }
    case 'DRAFT': {
      return $t('page.internalMessage.statusDraft');
    }
    case 'PUBLISHED': {
      return $t('page.internalMessage.statusPublished');
    }
    case 'REVOKED': {
      return $t('page.internalMessage.statusRevoked');
    }
    case 'SCHEDULED': {
      return $t('page.internalMessage.statusScheduled');
    }
    default: {
      return '-';
    }
  }
}

function getStatusColor(status?: AdminInternalMessageStatus) {
  switch (status) {
    case 'ARCHIVED':
    case 'DELETED': {
      return 'default';
    }
    case 'DRAFT':
    case 'SCHEDULED': {
      return 'orange';
    }
    case 'PUBLISHED': {
      return 'green';
    }
    case 'REVOKED': {
      return 'red';
    }
    default: {
      return 'default';
    }
  }
}

function resetSendFormModel() {
  Object.assign(sendFormModel, {
    content: '',
    targetAll: true,
    targetUserIds: '',
    title: '',
    type: 'NOTIFICATION',
  });
}

function parseTargetUserIDs(raw: string) {
  return raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

async function loadMessages() {
  loading.value = true;
  try {
    const response = await listAdminInternalMessagesApi({
      page: pager.page,
      pageSize: pager.pageSize,
    });
    let items = response.items;
    const title = searchForm.title.trim();
    if (title) {
      items = items.filter((item) => (item.title || '').includes(title));
    }
    if (searchForm.type) {
      items = items.filter((item) => item.type === searchForm.type);
    }
    messages.value = items;
    pager.total = response.total;
  } catch (error) {
    message.error(
      (error as Error).message || $t('page.internalMessage.loadFailed'),
    );
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  pager.page = 1;
  await loadMessages();
}

async function handleReset() {
  searchForm.title = '';
  searchForm.type = undefined;
  pager.page = 1;
  sorting.value = [];
  await loadMessages();
}

async function handleTableChange(
  pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: AdminTableChangeSorter,
) {
  pager.page = pagination.current ?? 1;
  pager.pageSize = pagination.pageSize ?? 10;
  sorting.value = toAdminTableSorting(sorter as any);
  await loadMessages();
}

async function openSend() {
  resetSendFormModel();
  sendModalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitSend() {
  await formRef.value?.validate();

  const targetUserIds = parseTargetUserIDs(sendFormModel.targetUserIds);
  if (!sendFormModel.targetAll && targetUserIds.length === 0) {
    message.warning($t('page.internalMessage.targetUserIdsRequired'));
    return;
  }

  const payload: AdminSendInternalMessageInput = {
    content: sendFormModel.content.trim(),
    targetAll: sendFormModel.targetAll,
    targetUserIds: sendFormModel.targetAll ? [] : targetUserIds,
    title: sendFormModel.title.trim(),
    type: sendFormModel.type,
  };

  sending.value = true;
  try {
    await sendAdminInternalMessageApi(payload);
    message.success($t('page.internalMessage.sendSuccess'));
    sendModalOpen.value = false;
    pager.page = 1;
    await loadMessages();
  } finally {
    sending.value = false;
  }
}

async function handleRevoke(record: AdminInternalMessageTableRecord) {
  const row = toAdminMessage(record);
  if (!row.id) {
    return;
  }
  await revokeAdminInternalMessageApi(row.id);
  message.success($t('page.internalMessage.revokeSuccess'));
  await loadMessages();
}

const canSend = computed(() =>
  hasAccessByCodes([...INTERNAL_MESSAGE_ACCESS.send]),
);
const canRevoke = computed(() =>
  hasAccessByCodes([...INTERNAL_MESSAGE_ACCESS.revoke]),
);

onMounted(() => {
  loadMessages();
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.internalMessage.internalMessage')">
    <div ref="tableSurfaceRef" class="admin-internal-message-surface">
      <div class="admin-internal-message-toolbar">
        <Form :model="searchForm" layout="inline" @finish="handleSearch">
          <Form.Item :label="$t('page.internalMessage.title')" name="title">
            <Input
              v-model:value="searchForm.title"
              allow-clear
              :placeholder="$t('page.internalMessage.searchTitle')"
            />
          </Form.Item>
          <Form.Item :label="$t('page.internalMessage.type')" name="type">
            <Select
              v-model:value="searchForm.type"
              allow-clear
              :options="typeOptions"
              :placeholder="$t('page.internalMessage.selectType')"
              style="width: 140px"
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button html-type="submit" type="primary">
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
          </Form.Item>
        </Form>

        <Space>
          <AdminTableToolbar
            v-model:column-keys="visibleColumnKeys"
            :columns="columns"
            :export-access-codes="INTERNAL_MESSAGE_ACCESS.export"
            :data-source="messages"
            file-name="internal-messages"
            :fullscreen-target="tableSurfaceRef"
            :refresh="loadMessages"
            storage-key="internal-message-list"
          />
          <Button v-if="canSend" type="primary" @click="openSend">
            <template #icon>
              <IconifyIcon icon="lucide:send" />
            </template>
            {{ $t('page.internalMessage.sendButton') }}
          </Button>
        </Space>
      </div>

      <Table
        class="admin-internal-message-table"
        :columns="displayColumns"
        :data-source="messages"
        :loading="loading"
        :pagination="tablePagination"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'content'">
            <span :title="record.content || ''">
              {{ record.content || '-' }}
            </span>
          </template>

          <template v-else-if="column.key === 'type'">
            <Tag :color="getTypeColor(record.type)">
              {{ getTypeText(record.type) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <Tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <Popconfirm
              v-if="canRevoke && record.status === 'PUBLISHED'"
              :title="
                $t('ui.actionMessage.deleteConfirm', [
                  $t('page.internalMessage.moduleName'),
                ])
              "
              @confirm="handleRevoke(record)"
            >
              <Button danger size="small" type="link">
                <template #icon>
                  <IconifyIcon icon="lucide:ban" />
                </template>
                {{ $t('page.internalMessage.revokeButton') }}
              </Button>
            </Popconfirm>
            <span v-else>-</span>
          </template>
        </template>
      </Table>
    </div>

    <Modal
      v-model:open="sendModalOpen"
      destroy-on-close
      :confirm-loading="sending"
      :title="$t('page.internalMessage.sendTitle')"
      @ok="submitSend"
    >
      <Form
        ref="formRef"
        :model="sendFormModel"
        :rules="formRules"
        layout="vertical"
      >
        <Form.Item :label="$t('page.internalMessage.title')" name="title">
          <Input
            v-model:value="sendFormModel.title"
            :placeholder="$t('page.internalMessage.placeholderTitle')"
          />
        </Form.Item>
        <Form.Item :label="$t('page.internalMessage.type')" name="type">
          <Select v-model:value="sendFormModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item :label="$t('page.internalMessage.content')" name="content">
          <Input.TextArea
            v-model:value="sendFormModel.content"
            :auto-size="{ minRows: 4, maxRows: 8 }"
            :placeholder="$t('page.internalMessage.placeholderContent')"
          />
        </Form.Item>
        <Form.Item>
          <Checkbox v-model:checked="sendFormModel.targetAll">
            {{ $t('page.internalMessage.targetAll') }}
          </Checkbox>
        </Form.Item>
        <Form.Item
          :label="$t('page.internalMessage.targetUserIds')"
          name="targetUserIds"
        >
          <Input
            v-model:value="sendFormModel.targetUserIds"
            :disabled="sendFormModel.targetAll"
            :placeholder="$t('page.internalMessage.placeholderTargetUserIds')"
          />
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-internal-message-surface {
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

.admin-internal-message-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.admin-internal-message-table {
  flex: 1;
  min-height: 0;
}

@media (max-width: 640px) {
  .admin-internal-message-surface {
    padding: 12px;
  }

  .admin-internal-message-toolbar {
    align-items: stretch;
  }
}
</style>
