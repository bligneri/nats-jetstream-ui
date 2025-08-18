<template>
  <div class="flex h-screen bg-jet-dark font-sans">
    <Sidebar />
    <main class="flex-1 p-6 md:p-8 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import Sidebar from './components/Sidebar.vue';
</script>