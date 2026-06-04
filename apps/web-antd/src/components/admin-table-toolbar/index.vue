<script lang="ts" setup>
import type { AdminTableColumn } from './shared';

import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue';

import { AccessControl } from '@vben/access';
import { IconifyIcon } from '@vben/icons';
import { $t } from '@vben/locales';
import { downloadFileFromBlobPart } from '@vben/utils';

import { useFullscreen } from '@vueuse/core';
import {
  Button,
  Checkbox,
  Dropdown,
  Input,
  Modal,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';

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
    exportAccessCodes?: readonly string[];
    fileName?: string;
    fullscreenTarget?: HTMLElement | null;
    lockedColumnKeys?: string[];
    refresh?: () => Promise<void> | void;
    storageKey: string;
  }>(),
  {
    dataSource: () => [],
    exportAccessCodes: undefined,
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
const exportDialogOpen = ref(false);
const exportFileName = ref('');
const exportCheckedColumnKeys = ref<string[]>([]);
const { exit, isFullscreen, toggle } = useFullscreen(targetRef);

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

const exportRows = computed(() =>
  flattenAdminTableData(props.dataSource ?? []).map((item) => ({ ...item })),
);

const exportColumnOptions = computed(() =>
  props.columns
    .map((column) => {
      const key = getAdminTableColumnKey(column);
      const title = getAdminTableColumnTitle(column);

      if (!key || !title || key === 'action' || column.exportDisabled) {
        return undefined;
      }

      return { column, key, title };
    })
    .filter(
      (
        item,
      ): item is {
        column: AdminTableColumn<any>;
        key: string;
        title: string;
      } => item !== undefined && Boolean(item.key && item.title),
    ),
);

const exportSelectedColumns = computed(() => {
  const selectedKeySet = new Set(exportCheckedColumnKeys.value);

  return exportColumnOptions.value
    .filter((column) => selectedKeySet.has(column.key))
    .map((column) => column.column);
});

const exportAllChecked = computed(
  () =>
    exportColumnOptions.value.length > 0 &&
    exportCheckedColumnKeys.value.length === exportColumnOptions.value.length,
);

const exportIndeterminate = computed(
  () =>
    exportCheckedColumnKeys.value.length > 0 &&
    exportCheckedColumnKeys.value.length < exportColumnOptions.value.length,
);

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function sanitizeColumnKeys(columnKeys: string[]) {
  const allowedKeys = new Set(columnOptions.value.map((column) => column.key));
  const lockedKeys = new Set(
    columnOptions.value
      .filter((column) => column.locked)
      .map((column) => column.key),
  );

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

function openExportDialog() {
  if (exportColumnOptions.value.length === 0) {
    return;
  }

  exportFileName.value = props.fileName;
  exportCheckedColumnKeys.value = exportColumnOptions.value.map(
    (column) => column.key,
  );
  exportDialogOpen.value = true;
}

function handleExportCheckAll(checked: boolean) {
  exportCheckedColumnKeys.value = checked
    ? exportColumnOptions.value.map((column) => column.key)
    : [];
}

function handleExportCheckAllChange(event: { target: { checked: boolean } }) {
  handleExportCheckAll(event.target.checked);
}

function handleExportColumnToggle(key: string) {
  if (exportCheckedColumnKeys.value.includes(key)) {
    exportCheckedColumnKeys.value = exportCheckedColumnKeys.value.filter(
      (item) => item !== key,
    );
    return;
  }

  exportCheckedColumnKeys.value = [...exportCheckedColumnKeys.value, key];
}

function handleExport() {
  if (exportSelectedColumns.value.length === 0) {
    return;
  }

  const csvContent = buildAdminTableCsv(
    exportSelectedColumns.value,
    exportRows.value,
  );
  const normalizedFileName = exportFileName.value.trim() || props.fileName;
  const fileName = normalizedFileName.endsWith('.csv')
    ? normalizedFileName
    : `${normalizedFileName}.csv`;

  downloadFileFromBlobPart({
    fileName,
    source: new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
  });

  exportDialogOpen.value = false;
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

onBeforeUnmount(() => {
  if (isFullscreen.value) {
    void exit();
  }
});
</script>

<template>
  <Space class="admin-table-toolbar" :size="8">
    <AccessControl
      v-if="props.exportAccessCodes?.length"
      :codes="[...props.exportAccessCodes]"
      type="code"
    >
      <Tooltip :title="$t('ui.tableToolbar.export')">
        <Button
          class="admin-table-toolbar__button"
          :disabled="exportColumnOptions.length === 0"
          @click="openExportDialog"
        >
          <template #icon>
            <IconifyIcon icon="lucide:download" />
          </template>
        </Button>
      </Tooltip>
    </AccessControl>
    <Tooltip v-else :title="$t('ui.tableToolbar.export')">
      <Button
        class="admin-table-toolbar__button"
        :disabled="exportColumnOptions.length === 0"
        @click="openExportDialog"
      >
        <template #icon>
          <IconifyIcon icon="lucide:download" />
        </template>
      </Button>
    </Tooltip>

    <Tooltip :title="$t('ui.tableToolbar.refresh')">
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

    <Tooltip
      :title="
        isFullscreen
          ? $t('ui.tableToolbar.exitFullscreen')
          : $t('ui.tableToolbar.fullscreen')
      "
    >
      <Button class="admin-table-toolbar__button" @click="toggle()">
        <template #icon>
          <IconifyIcon
            :icon="isFullscreen ? 'lucide:minimize-2' : 'lucide:maximize-2'"
          />
        </template>
      </Button>
    </Tooltip>

    <Dropdown placement="bottomRight" trigger="click">
      <Tooltip :title="$t('ui.tableToolbar.columnSettings')">
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

    <Modal
      v-model:open="exportDialogOpen"
      :cancel-text="$t('common.cancel')"
      :ok-button-props="{ disabled: exportCheckedColumnKeys.length === 0 }"
      :ok-text="$t('ui.tableToolbar.export')"
      :title="$t('ui.tableToolbar.exportDialogTitle')"
      width="660px"
      @ok="handleExport"
    >
      <div class="admin-table-toolbar__export-panel">
        <table
          cellpadding="0"
          cellspacing="0"
          class="admin-table-toolbar__export-table"
        >
          <tbody>
            <tr>
              <td>{{ $t('ui.tableToolbar.exportFileName') }}</td>
              <td>
                <Input
                  v-model:value="exportFileName"
                  class="admin-table-toolbar__export-input"
                  :placeholder="$t('ui.tableToolbar.exportFileNamePlaceholder')"
                />
              </td>
            </tr>
            <tr>
              <td>{{ $t('ui.tableToolbar.exportFileType') }}</td>
              <td>
                <Tag class="admin-table-toolbar__export-type-tag" color="blue">
                  CSV
                </Tag>
              </td>
            </tr>
            <tr>
              <td>{{ $t('ui.tableToolbar.exportColumnsTitle') }}</td>
              <td>
                <div class="admin-table-toolbar__export-column-panel">
                  <div class="admin-table-toolbar__export-column-header">
                    <Checkbox
                      :checked="exportAllChecked"
                      :indeterminate="exportIndeterminate"
                      @change="handleExportCheckAllChange"
                    >
                      {{ $t('ui.tableToolbar.selectAll') }}
                    </Checkbox>
                    <span class="admin-table-toolbar__dialog-count">
                      {{
                        $t('ui.tableToolbar.exportColumnCount', [
                          exportCheckedColumnKeys.length,
                          exportColumnOptions.length,
                        ])
                      }}
                    </span>
                  </div>
                  <div class="admin-table-toolbar__export-column-body">
                    <Checkbox.Group
                      v-model:value="exportCheckedColumnKeys"
                      class="admin-table-toolbar__dialog-columns"
                    >
                      <div
                        v-for="column in exportColumnOptions"
                        :key="column.key"
                        class="admin-table-toolbar__dialog-column"
                        :class="[
                          {
                            'is-selected': exportCheckedColumnKeys.includes(
                              column.key,
                            ),
                          },
                        ]"
                        @click="handleExportColumnToggle(column.key)"
                      >
                        <Checkbox :value="column.key" @click.stop>
                          {{ column.title }}
                        </Checkbox>
                      </div>
                    </Checkbox.Group>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
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

.admin-table-toolbar__export-panel {
  width: 100%;
}

.admin-table-toolbar__export-table {
  width: 100%;
  table-layout: fixed;
  border: 0;
}

.admin-table-toolbar__export-table td {
  padding: 8px 10px;
  vertical-align: top;
}

.admin-table-toolbar__export-table td:first-child {
  width: 30%;
  font-weight: 600;
  color: hsl(var(--foreground));
  text-align: right;
}

.admin-table-toolbar__export-table td:last-child {
  width: 70%;
}

.admin-table-toolbar__export-input {
  width: 80%;
}

.admin-table-toolbar__export-type-tag {
  margin-inline-end: 0;
}

.admin-table-toolbar__dialog-count {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.admin-table-toolbar__export-column-panel {
  width: 80%;
  margin: 3px 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.admin-table-toolbar__export-column-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: hsl(var(--muted) / 55%);
  border-bottom: 1px solid hsl(var(--border));
}

.admin-table-toolbar__export-column-body {
  min-height: 160px;
  max-height: 282px;
  padding: 8px 0;
  overflow: auto;
}

.admin-table-toolbar__dialog-columns {
  display: block;
}

.admin-table-toolbar__dialog-column {
  min-width: 0;
  padding: 4px 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.admin-table-toolbar__dialog-column:hover {
  background: hsl(var(--accent) / 45%);
}

.admin-table-toolbar__dialog-column.is-selected {
  color: hsl(var(--foreground));
  background: hsl(var(--accent) / 65%);
}
</style>
