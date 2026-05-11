<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import type { AdminInboxMessage } from '#/api/admin/internal-messages';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { VBEN_DOC_URL, VBEN_GITHUB_URL } from '@vben/constants';
import { useWatermark } from '@vben/hooks';
import { BookOpenText, CircleHelp, SvgGithubIcon } from '@vben/icons';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import {
  deleteAdminInboxMessagesApi,
  listAdminInboxMessagesApi,
  markAdminInboxMessagesReadApi,
} from '#/api/admin/internal-messages';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';

interface InboxNotificationItem extends NotificationItem {
  createdAt?: string;
  messageId?: number;
  recipientId: number;
}

interface SseNotificationPayload {
  at?: string;
  content?: string;
  event?: string;
  messageId?: number;
  title?: string;
}

dayjs.extend(relativeTime);

const notifications = ref<InboxNotificationItem[]>([]);
const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();

const sseController = ref<AbortController | null>(null);
const sseReconnectTimer = ref<null | number>(null);
const sseUrl = computed(() => {
  const configured = String(import.meta.env.VITE_GLOB_SSE_URL || '').trim();
  if (configured) {
    return configured;
  }
  const apiBase = String(import.meta.env.VITE_GLOB_API_URL || '').trim();
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    return `${apiBase.replace(/\/+$/, '')}/events`;
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (apiBase.startsWith('/')) {
      return `${origin}${apiBase.replace(/\/+$/, '')}/events`;
    }
    if (apiBase) {
      return `${origin}/${apiBase.replaceAll(/^\/+|\/+$/g, '')}/events`;
    }
    return `${origin}/events`;
  }
  return '';
});

const showDot = computed(() =>
  notifications.value.some((item) => !item.isRead),
);

const menus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'Profile' });
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
  {
    handler: () => {
      openWindow(VBEN_DOC_URL, {
        target: '_blank',
      });
    },
    icon: BookOpenText,
    text: $t('ui.widgets.document'),
  },
  {
    handler: () => {
      openWindow(VBEN_GITHUB_URL, {
        target: '_blank',
      });
    },
    icon: SvgGithubIcon,
    text: 'GitHub',
  },
  {
    handler: () => {
      openWindow(`${VBEN_GITHUB_URL}/issues`, {
        target: '_blank',
      });
    },
    icon: CircleHelp,
    text: $t('ui.widgets.qa'),
  },
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

function formatNotificationDate(value?: string) {
  if (!value) {
    return '-';
  }
  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return value;
  }
  return parsed.fromNow();
}

function buildNotificationItem(
  item: Pick<
    AdminInboxMessage,
    'content' | 'createdAt' | 'id' | 'messageId' | 'status' | 'title'
  >,
): InboxNotificationItem | null {
  const id = item.id;
  if (typeof id !== 'number' || id <= 0) {
    return null;
  }
  return {
    avatar: avatar.value,
    createdAt: item.createdAt,
    date: formatNotificationDate(item.createdAt),
    id,
    isRead: item.status === 'READ',
    message: item.content || '',
    messageId: item.messageId,
    recipientId: id,
    title: item.title || '-',
  };
}

function clearSseReconnectTimer() {
  if (sseReconnectTimer.value !== null) {
    window.clearTimeout(sseReconnectTimer.value);
    sseReconnectTimer.value = null;
  }
}

function disconnectSse() {
  clearSseReconnectTimer();
  if (sseController.value) {
    sseController.value.abort();
    sseController.value = null;
  }
}

function scheduleSseReconnect() {
  clearSseReconnectTimer();
  sseReconnectTimer.value = window.setTimeout(() => {
    sseReconnectTimer.value = null;
    connectSse();
  }, 2500);
}

function connectSse() {
  disconnectSse();
  const userId = userStore.userInfo?.userId;
  const base = sseUrl.value;
  if (!userId || !base) {
    return;
  }
  const streamId = String(userId).trim();
  if (!streamId) {
    return;
  }

  const controller = new AbortController();
  sseController.value = controller;

  const targetUrl = new URL(base, window.location.origin);
  targetUrl.searchParams.set('stream', streamId);

  let eventSource: EventSource;
  try {
    eventSource = new EventSource(targetUrl.toString(), {
      withCredentials: false,
    });
  } catch {
    scheduleSseReconnect();
    return;
  }

  const close = () => {
    eventSource.close();
    if (sseController.value === controller) {
      sseController.value = null;
    }
  };

  controller.signal.addEventListener('abort', close, { once: true });

  eventSource.addEventListener('notification', (event) => {
    const messageEvent = event as MessageEvent<string>;
    let payload: SseNotificationPayload;
    try {
      payload = JSON.parse(messageEvent.data) as SseNotificationPayload;
    } catch {
      return;
    }
    const messageId = payload.messageId;
    if (typeof messageId !== 'number' || messageId <= 0) {
      return;
    }
    const exists = notifications.value.some(
      (item) => item.messageId === messageId,
    );
    if (!exists) {
      notifications.value.unshift({
        avatar: avatar.value,
        createdAt: payload.at || new Date().toISOString(),
        date: formatNotificationDate(payload.at || new Date().toISOString()),
        id: `msg-${messageId}-${Date.now()}`,
        isRead: false,
        message: payload.content || '',
        messageId,
        recipientId: -1,
        title: payload.title || '-',
      });
      if (notifications.value.length > 50) {
        notifications.value = notifications.value.slice(0, 50);
      }
    }
    void loadInbox(1, 20);
  });

  eventSource.addEventListener('error', () => {
    if (controller.signal.aborted) {
      return;
    }
    close();
    scheduleSseReconnect();
  });
}

async function loadInbox(page = 1, pageSize = 20) {
  try {
    const result = await listAdminInboxMessagesApi({ page, pageSize });
    notifications.value = (result.items || [])
      .map((item) => buildNotificationItem(item))
      .filter((item): item is InboxNotificationItem => Boolean(item));
  } catch {
    notifications.value = [];
  }
}

async function handleLogout() {
  disconnectSse();
  await authStore.logout(false);
}

function handleNoticeClear() {
  const ids = notifications.value
    .map((item) => item.recipientId)
    .filter((id) => Number.isFinite(id) && id > 0);
  notifications.value = [];
  if (ids.length > 0) {
    void deleteAdminInboxMessagesApi(ids);
  }
}

function getRecipientId(id: number | string) {
  const item = notifications.value.find(
    (current) => String(current.id) === String(id),
  );
  if (!item) {
    return null;
  }
  return item.recipientId > 0 ? item.recipientId : null;
}

async function markRead(id: number | string) {
  const numericId = getRecipientId(id);
  const item = notifications.value.find((current) => current.id === id);
  if (!numericId) {
    if (item) {
      item.isRead = true;
    }
    return;
  }
  if (item) {
    item.isRead = true;
  }
  try {
    await markAdminInboxMessagesReadApi([numericId]);
  } catch {
    // Ignore transient failures; next reload will reconcile.
  }
}

async function remove(id: number | string) {
  const numericId = getRecipientId(id);
  notifications.value = notifications.value.filter((item) => item.id !== id);
  if (!numericId) {
    return;
  }
  try {
    await deleteAdminInboxMessagesApi([numericId]);
  } catch {
    // Ignore transient failures; next reload will reconcile.
  }
}

async function handleMakeAll() {
  const unreadIds = notifications.value
    .filter((item) => !item.isRead)
    .map((item) => (item.recipientId > 0 ? item.recipientId : null))
    .filter((id): id is number => typeof id === 'number');

  notifications.value.forEach((item) => {
    item.isRead = true;
  });

  if (unreadIds.length === 0) {
    return;
  }
  try {
    await markAdminInboxMessagesReadApi(unreadIds);
  } catch {
    // Ignore transient failures; next reload will reconcile.
  }
}

const viewAll = () => {
  void router.push({
    path: '/app/internal-message/message',
  });
};

const handleClick = (item: NotificationItem) => {
  if (item.link) {
    navigateTo(item.link, item.query, item.state);
  }
};

function navigateTo(
  link: string,
  query?: Record<string, any>,
  state?: Record<string, any>,
) {
  if (link.startsWith('http://') || link.startsWith('https://')) {
    window.open(link, '_blank');
  } else {
    router.push({
      path: link,
      query: query || {},
      state,
    });
  }
}

watch(
  () => accessStore.accessToken,
  (token) => {
    if (!token) {
      disconnectSse();
      notifications.value = [];
      return;
    }
    void loadInbox(1, 20);
    connectSse();
  },
  { immediate: true },
);

watch(
  () => userStore.userInfo?.userId,
  (userId) => {
    if (!userId) {
      disconnectSse();
      return;
    }
    connectSse();
  },
);

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);

onMounted(() => {
  void loadInbox(1, 20);
});

onBeforeUnmount(() => {
  disconnectSse();
});
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        description="ann.vben@gmail.com"
        tag-text="Pro"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
        @on-click="handleClick"
        @view-all="viewAll"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
