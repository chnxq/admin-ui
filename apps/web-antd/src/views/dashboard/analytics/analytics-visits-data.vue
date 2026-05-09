<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { $t } from '@vben/locales';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface NamedValue {
  name: string;
  value: number;
}

interface Props {
  items?: NamedValue[];
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
});

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function renderChart() {
  const indicators = props.items.map((item) => ({ name: item.name, max: 0 }));
  const values = props.items.map((item) => item.value);
  const max = Math.max(...values, 1);
  indicators.forEach((item) => {
    item.max = max;
  });

  renderEcharts({
    legend: {
      bottom: 0,
      data: [$t('page.analytics.currentAccessCount')],
    },
    radar: {
      indicator: indicators,
      radius: '60%',
      splitNumber: 8,
    },
    series: [
      {
        areaStyle: {
          opacity: 1,
          shadowBlur: 0,
          shadowColor: 'rgba(0,0,0,.2)',
          shadowOffsetX: 0,
          shadowOffsetY: 10,
        },
        data: [
          {
            itemStyle: {
              color: '#b6a2de',
            },
            name: $t('page.analytics.currentAccessCount'),
            value: values,
          },
        ],
        itemStyle: {
          borderRadius: 10,
          borderWidth: 2,
        },
        symbolSize: 0,
        type: 'radar',
      },
    ],
    tooltip: {},
  });
}

onMounted(() => {
  renderChart();
});

watch(
  () => props.items,
  () => {
    renderChart();
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
