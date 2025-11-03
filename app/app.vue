<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
  // Hide the loading screen when app is ready
  document.body.classList.add('nuxt-loaded');
});
</script>

<template>
    <NuxtLayout>
        <NuxtPage />
    </NuxtLayout>
</template>
