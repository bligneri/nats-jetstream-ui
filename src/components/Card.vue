<template>
  <div class="bg-jet-dark-200 rounded-lg p-5 flex items-center shadow-lg">
    <div :class="`p-3 rounded-full mr-4 ${iconColorClass}`">
      <Icon :name="iconName" customClass="w-6 h-6 text-white" />
    </div>
    <div>
      <p class="text-sm text-jet-text-secondary font-medium">{{ title }}</p>
      <p class="text-2xl font-bold text-jet-light">{{ value }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from './Icon.vue';

type IconName = 'stream' | 'consumer' | 'message' | 'server';

defineProps<{
  title: string;
  value: string | number;
  iconName: IconName;
  iconColorClass: string;
}>();
</script>