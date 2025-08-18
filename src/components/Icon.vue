<template>
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" :class="customClass">
    <path v-if="name === 'dashboard'" stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 1.5m1-1.5l1 1.5m0 0l.5 1.5m-1.5-1.5h.008m-4.5-4.5h.008m4.5 0h.008m-4.5 0h.008m2.25-4.5h.008m4.5 0h.008M12 18.75v-1.5m0 1.5v-1.5m0 0h-4.5m4.5 0h4.5" />
    <path v-if="name === 'stream'" stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
    <path v-if="name === 'consumer'" stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    <path v-if="name === 'message'" stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m2.625 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path v-if="name === 'server'" stroke-linecap="round" stroke-linejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3V7.5a3 3 0 013-3h13.5a3 3 0 013 3v3.75a3 3 0 01-3 3m-13.5 0v1.5a3 3 0 003 3h7.5a3 3 0 003-3v-1.5" />
    <path v-if="name === 'chevron-down'" stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    <circle v-if="name === 'dot'" cx="12" cy="12" r="5" fill="currentColor" />
  </svg>
</template>

<script setup lang="ts">
type IconName = 'dashboard' | 'stream' | 'consumer' | 'message' | 'server' | 'chevron-down' | 'dot';

interface IconProps {
  name: IconName;
  customClass?: string;
}

withDefaults(defineProps<IconProps>(), {
  customClass: 'w-6 h-6',
});
</script>