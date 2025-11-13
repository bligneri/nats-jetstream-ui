<script setup lang="ts">
import { ref, computed } from 'vue';
import type { StreamInfo } from '~/types';
import StreamIcon from './icons/StreamIcon.vue';
import MessageIcon from './icons/MessageIcon.vue';
import UiInput from './ui/Input.vue';

const props = defineProps<{
  streams: StreamInfo[];
  selectedStreamName?: string;
}>();

const emit = defineEmits(['selectStream']);

const searchQuery = ref('');

const handleSelect = (stream: StreamInfo) => {
  emit('selectStream', stream);
};

const filteredStreams = computed(() => {
  if (!searchQuery.value) return props.streams;

  const query = searchQuery.value.toLowerCase();
  return props.streams.filter(stream =>
    stream.config.name.toLowerCase().includes(query) ||
    stream.virtualSubject?.toLowerCase().includes(query) ||
    stream.parentStream?.toLowerCase().includes(query)
  );
});

const showSearch = computed(() => props.streams.length > 30);

// Helper to check if stream is inactive (last message > 1 day ago or no messages)
const isStreamInactive = (stream: StreamInfo) => {
  // No messages = inactive
  if (stream.state.messages === 0) return true;
  // No timestamp = can't determine, assume not inactive
  if (!stream.state.last_ts) return false;
  const lastMessageTime = new Date(stream.state.last_ts).getTime();
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  return lastMessageTime < oneDayAgo;
};

// Helper to extract display parts for virtual streams
const getStreamDisplayName = (stream: StreamInfo) => {
  if (stream.isVirtual && stream.virtualSubject) {
    // For virtual streams, only show the unique part (after first dot)
    const parts = stream.virtualSubject.split('.');
    const uniquePart = parts.slice(1).join('.');
    return {
      primary: uniquePart || stream.virtualSubject,
      secondary: null,
    };
  }
  return {
    primary: stream.config.name,
    secondary: null,
  };
};
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-2 flex-shrink-0">
      <h2 class="p-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Streams</h2>
      <div v-if="showSearch" class="mt-2">
        <UiInput
          id="stream-search"
          v-model="searchQuery"
          placeholder="Search streams..."
          class="text-sm"
        />
      </div>
    </div>
    <ul class="mt-1 space-y-1 overflow-y-auto flex-grow px-2 pb-2">
      <li v-for="stream in filteredStreams" :key="stream.config.name">
        <button
          @click="handleSelect(stream)"
          :class="[
            'flex w-full items-center justify-between rounded-md p-2 text-left text-sm transition',
            selectedStreamName === stream.config.name
              ? 'bg-green-500/20 text-green-300'
              : 'text-slate-300 hover:bg-slate-700'
          ]"
        >
          <div class="flex items-center space-x-2 truncate min-w-0">
            <StreamIcon class="h-5 w-5 flex-shrink-0" />
            <div class="flex flex-col truncate min-w-0">
              <span class="truncate font-medium text-sm">{{ getStreamDisplayName(stream).primary }}</span>
              <span v-if="getStreamDisplayName(stream).secondary" class="truncate text-xs text-slate-400">
                {{ getStreamDisplayName(stream).secondary }}
              </span>
            </div>
          </div>
          <div class="flex items-center space-x-2 text-xs flex-shrink-0 ml-2">
            <div class="flex items-center space-x-1 text-slate-400">
              <MessageIcon class="h-3 w-3" />
              <span>{{ stream.state.messages === -1 ? '?' : stream.state.messages.toLocaleString() }}</span>
            </div>
            <span
              v-if="isStreamInactive(stream)"
              class="inline-flex items-center rounded-full bg-slate-600/50 px-2 py-0.5 text-xs text-slate-400"
              title="No messages in the last 24 hours"
            >
              Inactive
            </span>
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>