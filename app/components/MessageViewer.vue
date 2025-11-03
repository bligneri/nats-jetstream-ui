<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { NatsMessage } from '~/types';
import UiInput from './ui/Input.vue';
import UiButton from './ui/Button.vue';
import SpinnerIcon from './icons/SpinnerIcon.vue';
import ChevronDownIcon from './icons/ChevronDownIcon.vue';
import ChevronRightIcon from './icons/ChevronRightIcon.vue';
import { getDecoratorForSubject, extractHighlightedFields, syntaxHighlightJson } from '~/utils/messageDecorators';
import { useDebounceFn } from '@vueuse/core';

const props = defineProps<{
  subjects: string[];
}>();

// Convert first subject to a wildcard pattern that will match all messages
// e.g., "commands.*" stays as "commands.*", "commands.dlq.>" becomes "commands.dlq.*"
const defaultSubject = props.subjects[0] || '';
const subject = ref(defaultSubject);
const debouncedSubject = ref(defaultSubject);
const messages = ref<NatsMessage[]>([]);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const error = ref<string | null>(null);
const decorators = ref<any[]>([]);
const offset = ref(0);
const hasMore = ref(true);
const limit = 50;

// Load decorators on mount
onMounted(async () => {
  const { loadDecorators } = await import('~/utils/messageDecorators');
  decorators.value = await loadDecorators();
});

async function fetchMessages(append = false) {
  if (!debouncedSubject.value) return;

  if (append) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
    offset.value = 0;
    messages.value = [];
  }

  error.value = null;
  try {
    console.log(`Fetching messages for subject: ${debouncedSubject.value}, offset: ${offset.value}, limit: ${limit}`);

    const data = await $fetch<NatsMessage[]>('/api/messages', {
      query: {
        subject: debouncedSubject.value,
        limit: limit.toString(),
        offset: offset.value.toString(),
      },
    });

    console.log(`✅ Received ${data.length} messages:`, data.length > 0 ? data[0] : 'empty');

    if (append) {
      messages.value = [...messages.value, ...data];
    } else {
      messages.value = data;
    }

    // Check if there are more messages
    hasMore.value = data.length === limit;

    console.log(`Total messages in UI: ${messages.value.length}, hasMore: ${hasMore.value}`);
  } catch (e: any) {
    console.error('❌ Error fetching messages:', e);
    error.value = e.data?.statusMessage || 'Failed to fetch messages';
    if (!append) {
      messages.value = [];
    }
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
}

async function loadMore() {
  offset.value += limit;
  await fetchMessages(true);
}

// Debounced update of debouncedSubject
const updateDebouncedSubject = useDebounceFn(() => {
  debouncedSubject.value = subject.value;
}, 500); // Wait 500ms after user stops typing

// Watch subject changes and debounce
watch(subject, () => {
  updateDebouncedSubject();
});

// Auto-fetch messages when debouncedSubject changes
watch(debouncedSubject, () => {
  fetchMessages();
}, { immediate: true });

// Track which messages are expanded
const expandedMessages = ref(new Set<number>());

function toggleMessage(seq: number) {
  if (expandedMessages.value.has(seq)) {
    expandedMessages.value.delete(seq);
  } else {
    expandedMessages.value.add(seq);
  }
}

function formatMessageData(base64Data: string): string {
  try {
    const decoded = atob(base64Data);
    // Try to parse as JSON and pretty-print
    try {
      const parsed = JSON.parse(decoded);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Not JSON, return as plain text
      return decoded;
    }
  } catch (e) {
    return "Error decoding Base64 data";
  }
}

function getMessageBorderColor(subject: string): string {
  const decorator = getDecoratorForSubject(subject, decorators.value);
  if (!decorator) return 'border-slate-600';

  const colorMap: Record<string, string> = {
    red: 'border-red-500',
    green: 'border-green-500',
    blue: 'border-blue-500',
    yellow: 'border-yellow-500',
    purple: 'border-purple-500',
  };

  return colorMap[decorator.color || ''] || 'border-slate-600';
}

function getHighlightedFieldsPreview(msg: NatsMessage): string {
  const decorator = getDecoratorForSubject(msg.subject, decorators.value);
  if (!decorator) return '';

  try {
    const decoded = atob(msg.data);
    const parsed = JSON.parse(decoded);
    const highlighted = extractHighlightedFields(parsed, decorator);

    // Show first important field in preview (e.g., "Serial: 80085420")
    const firstField = decorator.highlightFields[0];
    if (firstField && highlighted[firstField]) {
      const label = decorator.fieldLabels?.[firstField] || firstField;
      return `${label}: ${highlighted[firstField]}`;
    }
  } catch (e) {
    // Ignore errors
  }

  return '';
}

function getHighlightedFields(msg: NatsMessage): [string, any, string][] {
  const decorator = getDecoratorForSubject(msg.subject, decorators.value);
  if (!decorator) return [];

  try {
    const decoded = atob(msg.data);
    const parsed = JSON.parse(decoded);
    const highlighted = extractHighlightedFields(parsed, decorator);

    return Object.entries(highlighted).map(([key, value]) => [
      key,
      typeof value === 'object' ? JSON.stringify(value) : value,
      decorator.fieldLabels?.[key] || key,
    ]);
  } catch (e) {
    return [];
  }
}

function getColoredJson(base64Data: string): string {
  try {
    const decoded = atob(base64Data);
    const parsed = JSON.parse(decoded);
    const formatted = JSON.stringify(parsed, null, 2);
    return syntaxHighlightJson(formatted);
  } catch (e) {
    return `<pre class="text-xs text-slate-300">${base64Data}</pre>`;
  }
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // If today, show "Today"
  if (diffDays === 0) {
    return 'Today';
  }
  // If yesterday, show "Yesterday"
  if (diffDays === 1) {
    return 'Yesterday';
  }
  // If within last week, show day name
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  // Otherwise show date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  // If less than 60 seconds ago, show "Just now"
  if (diffSecs < 60) {
    return 'Just now';
  }
  // If less than 60 minutes ago, show relative time
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  // If less than 24 hours ago, show relative time
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  // Otherwise show time
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function filterByExactSubject(exactSubject: string) {
  // Update the subject input to the exact subject (not a pattern)
  subject.value = exactSubject;
  // Trigger a new fetch
  fetchMessages();
}
</script>

<template>
  <div>
    <div class="flex items-end space-x-2">
      <UiInput
        id="subject"
        label="Subject to view"
        v-model="subject"
        placeholder="e.g., ORDERS.*"
        class="font-mono"
      />
      <UiButton @click="fetchMessages" :disabled="isLoading || !subject">
        <SpinnerIcon v-if="isLoading" class="h-5 w-5 animate-spin" />
        <span v-else>Fetch</span>
      </UiButton>
    </div>

    <p v-if="error" class="mt-2 text-sm text-red-400">{{ error }}</p>

    <div class="mt-4 space-y-2">
      <div v-if="isLoading" class="flex justify-center p-8">
        <SpinnerIcon class="h-8 w-8 animate-spin text-green-400" />
      </div>
      <template v-else-if="messages.length > 0">
        <div v-for="msg in messages" :key="msg.seq" :class="[
          'rounded-md border-l-4',
          getMessageBorderColor(msg.subject)
        ]">
          <button @click="toggleMessage(msg.seq)" class="w-full text-left bg-slate-700/50 hover:bg-slate-700/70 transition-colors">
            <!-- Important fields shown at card level -->
            <div class="p-3 space-y-2">
              <div class="flex items-start justify-between">
                <div class="flex items-center space-x-3">
                  <ChevronDownIcon v-if="expandedMessages.has(msg.seq)" class="h-5 w-5 text-slate-400 flex-shrink-0" />
                  <ChevronRightIcon v-else class="h-5 w-5 text-slate-400 flex-shrink-0" />
                  <!-- Important fields as main content -->
                  <div v-if="getHighlightedFields(msg).length > 0" class="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div v-for="[key, value, label] in getHighlightedFields(msg)" :key="key" class="flex items-baseline space-x-2">
                      <span class="text-xs font-medium text-amber-400">{{ label }}:</span>
                      <span class="font-mono text-sm text-white">{{ value }}</span>
                    </div>
                  </div>
                  <!-- Fallback to subject if no highlighted fields -->
                  <span v-else class="truncate font-mono text-sm text-slate-300">{{ msg.subject }}</span>
                </div>
                <!-- Timestamp - highly readable -->
                <div class="flex flex-col items-end flex-shrink-0 ml-4">
                  <span class="text-sm font-medium text-slate-200">{{ formatDate(msg.time) }}</span>
                  <span class="text-xs text-slate-400">{{ formatTime(msg.time) }}</span>
                </div>
              </div>
              <!-- Secondary info: Seq and subject -->
              <div class="flex items-center space-x-4 text-xs pl-8">
                <span class="font-mono text-slate-500">Seq: {{ msg.seq }}</span>
                <button
                  @click.stop="filterByExactSubject(msg.subject)"
                  class="font-mono text-slate-400 hover:text-green-400 hover:underline transition-colors"
                  :title="`Filter by exact subject: ${msg.subject}`"
                >
                  {{ msg.subject }}
                </button>
              </div>
            </div>
          </button>
          <div v-if="expandedMessages.has(msg.seq)" class="border-t border-slate-600 p-3 bg-slate-800/30">
            <div class="space-y-3">
              <div>
                <h4 class="text-xs font-semibold uppercase text-slate-400">Full Data</h4>
                <pre class="overflow-x-auto rounded bg-slate-900 p-3 text-xs"><code v-html="getColoredJson(msg.data)"></code></pre>
              </div>
              <div v-if="msg.headers">
                <h4 class="text-xs font-semibold uppercase text-slate-400">Headers</h4>
                <pre class="overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-300"><code>{{ JSON.stringify(msg.headers, null, 2) }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="text-center text-slate-500">No messages found for this subject.</p>

      <!-- Load More button -->
      <div v-if="!isLoading && messages.length > 0 && hasMore" class="flex justify-center pt-4">
        <UiButton @click="loadMore" :disabled="isLoadingMore" class="min-w-[200px]">
          <SpinnerIcon v-if="isLoadingMore" class="mr-2 h-5 w-5 animate-spin" />
          <span v-if="isLoadingMore">Loading...</span>
          <span v-else>Load More (showing {{ messages.length }})</span>
        </UiButton>
      </div>

      <!-- End of messages indicator -->
      <div v-if="!isLoading && messages.length > 0 && !hasMore" class="text-center text-sm text-slate-500 pt-4">
        All messages loaded ({{ messages.length }} total)
      </div>
    </div>
  </div>
</template>