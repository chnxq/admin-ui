<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';

import {
  Button,
  Checkbox,
  Col,
  Divider,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Table,
  Tabs,
  Tooltip,
} from 'ant-design-vue';

import { $t } from '#/locales';

import { formatCronDescription } from './cron-utils';

type SegmentType =
  | 'any'
  | 'appoint'
  | 'cycle'
  | 'none'
  | 'range'
  | 'week'
  | 'workday';

type SegmentConfig = {
  appoint: string[];
  cycleEnd: number;
  cycleStart: number;
  max: number;
  min: number;
  type: SegmentType;
};

type SegmentKey =
  | 'day'
  | 'hour'
  | 'minute'
  | 'month'
  | 'second'
  | 'week';

const model = defineModel<string>({ default: '' });
const open = defineModel<boolean>('open', { default: false });

const activeKey = reactive({
  value: 'second',
});

const draftCron = ref('');

const segments = reactive<Record<SegmentKey, SegmentConfig>>({
  day: {
    appoint: [],
    cycleEnd: 31,
    cycleStart: 1,
    max: 31,
    min: 1,
    type: 'any',
  },
  hour: {
    appoint: [],
    cycleEnd: 23,
    cycleStart: 0,
    max: 23,
    min: 0,
    type: 'any',
  },
  minute: {
    appoint: [],
    cycleEnd: 59,
    cycleStart: 0,
    max: 59,
    min: 0,
    type: 'any',
  },
  month: {
    appoint: [],
    cycleEnd: 12,
    cycleStart: 1,
    max: 12,
    min: 1,
    type: 'any',
  },
  second: {
    appoint: [],
    cycleEnd: 59,
    cycleStart: 0,
    max: 59,
    min: 0,
    type: 'any',
  },
  week: {
    appoint: [],
    cycleEnd: 7,
    cycleStart: 1,
    max: 7,
    min: 1,
    type: 'none',
  },
});

const segmentOrder: SegmentKey[] = ['second', 'minute', 'hour', 'day', 'month', 'week'];

const segmentLabels: Record<SegmentKey, string> = {
  day: $t('page.task.cronDay'),
  hour: $t('page.task.cronHourUnit'),
  minute: $t('page.task.cronMinuteUnit'),
  month: $t('page.task.cronMonthUnit'),
  second: $t('page.task.cronSecondUnit'),
  week: $t('page.task.cronWeekUnit'),
};

const previewRows = computed(() => [
  {
    cron: draftCron.value || '-',
    day: toSegmentValue('day'),
    hour: toSegmentValue('hour'),
    minute: toSegmentValue('minute'),
    month: toSegmentValue('month'),
    second: toSegmentValue('second'),
    week: toSegmentValue('week'),
  },
]);

const previewColumns = computed(() => [
  { dataIndex: 'second', key: 'second', title: $t('page.task.cronSecondUnit') },
  { dataIndex: 'minute', key: 'minute', title: $t('page.task.cronMinuteUnit') },
  { dataIndex: 'hour', key: 'hour', title: $t('page.task.cronHourUnit') },
  { dataIndex: 'day', key: 'day', title: $t('page.task.cronDay') },
  { dataIndex: 'month', key: 'month', title: $t('page.task.cronMonthUnit') },
  { dataIndex: 'week', key: 'week', title: $t('page.task.cronWeekUnit') },
]);

const previewReadableValue = computed(
  () => formatCronDescription(draftCron.value) || draftCron.value || '-',
);

function getNumberOptions(segment: SegmentKey) {
  if (segment === 'week') {
    return ['1', '2', '3', '4', '5', '6', '7'];
  }
  const { max, min } = segments[segment];
  return Array.from({ length: max - min + 1 }, (_, index) =>
    String(min + index),
  );
}

function toSegmentValue(segment: SegmentKey) {
  const state = segments[segment];
  switch (state.type) {
    case 'any': {
      return '*';
    }
    case 'appoint': {
      return state.appoint.join(',');
    }
    case 'cycle': {
      return `${state.cycleStart}/${state.cycleEnd}`;
    }
    case 'none': {
      return '?';
    }
    case 'range': {
      return `${state.cycleStart}-${state.cycleEnd}`;
    }
    case 'workday': {
      return `${state.cycleStart}W`;
    }
  }
}

function syncModel() {
  draftCron.value = segmentOrder
    .map((segment) => toSegmentValue(segment))
    .join(' ');
}

function normalizeBounds(state: SegmentConfig) {
  if (state.cycleStart < state.min) state.cycleStart = state.min;
  if (state.cycleStart > state.max) state.cycleStart = state.max;
  if (state.cycleEnd < state.min) state.cycleEnd = state.min;
  if (state.cycleEnd > state.max) state.cycleEnd = state.max;
  if (state.cycleEnd < state.cycleStart) state.cycleEnd = state.cycleStart;
}

function setSegmentType(segment: SegmentKey, type: SegmentType) {
  segments[segment].type = type;
  syncModel();
}

function handleNumberChange(segment: SegmentKey) {
  normalizeBounds(segments[segment]);
  syncModel();
}

function handleAppointChange(segment: SegmentKey) {
  segments[segment].type = 'appoint';
  syncModel();
}

function parseSegmentValue(segment: SegmentKey, value?: string) {
  const state = segments[segment];
  if (!value) {
    return;
  }
  if (value === '*') {
    state.type = 'any';
    return;
  }
  if (value === '?') {
    state.type = 'none';
    return;
  }
  if (value.endsWith('W')) {
    state.type = 'workday';
    state.cycleStart = Number.parseInt(value.replace('W', ''), 10) || state.min;
    state.cycleEnd = state.cycleStart;
    normalizeBounds(state);
    return;
  }
  if (value.includes('/')) {
    const [start, end] = value.split('/');
    state.type = 'cycle';
    state.cycleStart = Number.parseInt(start || '', 10) || state.min;
    state.cycleEnd = Number.parseInt(end || '', 10) || state.min;
    normalizeBounds(state);
    return;
  }
  if (value.includes('-')) {
    const [start, end] = value.split('-');
    state.type = 'range';
    state.cycleStart = Number.parseInt(start || '', 10) || state.min;
    state.cycleEnd = Number.parseInt(end || '', 10) || state.min;
    normalizeBounds(state);
    return;
  }
  state.type = 'appoint';
  state.appoint = value.split(',').filter(Boolean);
}

function getWeekOptionLabel(value: string) {
  const keyMap: Record<string, string> = {
    '1': 'page.task.cronWeekMonday',
    '2': 'page.task.cronWeekTuesday',
    '3': 'page.task.cronWeekWednesday',
    '4': 'page.task.cronWeekThursday',
    '5': 'page.task.cronWeekFriday',
    '6': 'page.task.cronWeekSaturday',
    '7': 'page.task.cronWeekSunday',
  };
  return $t(keyMap[value] || 'page.task.cronWeekUnknown');
}

function initFromModel() {
  draftCron.value = model.value || '';
  const parts = draftCron.value.split(' ');
  if (parts.length !== 6 && parts.length !== 7) {
    syncModel();
    return;
  }
  const normalizedParts =
    parts.length === 6 ? parts : parts.slice(0, 6);
  parseSegmentValue('second', normalizedParts[0]);
  parseSegmentValue('minute', normalizedParts[1]);
  parseSegmentValue('hour', normalizedParts[2]);
  parseSegmentValue('day', normalizedParts[3]);
  parseSegmentValue('month', normalizedParts[4]);
  parseSegmentValue('week', normalizedParts[5]);
  syncModel();
}

function showDialog() {
  initFromModel();
  open.value = true;
}

function applyDialog() {
  model.value = draftCron.value;
  closeDialog();
}

function closeDialog() {
  open.value = false;
}

initFromModel();
</script>

<template>
  <div class="cron-expression-field">
    <Input
      :value="formatCronDescription(model) || ''"
      readonly
      :placeholder="$t('page.task.placeholderCronExpression')"
    >
      <template #suffix>
        <Tooltip :title="$t('page.task.cronHelpText')">
          <span class="cron-expression-field__help">?</span>
        </Tooltip>
      </template>
      <template #addonAfter>
        <Button type="link" @click="showDialog">
          {{ $t('page.task.editButton') }}
        </Button>
      </template>
    </Input>

    <Modal
      v-model:open="open"
      :cancel-text="$t('common.cancel')"
      destroy-on-close
      :ok-text="$t('common.confirm')"
      :title="$t('page.task.cronConfigTitle')"
      width="860px"
      :mask-closable="false"
      @cancel="closeDialog"
      @ok="applyDialog"
    >
      <div class="cron-builder">
        <Tabs v-model:active-key="activeKey.value" class="cron-builder__tabs">
          <Tabs.TabPane
            v-for="segment in segmentOrder"
            :key="segment"
            :tab="segmentLabels[segment]"
          >
            <div class="cron-segment">
              <div
                class="cron-segment__option"
                :class="{
                  'cron-segment__option--active':
                    segments[segment].type === 'any',
                }"
              >
                <div class="cron-segment__option-head">
                  <Radio
                    :checked="segments[segment].type === 'any'"
                    @change="setSegmentType(segment, 'any')"
                  >
                    {{
                      $t('page.task.cronEveryLabel', [segmentLabels[segment]])
                    }}
                  </Radio>
                </div>
              </div>

              <div
                class="cron-segment__option"
                :class="{
                  'cron-segment__option--active':
                    segments[segment].type === 'none',
                }"
              >
                <div class="cron-segment__option-head">
                  <Radio
                    :checked="segments[segment].type === 'none'"
                    @change="setSegmentType(segment, 'none')"
                  >
                    {{ $t('page.task.cronNoneLabel') }}
                  </Radio>
                </div>
              </div>

              <div
                class="cron-segment__option"
                :class="{
                  'cron-segment__option--active':
                    segments[segment].type === 'range',
                }"
              >
                <div class="cron-segment__option-head">
                  <Radio
                    :checked="segments[segment].type === 'range'"
                    @change="setSegmentType(segment, 'range')"
                  >
                    {{ $t('page.task.cronRangeLabel') }}
                  </Radio>
                </div>
                <div class="cron-segment__option-body">
                  <span class="cron-segment__text">{{
                    $t('page.task.cronFrom')
                  }}</span>
                  <InputNumber
                    v-model:value="segments[segment].cycleStart"
                    :max="segments[segment].max"
                    :min="segments[segment].min"
                    size="small"
                    @change="handleNumberChange(segment)"
                  />
                  <span class="cron-segment__text">{{
                    $t('page.task.cronTo')
                  }}</span>
                  <InputNumber
                    v-model:value="segments[segment].cycleEnd"
                    :max="segments[segment].max"
                    :min="segments[segment].min"
                    size="small"
                    @change="handleNumberChange(segment)"
                  />
                </div>
              </div>

              <div
                class="cron-segment__option"
                :class="{
                  'cron-segment__option--active':
                    segments[segment].type === 'cycle',
                }"
              >
                <div class="cron-segment__option-head">
                  <Radio
                    :checked="segments[segment].type === 'cycle'"
                    @change="setSegmentType(segment, 'cycle')"
                  >
                    {{ $t('page.task.cronCycleLabel') }}
                  </Radio>
                </div>
                <div class="cron-segment__option-body">
                  <span class="cron-segment__text">{{
                    $t('page.task.cronFrom')
                  }}</span>
                  <InputNumber
                    v-model:value="segments[segment].cycleStart"
                    :max="segments[segment].max"
                    :min="segments[segment].min"
                    size="small"
                    @change="handleNumberChange(segment)"
                  />
                  <span class="cron-segment__text">{{
                    $t('page.task.cronEveryStepLabel')
                  }}</span>
                  <InputNumber
                    v-model:value="segments[segment].cycleEnd"
                    :max="segments[segment].max"
                    :min="1"
                    size="small"
                    @change="handleNumberChange(segment)"
                  />
                </div>
              </div>

              <div
                v-if="segment === 'day'"
                class="cron-segment__option"
                :class="{
                  'cron-segment__option--active':
                    segments[segment].type === 'workday',
                }"
              >
                <div class="cron-segment__option-head">
                  <Radio
                    :checked="segments[segment].type === 'workday'"
                    @change="setSegmentType(segment, 'workday')"
                  >
                    {{ $t('page.task.cronWorkdayLabel') }}
                  </Radio>
                </div>
                <div class="cron-segment__option-body">
                  <span class="cron-segment__text">{{
                    $t('page.task.cronWorkdayPrefix')
                  }}</span>
                  <InputNumber
                    v-model:value="segments[segment].cycleStart"
                    :max="segments[segment].max"
                    :min="segments[segment].min"
                    size="small"
                    @change="handleNumberChange(segment)"
                  />
                </div>
              </div>

              <div
                v-if="segment === 'week'"
                class="cron-segment__option cron-segment__option--appoint"
                :class="{
                  'cron-segment__option--active':
                    segments[segment].type === 'appoint',
                }"
              >
                <div class="cron-segment__option-head">
                  <Radio
                    :checked="segments[segment].type === 'appoint'"
                    @change="setSegmentType(segment, 'appoint')"
                  >
                    {{ $t('page.task.cronAppointLabel') }}
                  </Radio>
                </div>
                <Checkbox.Group
                  v-model:value="segments[segment].appoint"
                  class="cron-segment__checkboxes cron-segment__checkboxes--week"
                  @change="handleAppointChange(segment)"
                >
                  <Row :gutter="[8, 8]">
                    <Col
                      v-for="option in getNumberOptions(segment)"
                      :key="option"
                      :span="8"
                    >
                      <Checkbox :value="option">
                        {{ getWeekOptionLabel(option) }}
                      </Checkbox>
                    </Col>
                  </Row>
                </Checkbox.Group>
              </div>

              <div
                v-if="segment !== 'week'"
                class="cron-segment__option cron-segment__option--appoint"
                :class="{
                  'cron-segment__option--active':
                    segments[segment].type === 'appoint',
                }"
              >
                <div class="cron-segment__option-head">
                  <Radio
                    :checked="segments[segment].type === 'appoint'"
                    @change="setSegmentType(segment, 'appoint')"
                  >
                    {{ $t('page.task.cronAppointLabel') }}
                  </Radio>
                </div>
                <Checkbox.Group
                  v-model:value="segments[segment].appoint"
                  class="cron-segment__checkboxes"
                  @change="handleAppointChange(segment)"
                >
                  <Row :gutter="[8, 8]">
                    <Col
                      v-for="option in getNumberOptions(segment)"
                      :key="option"
                      :span="4"
                    >
                      <Checkbox :value="option">{{ option }}</Checkbox>
                    </Col>
                  </Row>
                </Checkbox.Group>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>

        <Divider class="cron-builder__divider" />

        <div class="cron-builder__preview-panel">
          <Table
            bordered
            class="cron-builder__preview"
            :columns="previewColumns"
            :data-source="previewRows"
            :pagination="false"
            row-key="cron"
            size="small"
          />
          <div class="cron-builder__preview-head">
            <div class="cron-builder__preview-title">
              {{ $t('page.task.cronExpression') }}
            </div>
            <div class="cron-builder__preview-value">
              {{ previewReadableValue }}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.cron-expression-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cron-expression-field__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vben-text-secondary-color);
  cursor: help;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.cron-builder {
  padding: 4px;
}

.cron-builder__tabs {
  margin-bottom: 6px;
}

.cron-builder__tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}

.cron-builder__tabs :deep(.ant-tabs-tab) {
  padding: 6px 12px;
}

.cron-builder__divider {
  margin: 10px 0 8px;
}

.cron-segment {
  display: flex;
  flex-flow: row wrap;
  gap: 8px;
  padding-top: 2px;
}

.cron-segment__option {
  display: flex;
  flex: 1 1 320px;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  min-height: 42px;
  padding: 8px 12px;
  background: linear-gradient(
    180deg,
    hsl(var(--background)) 0%,
    hsl(var(--muted) / 12%) 100%
  );
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.cron-segment__option--active {
  background: linear-gradient(
    180deg,
    rgb(24 144 255 / 4%) 0%,
    rgb(24 144 255 / 9%) 100%
  );
  border-color: rgb(24 144 255 / 35%);
  box-shadow: 0 0 0 2px rgb(24 144 255 / 8%);
}

.cron-segment__option--appoint {
  flex-basis: 100%;
  align-items: flex-start;
}

.cron-segment__option--appoint .cron-segment__option-head {
  padding-top: 2px;
}

.cron-segment__option-head {
  display: flex;
  align-items: center;
  min-width: 110px;
}

.cron-segment__option-head :deep(.ant-radio-wrapper) {
  font-weight: 500;
}

.cron-segment__option-body {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  min-width: 0;
}

.cron-segment__text {
  font-size: 12px;
  color: var(--vben-text-secondary-color);
  white-space: nowrap;
}

.cron-segment__checkboxes {
  flex: 1 1 100%;
  min-width: 0;
  max-height: 184px;
  padding: 8px 10px;
  overflow: auto;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.cron-segment__checkboxes :deep(.ant-checkbox-wrapper) {
  display: inline-flex;
  width: 100%;
}

.cron-segment__option :deep(.ant-input-number) {
  width: 88px;
}

.cron-segment__option :deep(.ant-radio-wrapper) {
  margin-inline-end: 0;
}

.cron-builder__preview :deep(.ant-table-cell) {
  padding: 5px 7px;
  text-align: center;
}

.cron-builder__preview-panel {
  padding: 10px;
  background: hsl(var(--muted) / 14%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.cron-builder__preview-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vben-text-secondary-color);
  white-space: nowrap;
}

.cron-builder__preview-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.cron-builder__preview-value {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.cron-expression-field :deep(.ant-input-group-addon .ant-btn) {
  padding-inline: 8px;
}
</style>
