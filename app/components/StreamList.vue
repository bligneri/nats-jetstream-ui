<script setup lang="ts">
import type { StreamInfo } from '~/types';
import StreamIcon from './icons/StreamIcon.vue';
import MessageIcon from './icons/MessageIcon.vue';

defineProps<{
  streams: StreamInfo[];
  selectedStreamName?: string;
}>();

const emit = defineEmits(['selectStream']);

const handleSelect = (stream: StreamInfo) => {
  emit('selectStream', stream);
};
</script>

<template>
  <div class="p-2">
    <h2 class="p-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Streams</h2>
    <ul class="mt-1 space-y-1">
      <li v-for="stream in streams" :key="stream.config.name">
        <button
          @click="handleSelect(stream)"
          :class="[
            'flex w-full items-center justify-between rounded-md p-2 text-left text-sm transition',
            selectedStreamName === stream.config.name
              ? 'bg-green-500/20 text-green-300'
              : 'text-slate-300 hover:bg-slate-700'
          ]"
        >
          <div class="flex items-center space-x-2 truncate">
            <StreamIcon class="h-5 w-5 flex-shrink-0" />
            <span class="truncate font-medium">{{ stream.config.name }}</span>
          </div>
          <div class="flex items-center space-x-1 text-xs text-slate-400">
            <MessageIcon class="h-3 w-3" />
            <span>{{ stream.state.messages.toLocaleString() }}</span>
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>