<script lang="ts" setup>
import type { AnalysisOverviewItem } from '@vben/common-ui';
import type { TabOption } from '@vben/types';

import { onMounted, ref } from 'vue';

import {
  AnalysisChartCard,
  AnalysisChartsTabs,
  AnalysisOverview,
} from '@vben/common-ui';
import {
  SvgBellIcon,
  SvgCakeIcon,
  SvgCardIcon,
  SvgDownloadIcon,
} from '@vben/icons';
import { $t } from '@vben/locales';

import { message } from 'ant-design-vue';

import { getAnalyticsDashboardApi } from '#/api/admin/portal';

import AnalyticsTrends from './analytics-trends.vue';
import AnalyticsVisitsData from './analytics-visits-data.vue';
import AnalyticsVisitsSales from './analytics-visits-sales.vue';
import AnalyticsVisitsSource from './analytics-visits-source.vue';
import AnalyticsVisits from './analytics-visits.vue';

const overviewItems = ref<AnalysisOverviewItem[]>([]);
const trendLabels = ref<string[]>([]);
const trendAccesses = ref<number[]>([]);
const trendActives = ref<number[]>([]);
const visitLabels = ref<string[]>([]);
const visitAccesses = ref<number[]>([]);
const sourceDistributions = ref<Array<{ name: string; value: number }>>([]);
const businessDistributions = ref<Array<{ name: string; value: number }>>([]);
const platformDistributions = ref<Array<{ name: string; value: number }>>([]);

function normalizeSourceName(raw?: string) {
  const key = (raw || '').trim().toLowerCase();
  switch (key) {
    case 'affiliate': {
      return 'Affiliate';
    }
    case 'direct': {
      return 'Direct';
    }
    case 'email': {
      return 'Email';
    }
    case 'other': {
      return 'Other';
    }
    case 'search': {
      return 'Search';
    }
    default: {
      return raw || '-';
    }
  }
}

function normalizeBusinessName(raw?: string) {
  const value = (raw || '').trim();
  if (!value) {
    return 'Unknown';
  }
  if (value.toLowerCase() === 'unknown') {
    return 'Unknown';
  }
  return value;
}

function normalizePlatformName(raw?: string) {
  const key = (raw || '').trim().toLowerCase();
  switch (key) {
    case 'client': {
      return 'Client';
    }
    case 'mobile': {
      return 'Mobile';
    }
    case 'other': {
      return 'Other';
    }
    case 'tablet': {
      return 'Tablet';
    }
    case 'web': {
      return 'Web';
    }
    default: {
      return raw || '-';
    }
  }
}

async function loadAnalyticsDashboard() {
  try {
    const response = await getAnalyticsDashboardApi();
    const overview = response.overview;
    overviewItems.value = [
      {
        icon: SvgCardIcon,
        title: $t('page.analytics.currentUserCount'),
        totalTitle: $t('page.analytics.totalUserCount'),
        totalValue: Number(overview?.totalUsers ?? 0),
        value: Number(overview?.currentUsers ?? 0),
      },
      {
        icon: SvgCakeIcon,
        title: $t('page.analytics.currentAccessCount'),
        totalTitle: $t('page.analytics.totalAccessCount'),
        totalValue: Number(overview?.totalAccesses ?? 0),
        value: Number(overview?.currentAccesses ?? 0),
      },
      {
        icon: SvgDownloadIcon,
        title: $t('page.analytics.currentDownloadCount'),
        totalTitle: $t('page.analytics.totalDownloadCount'),
        totalValue: Number(overview?.totalDownloads ?? 0),
        value: Number(overview?.currentDownloads ?? 0),
      },
      {
        icon: SvgBellIcon,
        title: $t('page.analytics.currentUsageCount'),
        totalTitle: $t('page.analytics.totalUsageCount'),
        totalValue: Number(overview?.totalUsages ?? 0),
        value: Number(overview?.currentUsages ?? 0),
      },
    ];

    trendLabels.value = response.trend?.labels ?? [];
    trendAccesses.value = (response.trend?.accesses ?? []).map((item) =>
      Number(item ?? 0),
    );
    trendActives.value = (response.trend?.actives ?? []).map((item) =>
      Number(item ?? 0),
    );
    visitLabels.value = (response.visits?.labels ?? []).map(
      (label) => `${label}${$t('page.analytics.month')}`,
    );
    visitAccesses.value = (response.visits?.accesses ?? []).map((item) =>
      Number(item ?? 0),
    );
    sourceDistributions.value = (response.sourceDistributions ?? []).map(
      (item) => ({
        name: normalizeSourceName(item.name),
        value: Number(item.value ?? 0),
      }),
    );
    businessDistributions.value = (response.businessDistributions ?? []).map(
      (item) => ({
        name: normalizeBusinessName(item.name),
        value: Number(item.value ?? 0),
      }),
    );
    platformDistributions.value = (response.platformDistributions ?? []).map(
      (item) => ({
        name: normalizePlatformName(item.name),
        value: Number(item.value ?? 0),
      }),
    );
  } catch (error) {
    message.error($t('page.analytics.loadFailed'));
    console.error(error);
  }
}

const chartTabs: TabOption[] = [
  {
    label: $t('page.analytics.trafficTrend'),
    value: 'trends',
  },
  {
    label: $t('page.analytics.monthAccessCount'),
    value: 'visits',
  },
];

onMounted(() => {
  loadAnalyticsDashboard();
});
</script>

<template>
  <div class="p-5">
    <AnalysisOverview :items="overviewItems" />
    <AnalysisChartsTabs :tabs="chartTabs" class="mt-5">
      <template #trends>
        <AnalyticsTrends
          :labels="trendLabels"
          :accesses="trendAccesses"
          :actives="trendActives"
        />
      </template>
      <template #visits>
        <AnalyticsVisits :labels="visitLabels" :accesses="visitAccesses" />
      </template>
    </AnalysisChartsTabs>

    <div class="mt-5 w-full md:flex">
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-1/3"
        :title="$t('page.analytics.accessCount')"
      >
        <AnalyticsVisitsData :items="platformDistributions" />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-1/3"
        :title="$t('page.analytics.accessSource')"
      >
        <AnalyticsVisitsSource :items="sourceDistributions" />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mt-0 md:w-1/3"
        :title="$t('page.analytics.businessRatio')"
      >
        <AnalyticsVisitsSales :items="businessDistributions" />
      </AnalysisChartCard>
    </div>
  </div>
</template>
