<script lang="ts" setup>
import type { AdminTableColumn } from './shared';

import { computed, ref, toRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { downloadFileFromBlobPart } from '@vben/utils';

import { useFullscreen } from '@vueuse/core';
import { Button, Checkbox, Dropdown, Space, Tooltip } from 'ant-design-vue';

import {
  buildAdminTableCsv,
  flattenAdminTableData,
  getAdminTableColumnKey,
  getAdminTableColumnTitle,
} from './shared';

defineOptions({ name: 'AdminTableToolbar' });

const props = withDefaults(
  defineProps<{
    columnKeys: string[];
    columns: AdminTableColumn<any>[];
    dataSource?: Record<string, any>[];
    fileName?: string;
    fullscreenTarget?: HTMLElement | null;
    lockedColumnKeys?: string[];
    refresh?: () => Promise<void> | void;
    storageKey: string;
  }>(),
  {
    dataSource: () => [],
    fileName: 'table-export',
    fullscreenTarget: undefined,
    lockedColumnKeys: () => ['action'],
    refresh: undefined,
  },
);

const emit = defineEmits<{
  'update:columnKeys': [value: string[]];
}>();

const targetRef = toRef(props, 'fullscreenTarget');
const checkedColumnKeys = ref<string[]>([]);
const { isFullscreen, toggle } = useFullscreen(targetRef);

const storageId = computed(() => `admin-table-toolbar:${props.storageKey}`);

const columnOptions = computed(() =>
  props.columns
    .map((column) => {
      const key = getAdminTableColumnKey(column);

      return {
        key,
        locked:
          column.alwaysVisible ||
          (key ? props.lockedColumnKeys.includes(key) : false),
        title: getAdminTableColumnTitle(column),
        visible: !column.hideInColumnSettings,
      };
    })
    .filter(
      (
        column,
      ): column is {
        key: string;
        locked: boolean;
        title: string;
        visible: boolean;
      } => Boolean(column.key && column.title && column.visible),
    ),
);

const exportColumns = computed(() => {
  const visibleKeySet = new Set(checkedColumnKeys.value);

  return props.columns.filter((column) => {
    const key = getAdminTableColumnKey(column);
    if (!key || key === 'action' || column.exportDisabled) {
      return false;
    }
    return visibleKeySet.has(key);
  });
});

const exportRows = computed(() =>
  flattenAdminTableData(props.dataSource ?? []).map((item) => ({ ...item })),
);

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function sanitizeColumnKeys(columnKeys: string[]) {
  const allowedKeys = new Set(columnOptions.value.map((column) => column.key));
  const lockedKeys = new Set(columnOptions.value
    .filter((column) => column.locked)
    .map((column) => column.key));

  const nextKeys = columnOptions.value
    .map((column) => column.key)
    .filter((key) => columnKeys.includes(key) || lockedKeys.has(key));

  if (nextKeys.length === 0 && columnOptions.value[0]) {
    nextKeys.push(columnOptions.value[0].key);
  }

  return nextKeys.filter(
    (key, index) => nextKeys.indexOf(key) === index && allowedKeys.has(key),
  );
}

function persistColumnKeys(columnKeys: string[]) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(storageId.value, JSON.stringify(columnKeys));
}

function emitColumnKeys(columnKeys: string[], persist: boolean) {
  if (!arraysEqual(checkedColumnKeys.value, columnKeys)) {
    checkedColumnKeys.value = columnKeys;
  }
  if (!arraysEqual(props.columnKeys, columnKeys)) {
    emit('update:columnKeys', columnKeys);
  }
  if (persist) {
    persistColumnKeys(columnKeys);
  }
}

function loadStoredColumnKeys() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const rawValue = window.localStorage.getItem(storageId.value);
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    window.localStorage.removeItem(storageId.value);
  }

  return undefined;
}

function handleColumnToggle(key: string, checked: boolean) {
  const nextKeys = checked
    ? [...checkedColumnKeys.value, key]
    : checkedColumnKeys.value.filter((item) => item !== key);

  emitColumnKeys(sanitizeColumnKeys(nextKeys), true);
}

function handleExport() {
  if (exportColumns.value.length === 0) {
    return;
  }

  const csvContent = buildAdminTableCsv(exportColumns.value, exportRows.value);
  const fileName = props.fileName.endsWith('.csv')
    ? props.fileName
    : `${props.fileName}.csv`;

  downloadFileFromBlobPart({
    fileName,
    source: new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
  });
}

watch(
  [columnOptions, () => props.storageKey],
  () => {
    const storedColumnKeys = loadStoredColumnKeys();
    const nextKeys = sanitizeColumnKeys(storedColumnKeys ?? props.columnKeys);
    emitColumnKeys(nextKeys, Boolean(storedColumnKeys));
  },
  { deep: true, immediate: true },
);

watch(
  () => props.columnKeys,
  (columnKeys) => {
    const nextKeys = sanitizeColumnKeys(columnKeys);
    if (!arraysEqual(checkedColumnKeys.value, nextKeys)) {
      checkedColumnKeys.value = nextKeys;
    }
  },
  { deep: true },
);
</script>

<template>
  <Space class="admin-table-toolbar" :size="8">
    <Tooltip title="导出">
      <Button
        class="admin-table-toolbar__button"
        :disabled="exportColumns.length === 0"
        @click="handleExport"
      >
        <template #icon>
          <IconifyIcon icon="lucide:download" />
        </template>
      </Button>
    </Tooltip>

    <Tooltip title="刷新">
      <Button
        class="admin-table-toolbar__button"
        :disabled="!refresh"
        @click="refresh?.()"
      >
        <template #icon>
          <IconifyIcon icon="lucide:refresh-cw" />
        </template>
      </Button>
    </Tooltip>

    <Tooltip :title="isFullscreen ? '退出全屏' : '全屏'">
      <Button class="admin-table-toolbar__button" @click="toggle()">
        <template #icon>
          <IconifyIcon
            :icon="isFullscreen ? 'lucide:minimize-2' : 'lucide:maximize-2'"
          />
        </template>
      </Button>
    </Tooltip>

    <Dropdown placement="bottomRight" trigger="click">
      <Tooltip title="列设置">
        <Button class="admin-table-toolbar__button">
          <template #icon>
            <IconifyIcon icon="lucide:settings-2" />
          </template>
        </Button>
      </Tooltip>

      <template #overlay>
        <div class="admin-table-toolbar__overlay">
          <div
            v-for="column in columnOptions"
            :key="column.key"
            class="admin-table-toolbar__option"
          >
            <Checkbox
              :checked="checkedColumnKeys.includes(column.key)"
              :disabled="
                column.locked ||
                (checkedColumnKeys.includes(column.key) &&
                  checkedColumnKeys.length <= 1)
              "
              @change="
                handleColumnToggle(
                  column.key,
                  !checkedColumnKeys.includes(column.key),
                )
              "
            >
              {{ column.title }}
            </Checkbox>
          </div>
        </div>
      </template>
    </Dropdown>
  </Space>
</template>

<style scoped>
.admin-table-toolbar {
  display: inline-flex;
  align-items: center;
}

.admin-table-toolbar__button {
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
}

.admin-table-toolbar__overlay {
  min-width: 180px;
  max-height: 280px;
  padding: 8px 0;
  overflow: auto;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 10px 30px hsl(var(--foreground) / 12%);
}

.admin-table-toolbar__option {
  padding: 4px 12px;
}
</style>
