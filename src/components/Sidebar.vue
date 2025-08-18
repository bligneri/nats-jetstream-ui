<template>
  <aside class="w-64 bg-jet-dark-200 p-4 flex-shrink-0 flex flex-col">
    <div class="flex items-center mb-8">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-jet-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <h1 class="text-xl font-bold ml-2 text-jet-light">Jetstream UI</h1>
    </div>
    <nav class="flex-1 space-y-2">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        :class="getNavItemClass(item.to)"
      >
        <Icon :name="item.icon" customClass="w-5 h-5 mr-3" />
        <span>{{ item.name }}</span>
      </router-link>
    </nav>
    <div class="mt-auto text-center">
      <p class="text-xs text-jet-text-secondary">&copy; 2024 NATS Jetstream UI</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import Icon from './Icon.vue';

type IconName = 'dashboard' | 'stream';

const route = useRoute();

const navItems: { name: string, to: string, icon: IconName }[] = [
  { name: 'Dashboard', to: '/', icon: 'dashboard' },
  { name: 'Streams', to: '/streams', icon: 'stream' },
];

const getNavItemClass = (path: string) => {
  const baseClass = 'w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200';
  const isActive = path === '/' ? route.path === path : route.path.startsWith(path);
  return isActive
    ? `${baseClass} bg-jet-accent text-white`
    : `${baseClass} text-jet-text-secondary hover:bg-jet-dark-300 hover:text-jet-text`;
};
</script>