<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, nextTick, reactive, ref } from 'vue';

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
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  listAdminInternalMessagesApi,
  revokeAdminInternalMessageApi,
  sendAdminInternalMessageApi,
} from '#/api/admin/internal-messages';
import { listAdminUsersApi } from '#/api/admin/users';
import { $t } from '#/locales';

type AdminInternalMessage = Awaited<
  ReturnType<typeof listAdminInternalMessagesApi>
>['items'][number];
type AdminInternalMessageType = NonNullable<AdminInternalMessage['type']>;
type AdminInternalMessageStatus = NonNullable<AdminInternalMessage['status']>;
type AdminSendInternalMessageInput = Parameters<
  typeof sendAdminInternalMessageApi
>[0];

interface SendFormModel {
  content: string;
  targetAll: boolean;
  targetUserIds: number[];
  title: string;
  type: AdminInternalMessageType;
}

interface TargetUserOption {
  label: string;
  meta: string;
  value: number;
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

const { hasAccessByCodes } = useAccess();
const sendModalOpen = ref(false);
const sending = ref(false);
const formRef = ref();
const targetUserLoading = ref(false);
const targetUserOptions = ref<TargetUserOption[]>([]);

const sendFormModel = reactive<SendFormModel>({
  content: '',
  targetAll: true,
  targetUserIds: [],
  title: '',
  type: 'NOTIFICATION',
});

const typeOptions: Array<{ label: string; value: AdminInternalMessageType }> = [
  { label: $t('page.internalMessage.typeNotification'), value: 'NOTIFICATION' },
  { label: $t('page.internalMessage.typePrivate'), value: 'PRIVATE' },
  { label: $t('page.internalMessage.typeGroup'), value: 'GROUP' },
];

const formOptions: VbenFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('page.internalMessage.searchTitle'),
      },
      fieldName: 'title',
      label: $t('page.internalMessage.title'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: typeOptions,
        placeholder: $t('page.internalMessage.selectType'),
      },
      fieldName: 'type',
      label: $t('page.internalMessage.type'),
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<AdminInternalMessage> = {
  border: false,
  columnConfig: {
    resizable: true,
  },
  columns: [
    {
      field: 'title',
      sortable: true,
      title: $t('page.internalMessage.title'),
      width: 220,
    },
    {
      field: 'content',
      slots: { default: 'content' },
      sortable: true,
      title: $t('page.internalMessage.content'),
      width: 360,
    },
    {
      field: 'type',
      slots: { default: 'type' },
      sortable: true,
      title: $t('page.internalMessage.type'),
      width: 120,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      sortable: true,
      title: $t('page.internalMessage.status'),
      width: 120,
    },
    {
      field: 'senderName',
      title: $t('page.internalMessage.senderName'),
      width: 150,
    },
    {
      field: 'tenantName',
      slots: { default: 'tenant' },
      title: $t('page.tenant.messageOwnership'),
      width: 160,
    },
    {
      field: 'createdAt',
      formatter: 'formatDateTime',
      sortable: true,
      title: $t('page.internalMessage.createdAt'),
      width: 170,
    },
    {
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('ui.table.action'),
      width: 120,
    },
  ],
  exportConfig: {
    filename: 'internal-messages',
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

        const response = await listAdminInternalMessagesApi({
          page: page.currentPage,
          pageSize: page.pageSize,
          sorting: [
            {
              direction,
              field: sortField === 'createdAt' ? 'created_at' : sortField,
            },
          ],
        });

        let items = response.items;
        const title = String(formValues.title || '').trim();
        if (title) {
          items = items.filter((item) => (item.title || '').includes(title));
        }
        if (formValues.type) {
          items = items.filter((item) => item.type === formValues.type);
        }

        return {
          items,
          total: response.total,
        };
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
    export: hasAccessByCodes([...INTERNAL_MESSAGE_ACCESS.export]),
    refresh: true,
    slots: {
      toolPrefix: 'toolPrefix',
    },
    zoom: true,
  },
};

function formatTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

function getTenantScopeText(record: AdminInternalMessage) {
  return record.tenantName || '-';
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
    targetUserIds: [],
    title: '',
    type: 'NOTIFICATION',
  });
}

async function loadTargetUsers(keyword = '') {
  targetUserLoading.value = true;
  try {
    const response = await listAdminUsersApi({
      page: 1,
      pageSize: 50,
      realname: keyword || undefined,
      sorting: [{ direction: 'ASC', field: 'id' }],
      username: keyword || undefined,
    });
    targetUserOptions.value = response.items
      .filter(
        (item): item is typeof item & { id: number } => item.id !== undefined,
      )
      .map((item) => ({
        label: item.realname?.trim() || item.username?.trim() || `#${item.id}`,
        meta:
          [
            item.username?.trim(),
            item.mobile?.trim(),
            item.orgUnitNames?.filter(Boolean).join('/'),
          ]
            .filter(Boolean)
            .join(' / ') || '-',
        value: item.id,
      }));
  } finally {
    targetUserLoading.value = false;
  }
}

async function handleTargetUserSearch(value: string) {
  await loadTargetUsers(value.trim());
}

async function openSend() {
  resetSendFormModel();
  await loadTargetUsers();
  sendModalOpen.value = true;
  await nextTick();
  formRef.value?.clearValidate();
}

async function submitSend() {
  await formRef.value?.validate();

  const targetUserIds = sendFormModel.targetUserIds.filter((item) => item > 0);
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
    await gridApi.reload();
  } finally {
    sending.value = false;
  }
}

async function handleRevoke(record: AdminInternalMessage) {
  if (!record.id) {
    return;
  }
  try {
    await revokeAdminInternalMessageApi(record.id);
    message.success($t('page.internalMessage.revokeSuccess'));
    await gridApi.reload();
  } catch (error) {
    const text = (error as Error).message || '';
    if (text.includes('message cannot be revoked after 30 minutes')) {
      message.error($t('page.internalMessage.revokeFailedAfterThirtyMinutes'));
      return;
    }
    if (
      text.includes('message cannot be revoked after any recipient has read it')
    ) {
      message.error($t('page.internalMessage.revokeFailedAfterRead'));
      return;
    }
    if (text.includes('only sender can revoke message')) {
      message.error($t('page.internalMessage.revokeFailedNotSender'));
      return;
    }
    if (text.includes('message has already been revoked')) {
      message.error($t('page.internalMessage.revokeFailedAlreadyRevoked'));
      return;
    }
    message.error(text || $t('page.internalMessage.revokeFailed'));
  }
}

const canRevoke = computed(() =>
  hasAccessByCodes([...INTERNAL_MESSAGE_ACCESS.revoke]),
);

const [Grid, gridApi] = useVbenVxeGrid<AdminInternalMessage>({
  formOptions,
  gridClass: 'admin-internal-message-grid',
  gridOptions,
});
</script>

<template>
  <Page auto-content-height :title="$t('menu.internalMessage.internalMessage')">
    <Grid :table-title="$t('menu.internalMessage.internalMessage')">
      <template #toolPrefix>
        <div class="admin-internal-message-tool-prefix">
          <Button
            v-access:code="INTERNAL_MESSAGE_ACCESS.send"
            type="primary"
            @click="openSend"
          >
            <template #icon>
              <IconifyIcon icon="lucide:send" />
            </template>
            {{ $t('page.internalMessage.sendButton') }}
          </Button>
        </div>
      </template>

      <template #content="{ row }">
        <span :title="row.content || ''">
          {{ row.content || '-' }}
        </span>
      </template>

      <template #type="{ row }">
        <Tag :color="getTypeColor(row.type)">
          {{ getTypeText(row.type) }}
        </Tag>
      </template>

      <template #status="{ row }">
        <Tag :color="getStatusColor(row.status)">
          {{ getStatusText(row.status) }}
        </Tag>
      </template>

      <template #tenant="{ row }">
        <Tag :color="row.tenantId ? 'blue' : 'gold'">
          {{ getTenantScopeText(row) }}
        </Tag>
      </template>

      <template #createdAt="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>

      <template #action="{ row }">
        <Popconfirm
          v-if="canRevoke && row.status === 'PUBLISHED'"
          :title="
            $t('ui.actionMessage.deleteConfirm', [
              $t('page.internalMessage.moduleName'),
            ])
          "
          @confirm="handleRevoke(row)"
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
    </Grid>

    <Modal
      v-model:open="sendModalOpen"
      destroy-on-close
      :confirm-loading="sending"
      :title="$t('page.internalMessage.sendTitle')"
      @ok="submitSend"
    >
      <Form ref="formRef" :model="sendFormModel" layout="vertical">
        <Form.Item
          :label="$t('page.internalMessage.title')"
          name="title"
          :rules="[
            {
              message: $t('ui.formRules.required', [
                $t('page.internalMessage.title'),
              ]),
              required: true,
            },
          ]"
        >
          <Input
            v-model:value="sendFormModel.title"
            :placeholder="$t('page.internalMessage.placeholderTitle')"
          />
        </Form.Item>
        <Form.Item
          :label="$t('page.internalMessage.type')"
          name="type"
          :rules="[
            {
              message: $t('ui.formRules.selectRequired', [
                $t('page.internalMessage.type'),
              ]),
              required: true,
            },
          ]"
        >
          <Select v-model:value="sendFormModel.type" :options="typeOptions" />
        </Form.Item>
        <Form.Item
          :label="$t('page.internalMessage.content')"
          name="content"
          :rules="[
            {
              message: $t('ui.formRules.required', [
                $t('page.internalMessage.content'),
              ]),
              required: true,
            },
          ]"
        >
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
          <Select
            v-model:value="sendFormModel.targetUserIds"
            :disabled="sendFormModel.targetAll"
            :loading="targetUserLoading"
            mode="multiple"
            :options="targetUserOptions"
            :placeholder="$t('page.internalMessage.placeholderTargetUsers')"
            show-search
            @search="handleTargetUserSearch"
          >
            <template #option="{ label, meta }">
              <div class="message-target-option">
                <span class="message-target-option__main">{{ label }}</span>
                <span class="message-target-option__meta">{{ meta }}</span>
              </div>
            </template>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.admin-internal-message-tool-prefix {
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.message-target-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.message-target-option__main {
  color: hsl(var(--foreground));
}

.message-target-option__meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
