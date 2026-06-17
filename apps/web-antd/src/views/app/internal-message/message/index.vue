<script lang="ts" setup>
import type { VbenFormProps } from '@vben/common-ui';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, nextTick, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Form, message, Modal, Popconfirm, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  listAdminInternalMessagesApi,
  revokeAdminInternalMessageApi,
  sendAdminInternalMessageApi,
} from '#/api/admin/internal-messages';
import { listAdminUsersApi } from '#/api/admin/users';
import AdminGeneratedForm from '#/components/admin-generated-form/index.vue';
import { $t } from '#/locales';
import {
  buildListGridColumns as buildGeneratedListGridColumns,
  buildSearchFormOptions as buildGeneratedSearchFormOptions,
  buildFormOptions as buildGeneratedSendFormOptions,
} from '#/views/generated/admin/app/internal-message/message.meta';

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

const generatedFormOptions = buildGeneratedSearchFormOptions($t);
const generatedSendFormOptions = buildGeneratedSendFormOptions($t);

const formOptions: VbenFormProps = {
  ...generatedFormOptions,
  schema: (generatedFormOptions.schema || []).map((item) => {
    if (item.fieldName === 'type') {
      return {
        ...item,
        componentProps: {
          ...item.componentProps,
          options: typeOptions,
        },
      };
    }
    return item;
  }),
};

const sendDialogFormSchema = computed(() =>
  (generatedSendFormOptions.schema || []).map((item) => {
    const fieldName = item.fieldName;
    if (fieldName === 'title') {
      return {
        ...item,
        componentProps: {
          placeholder: $t('page.internalMessage.placeholderTitle'),
        },
        rules: [
          {
            message: $t('ui.formRules.required', [
              $t('page.internalMessage.title'),
            ]),
            required: true,
          },
        ],
      };
    }
    if (fieldName === 'type') {
      return {
        ...item,
        componentProps: {
          options: typeOptions,
        },
        rules: [
          {
            message: $t('ui.formRules.selectRequired', [
              $t('page.internalMessage.type'),
            ]),
            required: true,
          },
        ],
      };
    }
    if (fieldName === 'content') {
      return {
        ...item,
        componentProps: {
          autoSize: { minRows: 4, maxRows: 8 },
          placeholder: $t('page.internalMessage.placeholderContent'),
        },
        rules: [
          {
            message: $t('ui.formRules.required', [
              $t('page.internalMessage.content'),
            ]),
            required: true,
          },
        ],
      };
    }
    if (fieldName === 'targetAll') {
      return {
        ...item,
        component: 'Checkbox',
      };
    }
    if (fieldName === 'targetUserIds') {
      return {
        ...item,
        component: 'Select',
        componentProps: {
          disabled: sendFormModel.targetAll,
          loading: targetUserLoading.value,
          mode: 'multiple',
          options: targetUserOptions.value,
          placeholder: $t('page.internalMessage.placeholderTargetUsers'),
          showSearch: true,
          onSearch: handleTargetUserSearch,
        },
      };
    }
    return item;
  }),
);

const generatedColumns = buildGeneratedListGridColumns($t) ?? [];

const gridOptions: VxeTableGridOptions<AdminInternalMessage> = {
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
        <AdminGeneratedForm
          :model="sendFormModel"
          :schema="sendDialogFormSchema"
        />
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
