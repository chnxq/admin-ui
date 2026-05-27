<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(() => {
  void router.replace('/system/dict');
});
</script>

<template>
  <div></div>
</template>
